/**
 * Agent tRPC Router - Durable Streams Architecture
 *
 * This router uses durable streams for state persistence and detached daemon
 * processes for running agents. Key benefits:
 * - Agents survive server restarts
 * - State is append-only and replayable
 * - Real-time updates via SSE subscriptions
 */

import { z } from "zod"
import { randomBytes } from "crypto"
import { router, procedure } from "./trpc"
import { getAgentManager } from "@/lib/agent/manager"
import { getStreamAPI } from "@/streams/client"
import { getProcessMonitor } from "@/daemon/process-monitor"
import { spawnAgentDaemon, killDaemon, isDaemonRunning } from "@/daemon/spawn-daemon"
import { getStreamServerUrl } from "@/streams/server"
import type { AgentSession, AgentOutputChunk, SessionStatus } from "@/lib/agent/types"
import type { RegistryEvent, SessionStreamEvent, AgentOutputEvent, CLISessionIdEvent } from "@/streams/schemas"
import { createControlEvent, getControlStreamPath } from "@/streams/schemas"

const agentTypeSchema = z.enum(["claude", "codex", "opencode", "cerebras"])

/**
 * Feature flag: Use durable streams for new sessions
 * Set DISABLE_DURABLE_STREAMS=true to use legacy in-memory manager
 */
const USE_DURABLE_STREAMS = process.env.DISABLE_DURABLE_STREAMS !== "true"

/**
 * Reconstruct an AgentSession from stream events
 */
function reconstructSessionFromStreams(
  sessionId: string,
  registryEvents: RegistryEvent[],
  sessionEvents: SessionStreamEvent[]
): AgentSession | null {
  // Find the session_created event
  const createdEvent = registryEvents.find(
    (e) => e.type === "session_created" && e.sessionId === sessionId
  )
  if (!createdEvent || createdEvent.type !== "session_created") {
    return null
  }

  // Get the latest status from registry
  const sessionRegistryEvents = registryEvents.filter((e) => e.sessionId === sessionId)
  const latestEvent = sessionRegistryEvents[sessionRegistryEvents.length - 1]

  let status: SessionStatus = "pending"
  let error: string | undefined
  let metadata = null
  let tokensUsed: { input: number; output: number } | undefined

  if (latestEvent) {
    switch (latestEvent.type) {
      case "session_created":
        status = "pending"
        break
      case "session_updated":
        status = latestEvent.status
        break
      case "session_completed":
        status = "completed"
        metadata = latestEvent.metadata ?? null
        tokensUsed = latestEvent.tokensUsed
        break
      case "session_failed":
        status = "failed"
        error = latestEvent.error
        metadata = latestEvent.metadata ?? null
        break
      case "session_cancelled":
        status = "cancelled"
        break
    }
  }

  // Extract output chunks from session events
  const output: AgentOutputChunk[] = sessionEvents
    .filter((e): e is AgentOutputEvent => e.type === "output")
    .map((e) => e.chunk)

  // Extract CLI session ID if present
  const cliSessionIdEvent = sessionEvents.find(
    (e): e is CLISessionIdEvent => e.type === "cli_session_id"
  )

  return {
    id: sessionId,
    prompt: createdEvent.prompt,
    status,
    startedAt: createdEvent.timestamp,
    completedAt: latestEvent?.type === "session_completed" || latestEvent?.type === "session_failed"
      ? latestEvent.timestamp
      : undefined,
    workingDir: createdEvent.workingDir,
    output,
    error,
    agentType: createdEvent.agentType,
    model: createdEvent.model,
    metadata,
    tokensUsed,
    cliSessionId: cliSessionIdEvent?.cliSessionId,
    taskPath: createdEvent.taskPath,
    resumable: status !== "cancelled",
  }
}

