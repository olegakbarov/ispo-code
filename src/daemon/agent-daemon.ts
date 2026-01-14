#!/usr/bin/env node
/**
 * Agent Daemon - Standalone Agent Process
 *
 * Runs an agent independently from the main server, publishing all
 * output to durable streams. Can survive server restarts.
 *
 * Usage:
 *   node agent-daemon.js --config='{"sessionId":"abc123","agentType":"cerebras",...}'
 */

import { EventEmitter } from "events"
import { StreamPublisher } from "./stream-publisher"
import { createRegistryEvent, createSessionEvent } from "../streams/schemas"
import { CerebrasAgent } from "../lib/agent/cerebras"
import { OpencodeAgent } from "../lib/agent/opencode"
import { CLIAgentRunner } from "../lib/agent/cli-runner"
import { MetadataAnalyzer } from "../lib/agent/metadata-analyzer"
import type { AgentType, AgentOutputChunk } from "../lib/agent/types"

export interface DaemonConfig {
  sessionId: string
  agentType: AgentType
  prompt: string
  workingDir: string
  daemonNonce: string
  model?: string
  taskPath?: string
  streamServerUrl?: string
  isResume?: boolean
  cliSessionId?: string
}

/**
 * Agent Daemon - Runs a single agent and publishes to streams
 */
export class AgentDaemon {
  private publisher: StreamPublisher
  private config: DaemonConfig
  private analyzer: MetadataAnalyzer
  private abortController: AbortController

  constructor(config: DaemonConfig) {
    this.config = config
    this.publisher = new StreamPublisher({
      serverUrl: config.streamServerUrl,
      bufferSize: 1, // Publish immediately for real-time updates
      debug: process.env.DEBUG === "true",
    })
    this.analyzer = new MetadataAnalyzer(config.agentType, config.workingDir)
    this.abortController = new AbortController()
  }

  /**
   * Run the agent and publish all events to streams
   */
  async run(): Promise<void> {
    const { sessionId, agentType, prompt, workingDir, model, taskPath, isResume, cliSessionId } =
      this.config
    const { daemonNonce } = this.config

    try {
      // 0. Announce daemon identity for rehydration validation.
      await this.publisher.publishSession(
        sessionId,
        createSessionEvent.daemonStarted(process.pid, daemonNonce)
      )

      // 1. Register session creation in registry (if not resume)
      if (!isResume) {
        await this.publisher.publishRegistry(
          createRegistryEvent.created({
            sessionId,
            agentType,
            prompt,
            workingDir,
            model,
            taskPath,
          })
        )
      }

      // 2. Publish status change to running
      await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("running"))
      await this.publisher.publishRegistry(
        createRegistryEvent.updated({
          sessionId,
          status: "running",
        })
      )

      // 3. Create and wire up the agent
      const agent = await this.createAgent(agentType, workingDir, model, cliSessionId)

      // Wire up event handlers
      this.setupAgentHandlers(agent, sessionId)

      // 4. Run the agent
      await agent.run(prompt)

      // 5. Publish completion
      const metadata = this.analyzer.getMetadata()
      await this.publisher.publishRegistry(
        createRegistryEvent.completed({
          sessionId,
          metadata,
        })
      )
      await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("completed"))

      // Flush all pending events
      await this.publisher.close()

