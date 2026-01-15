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
import { getStreamAPI } from "@/streams/client"
import { getProcessMonitor } from "@/daemon/process-monitor"
import { killDaemon, isDaemonRunning } from "@/daemon/spawn-daemon"
import { getStreamServerUrl } from "@/streams/server"
import { getAvailableAgentTypes } from "@/lib/agent/cli-runner"
import type { AgentSession, AgentOutputChunk, SessionStatus, EditedFileInfo, ImageAttachment } from "@/lib/agent/types"
import type { RegistryEvent, SessionStreamEvent, AgentOutputEvent, CLISessionIdEvent, AgentStateEvent } from "@/streams/schemas"
import { createControlEvent, createRegistryEvent, getControlStreamPath } from "@/streams/schemas"
import { calculateRelativePaths } from "@/lib/utils/path-utils"

const agentTypeSchema = z.enum(["claude", "codex", "opencode", "cerebras", "gemini", "mcporter"])

/** Zod schema for image attachments */
const imageAttachmentSchema = z.object({
  type: z.literal("image"),
  mimeType: z.string(),
  data: z.string(), // base64 encoded
  fileName: z.string().optional(),
})

/**
 * Reconstruct edited files from output chunks by parsing tool_use events
 * This enables showing changed files during runtime before metadata is published
 */
function reconstructEditedFilesFromChunks(
  chunks: AgentOutputChunk[],
  workingDir: string
): EditedFileInfo[] {
  const editedFiles: EditedFileInfo[] = []

  for (const chunk of chunks) {
    if (chunk.type !== "tool_use") continue

    try {
      // Parse tool use content to extract tool name and input
      const content = JSON.parse(chunk.content)
      const toolName = content.name || content.tool_name
      const input = content.input || {}

      if (!toolName) continue

      // Extract file path from tool input (various possible keys)
      const path =
        (input.path as string) ??
        (input.file_path as string) ??
        (input.file as string) ??
        (input.notebook_path as string)

      if (!path) continue

      // Determine operation type based on tool name
      let operation: "create" | "edit" | "delete" | null = null
      const lowerTool = toolName.toLowerCase()

      if (lowerTool.includes("write") || lowerTool.includes("edit")) {
        operation = "edit"
      } else if (lowerTool.includes("create")) {
        operation = "create"
      } else if (lowerTool.includes("delete") || lowerTool.includes("remove")) {
        operation = "delete"
      }

      if (operation) {
        // Calculate relative paths
        const { relativePath, repoRelativePath } = calculateRelativePaths(path, workingDir)

        editedFiles.push({
          path,
          relativePath,
          repoRelativePath: repoRelativePath || undefined,
          operation,
          timestamp: chunk.timestamp,
          toolUsed: toolName,
        })
      }
    } catch (error) {
      // Skip chunks that can't be parsed
      continue
    }
  }

  return editedFiles
}

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
    title: createdEvent.title,
    instructions: createdEvent.instructions,
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
    sourceFile: createdEvent.sourceFile,
    sourceLine: createdEvent.sourceLine,
    resumable: status !== "cancelled",
  }
}

