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
import type { AgentSession, AgentOutputChunk, SpawnAgentParams, SessionStatus, AgentType, ResumeHistoryEntry } from "./types"
import { getSessionStore } from "./session-store"
import { CerebrasAgent } from "./cerebras"
import { GeminiAgent } from "./gemini"
import { OpencodeAgent } from "./opencode"
import { CLIAgentRunner, getAvailableAgentTypes } from "./cli-runner"
import { MetadataAnalyzer } from "./metadata-analyzer"
import { createWorktree, deleteWorktree, isWorktreeIsolationEnabled } from "./git-worktree"
import { getGitRoot } from "./git-service"

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

/**
 * Determine if a session is resumable based on its state
 */
function isSessionResumable(session: AgentSession): boolean {
  // Cancelled sessions cannot be resumed
  if (session.status === "cancelled") {
    return false
  }

  // Note: We don't block based on session.resumable === false
  // Let users try to resume even if Codex reported needs_follow_up: false
  // The CLI will reject if it truly can't resume

  // CLI agents require a cliSessionId for resume
  const isCliAgent = session.agentType === "claude" || session.agentType === "codex"
  if (isCliAgent && !session.cliSessionId) {
    return false
  }

  // SDK agents (cerebras, gemini, opencode) are always resumable if completed/idle
  const isSdkAgent = session.agentType === "cerebras" || session.agentType === "gemini" || session.agentType === "opencode"
  if (isSdkAgent) {
    return session.status === "completed" || session.status === "idle"
  }

  // CLI agents are resumable if they have a session ID
  return !!session.cliSessionId
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

    // Create worktree if isolation is enabled and we're in a git repo
    let worktreePath: string | undefined
    let worktreeBranch: string | undefined

    if (isWorktreeIsolationEnabled()) {
      const repoRoot = getGitRoot(workingDir)
      if (repoRoot) {
        const worktreeInfo = createWorktree({ sessionId, repoRoot })
        if (worktreeInfo) {
          worktreePath = worktreeInfo.path
          worktreeBranch = worktreeInfo.branch
          console.log(`[AgentManager] Created worktree for session ${sessionId} at ${worktreePath}`)
        } else {
          console.warn(`[AgentManager] Failed to create worktree for session ${sessionId}, using standard workingDir`)
        }
      }
    }

    // Use worktree path as working directory if available
    const effectiveWorkingDir = worktreePath ?? workingDir

    const session: AgentSession = {
      id: sessionId,
      prompt: params.prompt,
      title: params.title,
      status: "pending",
      startedAt: new Date().toISOString(),
      workingDir,
      worktreePath,
      worktreeBranch,
      output: [],
      agentType,
      model: params.model,
      taskPath: params.taskPath,
      resumable: true, // New sessions are resumable by default
      resumeAttempts: 0,
      resumeHistory: [],
    }

    store.createSession(session)

    store.updateSession(sessionId, { status: "running" })
    this.emit("status", { sessionId, status: "running" })

    // Run the appropriate agent based on type, using worktree path if available
    this.runAgent(sessionId, params.prompt, effectiveWorkingDir, agentType, params.model, { isResume: false })

    return session
  }

  /**
   * Send a follow-up message to an existing session (resume/continue).
   *
   * For CLI agents, this uses the stored `cliSessionId` to run the CLI in resume mode.
   * For SDK agents, this starts a new run and appends output to the same session.
   *
   * @param sessionId - The session ID to resume
   * @param message - The follow-up message to send
   * @returns Result object with success status and optional error message
   */
  async sendMessage(sessionId: string, message: string): Promise<{ success: boolean; error?: string }> {
    const store = getSessionStore()
    const session = store.getSession(sessionId)

    // Check if session exists
    if (!session) {
      return { success: false, error: "Session not found" }
    }

    // Check if session is currently running
    if (this.agents.has(sessionId)) {
      return { success: false, error: "Session is currently running" }
    }

    // Check concurrency limit
    if (this.agents.size >= this.maxConcurrent) {
      return { success: false, error: `Maximum concurrent agents (${this.maxConcurrent}) reached` }
    }

    // Validate message
    const trimmed = message.trim()
    if (!trimmed) {
      return { success: false, error: "Message is required" }
    }

    // Check if session can be resumed
    const canResume = isSessionResumable(session)
    if (!canResume) {
      if (session.status === "cancelled") {
        return { success: false, error: "Cannot resume cancelled session" }
      }
      if (!session.cliSessionId && (session.agentType === "claude" || session.agentType === "codex")) {
        return { success: false, error: "This session cannot be resumed (missing cliSessionId)" }
      }
      return { success: false, error: "This session cannot be resumed" }
    }

    const agentType = session.agentType ?? "cerebras"
    const timestamp = new Date().toISOString()

    // Track resume attempt
    const resumeHistoryEntry: ResumeHistoryEntry = {
      timestamp,
      message: trimmed,
      success: false, // Will be updated on completion
    }

    // Update session with new message and resume tracking
    const messages = [
      ...(session.messages ?? []),
      { role: "user" as const, content: trimmed, timestamp },
    ]

    // Add user message to output for rendering
    store.appendOutput(sessionId, {
      type: "user_message",
      content: trimmed,
      timestamp,
    })

    store.updateSession(sessionId, {
      status: "running",
      error: undefined,
      completedAt: undefined,
      messages,
      lastResumedAt: timestamp,
      resumeAttempts: (session.resumeAttempts ?? 0) + 1,
      resumeHistory: [
        ...(session.resumeHistory ?? []),
        resumeHistoryEntry,
      ],
    })

    this.emit("status", { sessionId, status: "running" })

    // Run the agent with resume flag, using worktree path if available
    const effectiveWorkingDir = session.worktreePath ?? session.workingDir
    this.runAgent(sessionId, trimmed, effectiveWorkingDir, agentType, session.model, {
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
    const analyzer = new MetadataAnalyzer(agentType, workingDir)
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
        case "gemini": {
          const agent = new GeminiAgent({
            workingDir,
            model,
            messages: session?.geminiMessages ?? undefined,
          })
          agentEmitter = agent
          getSessionUpdatesOnComplete = () => ({ geminiMessages: agent.getMessages() })
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
          cliRunner.on("resumable", (isResumable: boolean) => {
            store.updateSession(sessionId, { resumable: isResumable })
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

        // Update resume history entry on successful completion
        const currentSession = store.getSession(sessionId)
        const updatedResumeHistory = currentSession?.resumeHistory?.map((entry, idx) => {
          if (idx === (currentSession.resumeHistory?.length ?? 1) - 1) {
            return { ...entry, success: true }
          }
          return entry
        })

        const sessionUpdates = getSessionUpdatesOnComplete ? getSessionUpdatesOnComplete() : {}
        store.updateSession(sessionId, {
          tokensUsed: data.tokensUsed,
          metadata,
          resumeHistory: updatedResumeHistory,
          ...sessionUpdates,
        })
        const finalStatus: SessionStatus = shouldMarkComplete ? "completed" : "idle"
        store.updateStatus(sessionId, finalStatus)
        store.flushOutput(sessionId)
        this.emit("status", { sessionId, status: shouldMarkComplete ? "completed" : "idle" })
      })

      agentEmitter.on("error", (error: string) => {
        const metadata = analyzer.getMetadata()

        // Update resume history entry on error
        const currentSession = store.getSession(sessionId)
        const updatedResumeHistory = currentSession?.resumeHistory?.map((entry, idx) => {
          if (idx === (currentSession.resumeHistory?.length ?? 1) - 1) {
            return { ...entry, success: false, error }
          }
          return entry
        })

        this.agents.delete(sessionId)
        store.updateSession(sessionId, {
          error,
          metadata,
          resumeHistory: updatedResumeHistory,
        })
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

      // Update resume history entry on error
      const currentSession = store.getSession(sessionId)
      const updatedResumeHistory = currentSession?.resumeHistory?.map((entry, idx) => {
        if (idx === (currentSession.resumeHistory?.length ?? 1) - 1) {
          return { ...entry, success: false, error }
        }
        return entry
      })

      this.agents.delete(sessionId)
      store.updateSession(sessionId, {
        error,
        metadata,
        resumeHistory: updatedResumeHistory,
      })
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
    const store = getSessionStore()
    const session = store.getSession(sessionId)

    // Cancel if running first
    if (this.agents.has(sessionId)) {
      this.cancel(sessionId)
    }

    // Cleanup worktree if it exists
    if (session?.worktreePath && session?.worktreeBranch) {
      console.log(`[AgentManager] Cleaning up worktree for session ${sessionId}`)
      deleteWorktree(session.worktreePath, {
        branch: session.worktreeBranch,
        force: true,
      })
    }

    // Delete from store
    return store.deleteSession(sessionId)
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