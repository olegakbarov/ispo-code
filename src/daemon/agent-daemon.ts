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

// Load environment variables before any other imports
import { config } from "dotenv"
config()

import { EventEmitter } from "events"
import { StreamPublisher } from "./stream-publisher"
import { createRegistryEvent, createSessionEvent, type AgentStateEvent } from "../streams/schemas"
import { CerebrasAgent } from "../lib/agent/cerebras"
import { GeminiAgent } from "../lib/agent/gemini"
import { OpencodeAgent } from "../lib/agent/opencode"
import { CLIAgentRunner } from "../lib/agent/cli-runner"
import { MetadataAnalyzer } from "../lib/agent/metadata-analyzer"
import { extractTaskReviewOutput } from "../lib/agent/config"
import { saveTask } from "../lib/agent/task-service"
import { getContextLimit } from "../lib/agent/model-registry"
import type { AgentType, AgentOutputChunk, CerebrasMessageData, GeminiMessageData, ImageAttachment, SerializedImageAttachment } from "../lib/agent/types"

/** Agent interface with optional getMessages for SDK agents */
interface SDKAgentLike extends EventEmitter {
  abort: () => void
  run: (p: string) => Promise<void>
  getMessages?: () => CerebrasMessageData[] | GeminiMessageData[]
  setAttachments?: (attachments?: ImageAttachment[]) => void
}

export interface DaemonConfig {
  sessionId: string
  agentType: AgentType
  prompt: string
  workingDir: string
  daemonNonce: string
  model?: string
  taskPath?: string
  /** Display title for sidebar (e.g., "Review: Task Name") */
  title?: string
  /** Custom user instructions for review/verify tasks */
  instructions?: string
  /** Source file path if session originated from a file comment */
  sourceFile?: string
  /** Source line number if session originated from an inline comment */
  sourceLine?: number
  /** Debug run ID for grouping multi-agent debug sessions */
  debugRunId?: string
  streamServerUrl?: string
  isResume?: boolean
  cliSessionId?: string
  /** Reconstructed conversation state for SDK agents (from stream events) */
  reconstructedMessages?: unknown[]
  /** Image attachments for multimodal input */
  attachments?: ImageAttachment[]
}

/**
 * Format conversation history as context for agents that don't support message restoration
 * (e.g., OpenCode which creates fresh sessions via SDK)
 */
function formatConversationContext(messages: unknown[]): string {
  if (!messages || messages.length === 0) return ""

  const lines: string[] = ["=== Previous Conversation Context ===", ""]

  for (const msg of messages) {
    const m = msg as { role?: string; content?: string | null }
    if (!m.role || m.role === "system" || m.role === "tool") continue

    const role = m.role === "user" ? "User" : "Assistant"
    const content = m.content ?? ""

    // Truncate very long messages
    const truncated = content.length > 2000
      ? content.slice(0, 2000) + "... [truncated]"
      : content

    if (truncated) {
      lines.push(`${role}: ${truncated}`, "")
    }
  }

  lines.push("=== Continue from here ===", "")
  return lines.join("\n")
}

/**
 * Agent Daemon - Runs a single agent and publishes to streams
 */
export class AgentDaemon {
  private publisher: StreamPublisher
  private config: DaemonConfig
  private analyzer: MetadataAnalyzer
  private abortController: AbortController
  private agent?: SDKAgentLike
  private outputBuffer: AgentOutputChunk[] = []

  constructor(config: DaemonConfig) {
    this.config = config
    this.publisher = new StreamPublisher({
      serverUrl: config.streamServerUrl,
      bufferSize: 1, // Publish immediately for real-time updates
      debug: process.env.DEBUG === "true",
    })
    const modelLimit = getContextLimit(config.model ?? "", config.agentType)
    this.analyzer = new MetadataAnalyzer(config.agentType, config.workingDir, modelLimit)
    this.abortController = new AbortController()
  }