      console.log(`[AgentDaemon] Session ${sessionId} completed successfully`)
      process.exit(0)
    } catch (err) {
      const error = (err as Error).message
      console.error(`[AgentDaemon] Session ${sessionId} failed:`, error)

      try {
        const metadata = this.analyzer.getMetadata()
        await this.publisher.publishRegistry(
          createRegistryEvent.failed({
            sessionId,
            error,
            metadata,
          })
        )
        await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("failed"))
        await this.publisher.close()
      } catch (publishErr) {
        console.error(`[AgentDaemon] Failed to publish error:`, publishErr)
      }

      process.exit(1)
    }
  }

  /**
   * Create the appropriate agent based on type
   */
  private async createAgent(
    agentType: AgentType,
    workingDir: string,
    model?: string,
    cliSessionId?: string
  ): Promise<EventEmitter & { abort: () => void; run: (p: string) => Promise<void> }> {
    switch (agentType) {
      case "cerebras": {
        return new CerebrasAgent({ workingDir, model }) as any
      }
      case "opencode": {
        return new OpencodeAgent({ workingDir, model }) as any
      }
      case "claude":
      case "codex": {
        const cliRunner = new CLIAgentRunner()
        const runnerWrapper = Object.assign(new EventEmitter(), {
          abort: () => cliRunner.abort(),
          run: async (p: string) => {
            cliRunner.on("output", (chunk: AgentOutputChunk) => {
              runnerWrapper.emit("output", chunk)
            })
            cliRunner.on("complete", (data: { tokensUsed: { input: number; output: number } }) => {
              runnerWrapper.emit("complete", data)
            })
            cliRunner.on("error", (error: string) => {
              runnerWrapper.emit("error", error)
            })
            cliRunner.on("cancelled", () => {
              runnerWrapper.emit("complete", { tokensUsed: { input: 0, output: 0 } })
            })
            cliRunner.on("session_id", (id: string) => {
              runnerWrapper.emit("session_id", id)
            })
            cliRunner.on("waiting_approval", () => {
              runnerWrapper.emit("waiting_approval")
            })
            cliRunner.on("waiting_input", () => {
              runnerWrapper.emit("waiting_input")
            })

            await cliRunner.run({
              agentType: agentType as "claude" | "codex",
              workingDir,
              prompt: p,
              cliSessionId,
              isResume: Boolean(cliSessionId),
              model,
            })
          },
        }) as EventEmitter & { abort: () => void; run: (p: string) => Promise<void> }
        return runnerWrapper
      }
      default:
        throw new Error(`Unknown agent type: ${agentType}`)
    }
  }

  /**
   * Setup event handlers for the agent
   */
  private setupAgentHandlers(
    agent: EventEmitter,
    sessionId: string
  ): void {
    agent.on("output", async (chunk: AgentOutputChunk) => {
      this.analyzer.processChunk(chunk)
      await this.publisher.publishSession(sessionId, createSessionEvent.output(chunk))
    })

    agent.on("session_id", async (cliSessionId: string) => {
      await this.publisher.publishSession(sessionId, createSessionEvent.cliSessionId(cliSessionId))
    })

    agent.on("waiting_approval", async () => {
      await this.publisher.publishSession(sessionId, createSessionEvent.approvalRequest())
      await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("waiting_approval"))
      await this.publisher.publishRegistry(
        createRegistryEvent.updated({ sessionId, status: "waiting_approval" })
      )
    })

    agent.on("waiting_input", async () => {
      await this.publisher.publishSession(sessionId, createSessionEvent.inputRequest())
      await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("waiting_input"))
      await this.publisher.publishRegistry(
        createRegistryEvent.updated({ sessionId, status: "waiting_input" })
      )
    })

    agent.on("complete", (data: { tokensUsed: { input: number; output: number } }) => {
      this.analyzer.updateTokenCounts(data.tokensUsed.input, data.tokensUsed.output)
    })

    agent.on("error", (error: string) => {
      // Error will be handled in the main run() catch block
      console.error(`[AgentDaemon] Agent error:`, error)
    })
  }

  /**
   * Abort the running agent
   */
  abort(): void {
    this.abortController.abort()
    console.log(`[AgentDaemon] Aborting session ${this.config.sessionId}`)
  }
}

/**
 * Main entry point for daemon process
 */
async function main() {
  // Parse config from command line
  const configArg = process.argv.find((arg) => arg.startsWith("--config="))
  if (!configArg) {
    console.error("Usage: node agent-daemon.js --config='{...}'")
    process.exit(1)
  }

  const configJson = configArg.replace("--config=", "")
  let config: DaemonConfig

  try {
    config = JSON.parse(configJson)
  } catch (err) {
    console.error("Failed to parse config JSON:", err)
    process.exit(1)
  }

  // Validate required fields
  if (!config.sessionId || !config.agentType || !config.prompt || !config.workingDir || !config.daemonNonce) {
    console.error(
      "Missing required config fields: sessionId, agentType, prompt, workingDir, daemonNonce"
    )
    process.exit(1)
  }

  console.log(`[AgentDaemon] Starting ${config.agentType} agent for session ${config.sessionId}`)

  const daemon = new AgentDaemon(config)

  // Handle termination signals
  process.on("SIGTERM", () => {
    console.log("[AgentDaemon] Received SIGTERM, aborting...")
    daemon.abort()
    process.exit(143)
  })

  process.on("SIGINT", () => {
    console.log("[AgentDaemon] Received SIGINT, aborting...")
    daemon.abort()
    process.exit(130)
  })

  await daemon.run()
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[AgentDaemon] Fatal error:", err)
    process.exit(1)
  })
}
