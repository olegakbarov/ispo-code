/**
 * Agent Manager - handles spawning and managing multiple agent types
 *
 * Supports:
 * - Cerebras GLM (SDK-based with tool calling)
 * - OpenCode (embedded server SDK)
 * - Claude CLI (subprocess via CLIAgentRunner)
 * - Codex CLI (subprocess via CLIAgentRunner)
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
  sendApproval?: (approved: boolean) => boolean
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

    // Concurrency should be based on processes running in this server instance,
    // not persisted session statuses (which may be stale after restarts).
    if (this.agents.size >= this.maxConcurrent) {
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
      model: params.model,
      taskPath: params.taskPath,
    }

    store.createSession(session)

    store.updateSession(sessionId, { status: "running" })
    this.emit("status", { sessionId, status: "running" })

    // Run the appropriate agent based on type
    this.runAgent(sessionId, params.prompt, workingDir, agentType, params.model, { isResume: false })

    return session
  }

  /**
   * Send a follow-up message to an existing session (resume/continue).
   *
   * For CLI agents, this uses the stored `cliSessionId` to run the CLI in resume mode.
   * For SDK agents, this starts a new run and appends output to the same session.
   */
  async sendMessage(sessionId: string, message: string): Promise<{ success: boolean; error?: string }> {
    const store = getSessionStore()
    const session = store.getSession(sessionId)
    if (!session) return { success: false, error: "Session not found" }

    if (this.agents.has(sessionId)) {
      return { success: false, error: "Session is currently running" }
    }

    if (this.agents.size >= this.maxConcurrent) {
      return { success: false, error: `Maximum concurrent agents (${this.maxConcurrent}) reached` }
    }

    const trimmed = message.trim()
    if (!trimmed) return { success: false, error: "Message is required" }

    const agentType = session.agentType ?? "cerebras"

    // CLI agents require a session id to resume.
    if ((agentType === "claude" || agentType === "codex") && !session.cliSessionId) {
      return { success: false, error: "This session cannot be resumed (missing cliSessionId)" }
    }

    const timestamp = new Date().toISOString()
    const messages = [
      ...(session.messages ?? []),
      { role: "user" as const, content: trimmed, timestamp },
    ]

    store.updateSession(sessionId, {
      status: "running",
      error: undefined,
      completedAt: undefined,
      messages,
    })
    this.emit("status", { sessionId, status: "running" })

    this.runAgent(sessionId, trimmed, session.workingDir, agentType, session.model, {
      isResume: agentType === "claude" || agentType === "codex" || agentType === "cerebras",
      cliSessionId: session.cliSessionId,
    })

    return { success: true }
  }

  /**
   * Send an approval response to a currently running agent (when supported).
   */
  approve(sessionId: string, approved: boolean): { success: boolean; error?: string } {
    const running = this.agents.get(sessionId)
    if (!running) {
      return { success: false, error: "Session is not running" }
    }
    if (!running.sendApproval) {
      return { success: false, error: "Approval not supported for this agent type" }
    }

    const ok = running.sendApproval(approved)
    if (!ok) {
      return { success: false, error: "Failed to send approval to agent process" }
    }

    const store = getSessionStore()
    store.appendOutput(sessionId, {
      type: "system",
      content: approved ? "Approved by user." : "Denied by user.",
      timestamp: new Date().toISOString(),
    })
    store.updateStatus(sessionId, "running")
    store.flushOutput(sessionId)
    this.emit("status", { sessionId, status: "running" })

    return { success: true }
  }

  private async runAgent(
    sessionId: string,
    prompt: string,
    workingDir: string,
    agentType: AgentType,
    model?: string,
    options?: { isResume?: boolean; cliSessionId?: string }
  ): Promise<void> {
    const store = getSessionStore()
    const session = store.getSession(sessionId)
    const analyzer = new MetadataAnalyzer(agentType)
    const isResume = options?.isResume ?? false
    const shouldMarkComplete = Boolean(session?.taskPath)

    try {
      // Emit initial chunk
      const startChunk: AgentOutputChunk = {
        type: "system",
        content: `${isResume ? "Resuming" : "Starting"} ${agentType} agent...`,
        timestamp: new Date().toISOString(),
      }
      store.appendOutput(sessionId, startChunk)
      this.emit("output", { sessionId, chunk: startChunk })

      // Create the appropriate agent
      let agentEmitter: EventEmitter & { abort: () => void; run: (p: string) => Promise<void> }
      let sendApproval: ((approved: boolean) => boolean) | undefined
      let getSessionUpdatesOnComplete: (() => Partial<AgentSession>) | undefined

      switch (agentType) {
        case "cerebras": {
          const agent = new CerebrasAgent({
            workingDir,
            model,
            messages: session?.cerebrasMessages ?? undefined,
          })
          agentEmitter = agent
          getSessionUpdatesOnComplete = () => ({ cerebrasMessages: agent.getMessages() })
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
          sendApproval = (approved: boolean) => cliRunner.sendApproval(approved)

          cliRunner.on("session_id", (cliSessionId: string) => {
            store.updateSession(sessionId, { cliSessionId })
          })
          cliRunner.on("waiting_approval", () => {
            store.updateStatus(sessionId, "waiting_approval")
            this.emit("status", { sessionId, status: "waiting_approval" })
          })
          cliRunner.on("waiting_input", () => {
            store.updateStatus(sessionId, "waiting_input")
            this.emit("status", { sessionId, status: "waiting_input" })
          })

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
                cliSessionId: options?.cliSessionId ?? session?.cliSessionId,
                isResume,
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
        sendApproval,
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
        const sessionUpdates = getSessionUpdatesOnComplete ? getSessionUpdatesOnComplete() : {}
        store.updateSession(sessionId, { tokensUsed: data.tokensUsed, metadata, ...sessionUpdates })
        const finalStatus: SessionStatus = shouldMarkComplete ? "completed" : "idle"
        store.updateStatus(sessionId, finalStatus)
        store.flushOutput(sessionId)
        this.emit("status", { sessionId, status: shouldMarkComplete ? "completed" : "idle" })
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
    const store = getSessionStore()
    const session = store.getSession(sessionId)

    // Session doesn't exist at all
    if (!session) {
      return false
    }

    const running = this.agents.get(sessionId)

    if (running) {
      // Agent is actively running - abort the process
      running.abort()
      this.agents.delete(sessionId)
      const metadata = running.analyzer.getMetadata()
      store.updateSession(sessionId, { metadata })
    }

    // Update status to cancelled (handles both running agents and orphaned sessions)
    // Only cancel if session is in an active state
    const activeStatuses: SessionStatus[] = ["pending", "running", "working", "waiting_approval", "waiting_input", "idle"]
    if (activeStatuses.includes(session.status)) {
      store.updateStatus(sessionId, "cancelled")
      store.flushOutput(sessionId)
      this.emit("status", { sessionId, status: "cancelled" })
      return true
    }

    // Session exists but is already in a terminal state
    return false
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
