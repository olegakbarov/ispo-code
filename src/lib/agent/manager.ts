/**
 * Agent Manager - handles spawning and managing multiple agent types
 *
 * Supports:
 * - Cerebras GLM (SDK-based with tool calling)
 * - OpenCode (embedded server SDK)
 * - Claude CLI (subprocess - placeholder)
 * - Codex CLI (subprocess - placeholder)
 */

import { EventEmitter } from "events"
import { randomBytes } from "crypto"
import type { AgentSession, AgentOutputChunk, SpawnAgentParams, SessionStatus, AgentType } from "./types"
import { getSessionStore } from "./session-store"
import { CerebrasAgent } from "./cerebras"
import { OpencodeAgent } from "./opencode"
import { CLIAgentRunner, getAvailableAgentTypes } from "./cli-runner"
import { MetadataAnalyzer } from "./metadata-analyzer"

type AgentManagerEvents = {
  output: [{ sessionId: string; chunk: AgentOutputChunk }]
  status: [{ sessionId: string; status: SessionStatus; exitCode?: number }]
  error: [{ sessionId: string; error: string }]
}

interface RunningAgent {
  type: AgentType
  abort: () => void
  analyzer: MetadataAnalyzer
}

export class AgentManager extends EventEmitter<AgentManagerEvents> {
  private agents = new Map<string, RunningAgent>()
  private maxConcurrent: number

  constructor(options: { maxConcurrent?: number } = {}) {
    super()
    this.maxConcurrent = options.maxConcurrent ?? 3
  }

  private generateSessionId(): string {
    return randomBytes(6).toString("hex")
  }

  async spawn(params: SpawnAgentParams): Promise<AgentSession> {
    const store = getSessionStore()
    const activeSessions = store.getActiveSessions()

    if (activeSessions.length >= this.maxConcurrent) {
      throw new Error(`Maximum concurrent agents (${this.maxConcurrent}) reached`)
    }

    const sessionId = params.sessionId ?? this.generateSessionId()
    const workingDir = params.workingDir ?? process.cwd()
    const agentType = params.agentType ?? "cerebras" // Default to Cerebras

    const session: AgentSession = {
      id: sessionId,
      prompt: params.prompt,
      status: "pending",
      startedAt: new Date().toISOString(),
      workingDir,
      output: [],
      agentType,
      taskPath: params.taskPath,
    }

    store.createSession(session)

    store.updateSession(sessionId, { status: "running" })
    this.emit("status", { sessionId, status: "running" })

    // Run the appropriate agent based on type
    this.runAgent(sessionId, params.prompt, workingDir, agentType, params.model)

    return session
  }