export const agentRouter = router({
  // === Queries ===

  list: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    // Track deleted sessions
    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Group events by session and get unique session IDs (excluding deleted)
    const sessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (!deletedSessionIds.has(event.sessionId)) {
        sessionIds.add(event.sessionId)
      }
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
  }),

  get: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Check if session was deleted
      const isDeleted = registryEvents.some(
        (e) => e.type === "session_deleted" && e.sessionId === input.id
      )
      if (isDeleted) {
        return null
      }

      const sessionEvents = await streamAPI.readSession(input.id)
      return reconstructSessionFromStreams(input.id, registryEvents, sessionEvents)
    }),

  /** Get session with metadata for thread sidebar display */
  getSessionWithMetadata: procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const sessionEvents = await streamAPI.readSession(input.id)
      const session = reconstructSessionFromStreams(input.id, registryEvents, sessionEvents)
      if (!session) return null
      return {
        ...session,
        metadata: session.metadata ?? null,
      }
    }),

  availableTypes: procedure.query(() => {
    return getAvailableAgentTypes()
  }),

  /** Get files changed by an agent session */
  getChangedFiles: procedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const sessionEvents = await streamAPI.readSession(input.sessionId)
      const session = reconstructSessionFromStreams(input.sessionId, registryEvents, sessionEvents)

      if (!session) return []

      // If metadata with editedFiles is available (session completed/failed), use it
      if (session.metadata?.editedFiles && session.metadata.editedFiles.length > 0) {
        return session.metadata.editedFiles
      }

      // Otherwise, reconstruct from output chunks for runtime display
      return reconstructEditedFilesFromChunks(session.output, session.workingDir)
    }),

  // === Mutations ===

  spawn: procedure
    .input(z.object({
      prompt: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      /** Model for opencode in format "provider/model" (e.g., "anthropic/claude-sonnet-4-20250514") */
      model: z.string().optional(),
      /** Display title for sidebar (uses prompt if not set) */
      title: z.string().optional(),
      /** Link to a task file if this session is executing a task */
      taskPath: z.string().optional(),
      /** Source file path if session originated from a file comment */
      sourceFile: z.string().optional(),
      /** Source line number if session originated from an inline comment */
      sourceLine: z.number().int().positive().optional(),
      /** Image attachments for multimodal input */
      attachments: z.array(imageAttachmentSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      // Spawn daemon as detached process and track it
      const monitor = getProcessMonitor()
      const daemon = monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        prompt: input.prompt,
        workingDir: ctx.workingDir,
        model: input.model,
        title: input.title,
        taskPath: input.taskPath,
        sourceFile: input.sourceFile,
        sourceLine: input.sourceLine,
        streamServerUrl,
        daemonNonce,
        attachments: input.attachments,
      })

      return {
        sessionId,
        status: "pending" as SessionStatus,
        agentType: input.agentType,
        pid: daemon.pid,
      }
    }),

  cancel: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      console.log(`[tRPC:cancel] Cancelling session ${input.id}`)

      const monitor = getProcessMonitor()
      const daemon = monitor.getDaemon(input.id)

      if (!daemon) {
        console.log(`[tRPC:cancel] No daemon found for session ${input.id}`)
        return { success: false }
      }

      console.log(`[tRPC:cancel] Found daemon with PID ${daemon.pid}`)

      if (!isDaemonRunning(daemon.pid)) {
        console.log(`[tRPC:cancel] Daemon ${daemon.pid} is not running`)
        monitor.killDaemon(input.id)
        return { success: false }
      }

      console.log(`[tRPC:cancel] Killing daemon ${daemon.pid}`)
      const killed = killDaemon(daemon.pid)
      monitor.killDaemon(input.id)
      console.log(`[tRPC:cancel] Kill result: ${killed}`)

      // Write cancellation event to registry to ensure UI updates
      // This is belt-and-suspenders: daemon SIGTERM handler also publishes,
      // but we write it here too in case daemon dies before publishing
      const streamAPI = getStreamAPI()
      await streamAPI.appendToRegistry(
        createRegistryEvent.cancelled({ sessionId: input.id })
      )
      console.log(`[tRPC:cancel] Published cancellation event to registry`)

      return { success: killed }
    }),

  delete: procedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // For durable streams, we soft-delete by appending a session_deleted event
      const monitor = getProcessMonitor()
      monitor.killDaemon(input.id)

      // Write deletion event to registry (soft delete)
      const streamAPI = getStreamAPI()
      await streamAPI.appendToRegistry(
        createRegistryEvent.deleted({ sessionId: input.id })
      )
      return { success: true }
    }),

  /**
   * Send a follow-up message to an existing session (resume conversation)
   */
  sendMessage: procedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string().min(1),
      /** Image attachments for multimodal input */
      attachments: z.array(imageAttachmentSchema).optional(),
    }))
    .mutation(async ({ input }) => {
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

      // Extract latest agent state for SDK agents (Cerebras, Gemini)
      // This enables conversation context restoration on resume
      const agentStateEvents = sessionEvents.filter(
        (e): e is AgentStateEvent => e.type === "agent_state"
      )
      const latestAgentState = agentStateEvents.length > 0
        ? agentStateEvents[agentStateEvents.length - 1]
        : undefined

      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      // Spawn new daemon for resume and track it
      monitor.spawnDaemon({
        sessionId: input.sessionId,
        agentType: session.agentType ?? "cerebras",
        prompt: input.message,
        workingDir: session.workingDir,
        model: session.model,
        cliSessionId: cliSessionIdEvent?.cliSessionId,
        isResume: true,
        streamServerUrl,
        daemonNonce,
        reconstructedMessages: latestAgentState?.messages,
        attachments: input.attachments,
      })

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