export const agentRouter = router({
  // === Queries ===

  list: procedure.query(async () => {
    if (USE_DURABLE_STREAMS) {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Group events by session and get unique session IDs
      const sessionIds = new Set<string>()
      for (const event of registryEvents) {
        sessionIds.add(event.sessionId)
      }

      // Reconstruct each session
      const sessions: AgentSession[] = []
      for (const sessionId of sessionIds) {
        const sessionEvents = await streamAPI.readSession(sessionId)
        const session = reconstructSessionFromStreams(sessionId, registryEvents, sessionEvents)
        if (session) {
          sessions.push(session)
        }
      }

      // Sort by startedAt descending
      return sessions.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
    }

    // Fallback to legacy manager
    const manager = getAgentManager()
    return manager.getAllSessions()
  }),

  get: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        const streamAPI = getStreamAPI()
        const registryEvents = await streamAPI.readRegistry()
        const sessionEvents = await streamAPI.readSession(input.id)
        return reconstructSessionFromStreams(input.id, registryEvents, sessionEvents)
      }

      const manager = getAgentManager()
      return manager.getSession(input.id)
    }),

  /** Get session with metadata for thread sidebar display */
  getSessionWithMetadata: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        const streamAPI = getStreamAPI()
        const registryEvents = await streamAPI.readRegistry()
        const sessionEvents = await streamAPI.readSession(input.id)
        const session = reconstructSessionFromStreams(input.id, registryEvents, sessionEvents)
        if (!session) return null
        return {
          ...session,
          metadata: session.metadata ?? null,
        }
      }

      const manager = getAgentManager()
      const session = manager.getSession(input.id)
      if (!session) return null
      return {
        ...session,
        metadata: session.metadata ?? null,
      }
    }),

  availableTypes: procedure.query(() => {
    const manager = getAgentManager()
    return manager.getAvailableAgentTypes()
  }),

  /** Get files changed by an agent session */
  getChangedFiles: procedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        const streamAPI = getStreamAPI()
        const registryEvents = await streamAPI.readRegistry()
        const sessionEvents = await streamAPI.readSession(input.sessionId)
        const session = reconstructSessionFromStreams(input.sessionId, registryEvents, sessionEvents)
        return session?.metadata?.editedFiles ?? []
      }

      const manager = getAgentManager()
      const session = manager.getSession(input.sessionId)
      return session?.metadata?.editedFiles ?? []
    }),

  // === Mutations ===

  spawn: procedure
    .input(z.object({
      prompt: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      /** Model for opencode in format "provider/model" (e.g., "anthropic/claude-sonnet-4-20250514") */
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (USE_DURABLE_STREAMS) {
        const sessionId = randomBytes(6).toString("hex")
        const streamServerUrl = getStreamServerUrl()

        // Spawn daemon as detached process
        const pid = spawnAgentDaemon({
          sessionId,
          agentType: input.agentType,
          prompt: input.prompt,
          workingDir: ctx.workingDir,
          model: input.model,
        })

        // Track in process monitor
        const monitor = getProcessMonitor()
        monitor.spawnDaemon({
          sessionId,
          agentType: input.agentType,
          prompt: input.prompt,
          workingDir: ctx.workingDir,
          model: input.model,
          streamServerUrl,
        })

        return {
          sessionId,
          status: "pending" as SessionStatus,
          agentType: input.agentType,
          pid,
        }
      }

      // Fallback to legacy manager
      const manager = getAgentManager()
      const session = await manager.spawn({
        prompt: input.prompt,
        workingDir: ctx.workingDir,
        agentType: input.agentType,
        model: input.model,
      })
      return { sessionId: session.id, status: session.status, agentType: session.agentType }
    }),

  cancel: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        const monitor = getProcessMonitor()
        const daemon = monitor.getDaemon(input.id)

        if (daemon && isDaemonRunning(daemon.pid)) {
          const killed = killDaemon(daemon.pid)
          monitor.killDaemon(input.id)
          return { success: killed }
        }

        // Daemon not found or not running
        return { success: false }
      }

      const manager = getAgentManager()
      const success = manager.cancel(input.id)
      return { success }
    }),

  delete: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        // For durable streams, we don't actually delete - streams are append-only
        // We just remove from process monitor if running
        const monitor = getProcessMonitor()
        monitor.killDaemon(input.id)
        // TODO: Add a "session_deleted" event to registry for soft delete
        return { success: true }
      }

      const manager = getAgentManager()
      const success = manager.delete(input.id)
      return { success }
    }),

  /**
   * Send a follow-up message to an existing session (resume conversation)
   */
  sendMessage: procedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        const streamAPI = getStreamAPI()
        const registryEvents = await streamAPI.readRegistry()
        const sessionEvents = await streamAPI.readSession(input.sessionId)
        const session = reconstructSessionFromStreams(input.sessionId, registryEvents, sessionEvents)

        if (!session) {
          throw new Error("Session not found")
        }

        // Check if daemon is still running
        const monitor = getProcessMonitor()
        const daemon = monitor.getDaemon(input.sessionId)
        if (daemon && isDaemonRunning(daemon.pid)) {
          throw new Error("Session is currently running")
        }

        // Extract CLI session ID for resume
        const cliSessionIdEvent = sessionEvents.find(
          (e): e is CLISessionIdEvent => e.type === "cli_session_id"
        )

        // Spawn new daemon for resume
        spawnAgentDaemon({
          sessionId: input.sessionId,
          agentType: session.agentType ?? "cerebras",
          prompt: input.message,
          workingDir: session.workingDir,
          model: session.model,
          cliSessionId: cliSessionIdEvent?.cliSessionId,
          isResume: true,
        })

        return { success: true }
      }

      const manager = getAgentManager()
      const result = await manager.sendMessage(input.sessionId, input.message)
      if (!result.success) {
        throw new Error(result.error ?? "Failed to send message")
      }
      return { success: true }
    }),

  /**
   * Send approval response to a running agent
   */
  approve: procedure
    .input(z.object({
      sessionId: z.string(),
      approved: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      if (USE_DURABLE_STREAMS) {
        // Check if daemon is running
        const monitor = getProcessMonitor()
        const daemon = monitor.getDaemon(input.sessionId)

        if (!daemon || !isDaemonRunning(daemon.pid)) {
          throw new Error("Agent is not running")
        }

        // Publish approval to control stream
        const streamAPI = getStreamAPI()
        const controlPath = getControlStreamPath(input.sessionId)

        await streamAPI.append(controlPath, createControlEvent.approvalResponse(input.approved))

        return { success: true }
      }

      const manager = getAgentManager()
      const result = manager.approve(input.sessionId, input.approved)
      if (!result.success) {
        throw new Error(result.error ?? "Failed to send approval")
      }
      return { success: true }
    }),

  // === Stream-specific endpoints ===

  /** Get daemon process status */
  getDaemonStatus: procedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => {
      const monitor = getProcessMonitor()
      const daemon = monitor.getDaemon(input.sessionId)

      if (!daemon) {
        return { running: false, pid: null }
      }

      return {
        running: isDaemonRunning(daemon.pid),
        pid: daemon.pid,
        startedAt: daemon.startedAt.toISOString(),
      }
    }),

  /** Get process monitor stats */
  getProcessStats: procedure.query(() => {
    const monitor = getProcessMonitor()
    return monitor.getStats()
  }),
})