  private async runAgent(
    sessionId: string,
    prompt: string,
    workingDir: string,
    agentType: AgentType,
    model?: string
  ): Promise<void> {
    const store = getSessionStore()
    const analyzer = new MetadataAnalyzer(agentType)

    try {
      // Emit initial chunk
      const startChunk: AgentOutputChunk = {
        type: "system",
        content: `Starting ${agentType} agent...`,
        timestamp: new Date().toISOString(),
      }
      store.appendOutput(sessionId, startChunk)
      this.emit("output", { sessionId, chunk: startChunk })

      // Create the appropriate agent
      let agentEmitter: EventEmitter & { abort: () => void; run: (p: string) => Promise<void> }

      switch (agentType) {
        case "cerebras": {
          const agent = new CerebrasAgent({ workingDir, model })
          agentEmitter = agent
          break
        }
        case "opencode": {
          const agent = new OpencodeAgent({ workingDir, model })
          agentEmitter = agent
          break
        }
        case "claude":
        case "codex": {
          // CLI-based agents using subprocess spawning
          const cliRunner = new CLIAgentRunner()
          const runnerWrapper = Object.assign(new EventEmitter(), {
            abort: () => cliRunner.abort(),
            run: async (p: string) => {
              // Wire up CLI runner events to our wrapper
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

              await cliRunner.run({
                agentType: agentType as "claude" | "codex",
                workingDir,
                prompt: p,
                model,
              })
            },
          }) as EventEmitter & { abort: () => void; run: (p: string) => Promise<void> }
          agentEmitter = runnerWrapper
          break
        }
        default: {
          // Unknown agent type - error
          const errorEmitter = new EventEmitter() as EventEmitter & { abort: () => void; run: (p: string) => Promise<void> }
          errorEmitter.abort = () => {}
          errorEmitter.run = async () => {
            errorEmitter.emit("output", {
              type: "error",
              content: `Unknown agent type: ${agentType}`,
              timestamp: new Date().toISOString(),
            })
            errorEmitter.emit("error", `Unknown agent type: ${agentType}`)
          }
          agentEmitter = errorEmitter
        }
      }

      // Register the running agent
      this.agents.set(sessionId, {
        type: agentType,
        abort: () => agentEmitter.abort(),
        analyzer,
      })

      // Wire up event handlers
      agentEmitter.on("output", (chunk: AgentOutputChunk) => {
        analyzer.processChunk(chunk)
        store.appendOutput(sessionId, chunk)
        this.emit("output", { sessionId, chunk })
      })

      agentEmitter.on("complete", (data: { tokensUsed: { input: number; output: number } }) => {
        analyzer.updateTokenCounts(data.tokensUsed.input, data.tokensUsed.output)
        const metadata = analyzer.getMetadata()

        this.agents.delete(sessionId)
        store.updateSession(sessionId, {
          tokensUsed: data.tokensUsed,
          metadata,
        })
        store.updateStatus(sessionId, "completed")
        store.flushOutput(sessionId)
        this.emit("status", { sessionId, status: "completed" })
      })

      agentEmitter.on("error", (error: string) => {
        const metadata = analyzer.getMetadata()

        this.agents.delete(sessionId)
        store.updateSession(sessionId, { error, metadata })
        store.updateStatus(sessionId, "failed")
        store.flushOutput(sessionId)
        this.emit("error", { sessionId, error })
        this.emit("status", { sessionId, status: "failed" })
      })

      // Run the agent
      await agentEmitter.run(prompt)

    } catch (err) {
      const error = (err as Error).message
      const metadata = analyzer.getMetadata()

      this.agents.delete(sessionId)
      store.updateSession(sessionId, { error, metadata })
      store.updateStatus(sessionId, "failed")
      store.flushOutput(sessionId)
      this.emit("error", { sessionId, error })
      this.emit("status", { sessionId, status: "failed" })
    }
  }

  cancel(sessionId: string): boolean {
    const running = this.agents.get(sessionId)
    if (!running) {
      return false
    }

    const store = getSessionStore()
    running.abort()
    this.agents.delete(sessionId)

    const metadata = running.analyzer.getMetadata()
    store.updateSession(sessionId, { metadata })
    store.updateStatus(sessionId, "cancelled")
    store.flushOutput(sessionId)
    this.emit("status", { sessionId, status: "cancelled" })

    return true
  }

  getSession(sessionId: string): AgentSession | null {
    return getSessionStore().getSession(sessionId)
  }

  getAllSessions(): AgentSession[] {
    return getSessionStore().getAllSessions()
  }

  getActiveSessions(): AgentSession[] {
    return getSessionStore().getActiveSessions()
  }

  isRunning(sessionId: string): boolean {
    return this.agents.has(sessionId)
  }

  getActiveCount(): number {
    return this.agents.size
  }

  delete(sessionId: string): boolean {
    // Cancel if running first
    if (this.agents.has(sessionId)) {
      this.cancel(sessionId)
    }
    // Delete from store
    return getSessionStore().deleteSession(sessionId)
  }

  /**
   * Get available agent types based on installed CLIs and API keys
   */
  getAvailableAgentTypes(): AgentType[] {
    return getAvailableAgentTypes()
  }

  /**
   * Get all supported agent types (may not all be available)
   */
  getSupportedAgentTypes(): AgentType[] {
    return ["cerebras", "opencode", "claude", "codex"]
  }
}

let managerInstance: AgentManager | null = null

export function getAgentManager(): AgentManager {
  if (!managerInstance) {
    managerInstance = new AgentManager()
    // Add default error handler to prevent unhandled error crashes
    managerInstance.on("error", ({ sessionId, error }) => {
      console.error(`[AgentManager] Session ${sessionId} error:`, error)
    })
  }
  return managerInstance
}