  /**
   * Run the agent and publish all events to streams
   */
  async run(): Promise<void> {
    const { sessionId, agentType, prompt, workingDir, model, taskPath, title, instructions, sourceFile, sourceLine, debugRunId, isResume, cliSessionId } =
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
            title,
            instructions,
            sourceFile,
            sourceLine,
            debugRunId,
          })
        )
      }

      // 2. Publish the user message to output stream (with attachments if any)
      const userMessageChunk: AgentOutputChunk = {
        type: "user_message",
        content: prompt,
        timestamp: new Date().toISOString(),
      }

      // Add attachments to the user message if present
      if (this.config.attachments && this.config.attachments.length > 0) {
        userMessageChunk.attachments = this.config.attachments.map((att) => ({
          type: att.type,
          mimeType: att.mimeType,
          data: att.data,
          fileName: att.fileName,
        }))
      }

      await this.publisher.publishSession(
        sessionId,
        createSessionEvent.output(userMessageChunk)
      )

      // 3. Publish status change to running
      await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("running"))
      await this.publisher.publishRegistry(
        createRegistryEvent.updated({
          sessionId,
          status: "running",
        })
      )

      // 4. Create and wire up the agent
      const { reconstructedMessages, attachments } = this.config
      this.agent = await this.createAgent(agentType, workingDir, model, cliSessionId, reconstructedMessages, attachments)

      // Wire up event handlers
      this.setupAgentHandlers(this.agent, sessionId)

      // 5. Prepare prompt (for OpenCode, prepend conversation context on resume)
      let effectivePrompt = prompt
      if (isResume && agentType === "opencode" && reconstructedMessages && reconstructedMessages.length > 0) {
        const context = formatConversationContext(reconstructedMessages)
        effectivePrompt = context + prompt
      }

      // 6. Run the agent
      await this.agent.run(effectivePrompt)

      // 7. Publish completion
      const metadata = this.analyzer.getMetadata()
      await this.publisher.publishRegistry(
        createRegistryEvent.completed({
          sessionId,
          metadata,
        })
      )
      await this.publisher.publishSession(sessionId, createSessionEvent.statusChange("completed"))

      // 8. Post-process review/verify sessions: extract and write updated task
      if (taskPath && title) {
        const isReviewOrVerify = title.startsWith("Review:") || title.startsWith("Verify:")
        if (isReviewOrVerify) {
          try {
            // Collect all assistant output into a single text
            const allOutput = this.outputBuffer
              .filter((chunk) => chunk.type === "text")
              .map((chunk) => chunk.content)
              .join("\n")

            // Extract the updated task content
            const extractedContent = extractTaskReviewOutput(allOutput)
            if (extractedContent) {
              // Write the extracted content to the task file
              saveTask(workingDir, taskPath, extractedContent)
              console.log(`[AgentDaemon] Updated task file: ${taskPath}`)
            } else {
              console.warn(
                `[AgentDaemon] Could not extract task review output for ${title}. ` +
                `Agent may not have used the required markers.`
              )
            }
          } catch (err) {
            // Log but don't fail the session if post-processing fails
            console.error(`[AgentDaemon] Failed to post-process ${title}:`, err)
          }
        }
      }

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
    cliSessionId?: string,
    reconstructedMessages?: unknown[],
    attachments?: ImageAttachment[]
  ): Promise<SDKAgentLike> {
    switch (agentType) {
      case "cerebras": {
        return new CerebrasAgent({
          workingDir,
          model,
          messages: reconstructedMessages as CerebrasMessageData[] | undefined,
          attachments,
        }) as unknown as SDKAgentLike
      }
      case "gemini": {
        return new GeminiAgent({
          workingDir,
          model,
          messages: reconstructedMessages as GeminiMessageData[] | undefined,
          attachments,
        }) as unknown as SDKAgentLike
      }
      case "opencode": {
        // OpenCode SDK doesn't support message restoration or multimodal
        // Messages will be formatted as context in the prompt by the caller
        return new OpencodeAgent({ workingDir, model }) as unknown as SDKAgentLike
      }
      case "claude":
      case "codex": {
        const cliRunner = new CLIAgentRunner()
        // Store attachments for CLI runner to use
        let pendingAttachments = attachments
        const runnerWrapper = Object.assign(new EventEmitter(), {
          abort: () => cliRunner.abort(),
          setAttachments: (atts?: ImageAttachment[]) => {
            pendingAttachments = atts
          },
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
              attachments: pendingAttachments,
            })
            pendingAttachments = undefined // Clear after use
          },
        }) as SDKAgentLike
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
      this.outputBuffer.push(chunk) // Store for post-processing
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

    agent.on("complete", async (data: { tokensUsed: { input: number; output: number } }) => {
      this.analyzer.updateTokenCounts(data.tokensUsed.input, data.tokensUsed.output)

      // Publish agent state for SDK agents (enables resume with conversation context)
      if (this.agent && typeof this.agent.getMessages === "function") {
        const messages = this.agent.getMessages()
        if (messages && messages.length > 0) {
          const agentType = this.config.agentType as "cerebras" | "gemini" | "opencode"
          await this.publisher.publishSession(
            sessionId,
            createSessionEvent.agentState(agentType, messages)
          )
        }
      }
    })

    agent.on("error", (error: string) => {
      // Error will be handled in the main run() catch block
      console.error(`[AgentDaemon] Agent error:`, error)
    })
  }

  /**
   * Abort the running agent and publish cancellation event
   */
  async abort(): Promise<void> {
    this.abortController.abort()
    if (this.agent) {
      this.agent.abort()
    }
    console.log(`[AgentDaemon] Aborting session ${this.config.sessionId}`)

    // Publish cancellation event to streams
    try {
      await this.publisher.publishRegistry(
        createRegistryEvent.cancelled({ sessionId: this.config.sessionId })
      )
      await this.publisher.publishSession(
        this.config.sessionId,
        createSessionEvent.statusChange("cancelled")
      )
      await this.publisher.close()
    } catch (err) {
      console.error(`[AgentDaemon] Failed to publish cancellation event:`, err)
    }
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
  process.on("SIGTERM", async () => {
    console.log("[AgentDaemon] Received SIGTERM, aborting...")
    await daemon.abort()
    process.exit(143)
  })

  process.on("SIGINT", async () => {
    console.log("[AgentDaemon] Received SIGINT, aborting...")
    await daemon.abort()
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
