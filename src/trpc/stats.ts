/**
 * Stats tRPC Router
 *
 * Provides aggregate statistics across all tasks and agent sessions.
 * Data sources: AgentSessionMetadata, registry events, task files.
 */

import { router, procedure } from "./trpc"
import { listTasks } from "@/lib/agent/task-service"
import { getStreamAPI } from "@/streams/client"
import type { RegistryEvent, SessionCompletedEvent } from "@/streams/schemas"
import type { AgentSessionMetadata, SessionStatus } from "@/lib/agent/types"

/**
 * Overview KPIs aggregate
 */
interface StatsOverview {
  totalTasks: number
  totalSessions: number
  activeSessions: number
  completedSessions: number
  failedSessions: number
  totalFilesChanged: number
  totalToolCalls: number
  totalTokensUsed: {
    input: number
    output: number
  }
  // New efficiency/quality metrics
  successRate: number // percentage of completed/(completed+failed)
  avgDurationMs: number // average session duration
  avgContextUtilization: number // average context window usage %
  avgOutputTokens: number // average output tokens per session
  totalMessages: number // total user+assistant messages
  avgMessagesPerSession: number // average messages per completed session
}

/**
 * Tool usage breakdown
 */
interface ToolStats {
  byTool: Array<{ tool: string; count: number }>
  byType: Array<{ type: string; count: number }>
  totalCalls: number
}

/**
 * File change record
 */
interface FileChangeRecord {
  path: string
  operation: "create" | "edit" | "delete"
  timestamp: string
  toolUsed: string
  sessionId: string
  taskPath?: string
}

/**
 * Session type breakdown
 */
interface SessionBreakdown {
  byType: Array<{ sessionType: string; count: number }>
  byStatus: Array<{ status: string; count: number }>
  byAgentType: Array<{ agentType: string; count: number }>
}

/**
 * Per-task metrics for drill-down
 */
interface TaskMetrics {
  path: string
  title: string
  sessionCount: number
  filesChanged: number
  toolCalls: number
  tokensUsed: {
    input: number
    output: number
  }
  lastActivity: string
}

/**
 * Hot file aggregate - files with most edit activity
 */
interface HotFile {
  path: string
  editCount: number
  lastModified: string
  operations: {
    create: number
    edit: number
    delete: number
  }
  sessions: Array<{
    sessionId: string
    taskPath?: string
    editCount: number
  }>
}

/**
 * Enhanced tool call details with session context
 */
interface ToolCallDetails {
  tool: string
  totalCalls: number
  sessions: Array<{
    sessionId: string
    taskPath?: string
    callCount: number
  }>
  firstUsed: string
  lastUsed: string
}

/**
 * Daily stats aggregate for trend visualization
 */
interface DailyStats {
  date: string // YYYY-MM-DD format
  sessionsCreated: number
  tasksCreated: number
  toolCalls: number
  filesChanged: number
  tokensUsed: {
    input: number
    output: number
  }
}

/**
 * Helper to determine session type from title
 */
function getSessionType(title?: string, sourceFile?: string): string {
  if (sourceFile) return "comment"
  if (!title) return "execution"

  const titleLower = title.toLowerCase()
  if (titleLower.startsWith("plan:") || titleLower.startsWith("debug:")) return "planning"
  if (titleLower.startsWith("review:")) return "review"
  if (titleLower.startsWith("verify:")) return "verify"
  if (titleLower.startsWith("rewrite:")) return "rewrite"
  if (titleLower.startsWith("run:")) return "execution"

  return "execution"
}

/**
 * Helper to format date to YYYY-MM-DD in local timezone
 */
function toDateBucket(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Helper to get final session status from registry events
 */
function getSessionStatus(sessionId: string, events: RegistryEvent[]): SessionStatus {
  const sessionEvents = events.filter((e) => e.sessionId === sessionId)
  const latestStatusEvent = [...sessionEvents]
    .reverse()
    .find((e) =>
      e.type === "session_updated" ||
      e.type === "session_completed" ||
      e.type === "session_failed" ||
      e.type === "session_cancelled"
    )

  if (!latestStatusEvent) return "pending"

  if (latestStatusEvent.type === "session_updated") {
    return latestStatusEvent.status
  } else if (latestStatusEvent.type === "session_completed") {
    return "completed"
  } else if (latestStatusEvent.type === "session_failed") {
    return "failed"
  } else if (latestStatusEvent.type === "session_cancelled") {
    return "cancelled"
  }

  return "pending"
}

export const statsRouter = router({
  /**
   * Get overview KPIs across all tasks and sessions
   */
  getOverview: procedure.query(async ({ ctx }) => {
    const tasks = listTasks(ctx.workingDir)
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    // Track deleted sessions
    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Get all non-deleted sessions
    const allSessionIds = new Set<string>()
    const sessionDetails = new Map<string, { status: SessionStatus; metadata?: AgentSessionMetadata; tokensUsed?: { input: number; output: number } }>()

    for (const event of registryEvents) {
      if (event.type === "session_created" && !deletedSessionIds.has(event.sessionId)) {
        allSessionIds.add(event.sessionId)
        const status = getSessionStatus(event.sessionId, registryEvents)
        sessionDetails.set(event.sessionId, { status })
      }
    }

    // Aggregate metadata from completed/failed sessions
    let totalFilesChanged = 0
    let totalToolCalls = 0
    let totalTokensInput = 0
    let totalTokensOutput = 0
    let completedCount = 0
    let failedCount = 0
    let activeCount = 0

    // New aggregates for efficiency metrics
    let totalDurationMs = 0
    let sessionsWithDuration = 0
    let totalContextUtilization = 0
    let sessionsWithContext = 0
    let totalOutputTokens = 0
    let sessionsWithOutputTokens = 0
    let totalMessages = 0
    let sessionsWithMessages = 0

    for (const event of registryEvents) {
      if ((event.type === "session_completed" || event.type === "session_failed") && !deletedSessionIds.has(event.sessionId)) {
        const metadata = event.metadata
        if (metadata) {
          totalFilesChanged += metadata.editedFiles.length
          totalToolCalls += metadata.toolStats.totalCalls

          // Duration
          if (metadata.duration > 0) {
            totalDurationMs += metadata.duration
            sessionsWithDuration++
          }

          // Context window utilization
          if (metadata.contextWindow?.utilizationPercent !== undefined) {
            totalContextUtilization += metadata.contextWindow.utilizationPercent
            sessionsWithContext++
          }

          // Output metrics
          if (metadata.outputMetrics?.estimatedOutputTokens !== undefined) {
            totalOutputTokens += metadata.outputMetrics.estimatedOutputTokens
            sessionsWithOutputTokens++
          }

          // Message counts
          if (metadata.messageCount !== undefined) {
            totalMessages += metadata.messageCount
            sessionsWithMessages++
          }
        }

        if (event.type === "session_completed" && (event as SessionCompletedEvent).tokensUsed) {
          const tokens = (event as SessionCompletedEvent).tokensUsed!
          totalTokensInput += tokens.input
          totalTokensOutput += tokens.output
        }

        const detail = sessionDetails.get(event.sessionId)
        if (detail) {
          detail.metadata = metadata
          if (event.type === "session_completed" && (event as SessionCompletedEvent).tokensUsed) {
            detail.tokensUsed = (event as SessionCompletedEvent).tokensUsed
          }
        }
      }
    }

    // Count by status
    for (const detail of sessionDetails.values()) {
      if (detail.status === "completed") completedCount++
      else if (detail.status === "failed") failedCount++
      else if (["pending", "running", "working", "waiting_approval", "waiting_input", "idle"].includes(detail.status)) {
        activeCount++
      }
    }

    // Calculate derived metrics
    const finishedSessions = completedCount + failedCount
    const successRate = finishedSessions > 0 ? (completedCount / finishedSessions) * 100 : 0
    const avgDurationMs = sessionsWithDuration > 0 ? totalDurationMs / sessionsWithDuration : 0
    const avgContextUtilization = sessionsWithContext > 0 ? totalContextUtilization / sessionsWithContext : 0
    const avgOutputTokens = sessionsWithOutputTokens > 0 ? totalOutputTokens / sessionsWithOutputTokens : 0
    const avgMessagesPerSession = sessionsWithMessages > 0 ? totalMessages / sessionsWithMessages : 0

    const overview: StatsOverview = {
      totalTasks: tasks.length,
      totalSessions: allSessionIds.size,
      activeSessions: activeCount,
      completedSessions: completedCount,
      failedSessions: failedCount,
      totalFilesChanged,
      totalToolCalls,
      totalTokensUsed: {
        input: totalTokensInput,
        output: totalTokensOutput,
      },
      // New efficiency metrics
      successRate,
      avgDurationMs,
      avgContextUtilization,
      avgOutputTokens,
      totalMessages,
      avgMessagesPerSession,
    }

    return overview
  }),

  /**
   * Get tool usage breakdown across all sessions
   */
  getToolStats: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Aggregate tool stats from all completed/failed sessions
    const toolCounts = new Map<string, number>()
    const typeCounts = {
      read: 0,
      write: 0,
      execute: 0,
      other: 0,
    }
    let totalCalls = 0

    for (const event of registryEvents) {
      if ((event.type === "session_completed" || event.type === "session_failed") && !deletedSessionIds.has(event.sessionId)) {
        const metadata = event.metadata
        if (metadata?.toolStats) {
          totalCalls += metadata.toolStats.totalCalls

          // Aggregate by tool
          for (const [tool, count] of Object.entries(metadata.toolStats.byTool)) {
            toolCounts.set(tool, (toolCounts.get(tool) || 0) + count)
          }

          // Aggregate by type
          typeCounts.read += metadata.toolStats.byType.read
          typeCounts.write += metadata.toolStats.byType.write
          typeCounts.execute += metadata.toolStats.byType.execute
          typeCounts.other += metadata.toolStats.byType.other
        }
      }
    }

    // Convert to sorted arrays
    const byTool = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)

    const byType = [
      { type: "read", count: typeCounts.read },
      { type: "write", count: typeCounts.write },
      { type: "execute", count: typeCounts.execute },
      { type: "other", count: typeCounts.other },
    ].filter((t) => t.count > 0)

    const stats: ToolStats = {
      byTool,
      byType,
      totalCalls,
    }

    return stats
  }),

  /**
   * Get all file changes across all sessions with filters
   */
  getFileChanges: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Build map of sessionId -> taskPath
    const sessionTaskMap = new Map<string, string>()
    for (const event of registryEvents) {
      if (event.type === "session_created" && event.taskPath && !deletedSessionIds.has(event.sessionId)) {
        sessionTaskMap.set(event.sessionId, event.taskPath)
      }
    }

    // Collect all file changes from completed/failed sessions
    const fileChanges: FileChangeRecord[] = []

    for (const event of registryEvents) {
      if ((event.type === "session_completed" || event.type === "session_failed") && !deletedSessionIds.has(event.sessionId)) {
        const metadata = event.metadata
        if (metadata?.editedFiles) {
          for (const file of metadata.editedFiles) {
            fileChanges.push({
              path: file.repoRelativePath || file.relativePath || file.path,
              operation: file.operation,
              timestamp: file.timestamp,
              toolUsed: file.toolUsed,
              sessionId: event.sessionId,
              taskPath: sessionTaskMap.get(event.sessionId),
            })
          }
        }
      }
    }

    // Sort by timestamp descending
    fileChanges.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return fileChanges
  }),

  /**
   * Get session breakdown by type, status, and agent type
   */
  getSessionStats: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    const typeCounts = new Map<string, number>()
    const statusCounts = new Map<string, number>()
    const agentTypeCounts = new Map<string, number>()

    for (const event of registryEvents) {
      if (event.type === "session_created" && !deletedSessionIds.has(event.sessionId)) {
        const sessionType = getSessionType(event.title, event.sourceFile)
        typeCounts.set(sessionType, (typeCounts.get(sessionType) || 0) + 1)

        const status = getSessionStatus(event.sessionId, registryEvents)
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1)

        agentTypeCounts.set(event.agentType, (agentTypeCounts.get(event.agentType) || 0) + 1)
      }
    }

    const breakdown: SessionBreakdown = {
      byType: Array.from(typeCounts.entries())
        .map(([sessionType, count]) => ({ sessionType, count }))
        .sort((a, b) => b.count - a.count),
      byStatus: Array.from(statusCounts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      byAgentType: Array.from(agentTypeCounts.entries())
        .map(([agentType, count]) => ({ agentType, count }))
        .sort((a, b) => b.count - a.count),
    }

    return breakdown
  }),

  /**
   * Get per-task metrics for drill-down table
   */
  getTaskMetrics: procedure.query(async ({ ctx }) => {
    const tasks = listTasks(ctx.workingDir)
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Build map of taskPath -> sessions
    const taskSessionsMap = new Map<string, string[]>()
    for (const event of registryEvents) {
      if (event.type === "session_created" && event.taskPath && !deletedSessionIds.has(event.sessionId)) {
        const sessions = taskSessionsMap.get(event.taskPath) || []
        sessions.push(event.sessionId)
        taskSessionsMap.set(event.taskPath, sessions)
      }
    }

    const taskMetrics: TaskMetrics[] = []

    for (const task of tasks) {
      const sessionIds = taskSessionsMap.get(task.path) || []
      let filesChanged = 0
      let toolCalls = 0
      let tokensInput = 0
      let tokensOutput = 0
      let lastActivity = task.updatedAt

      // Aggregate metrics from all sessions for this task
      for (const sessionId of sessionIds) {
        for (const event of registryEvents) {
          if ((event.type === "session_completed" || event.type === "session_failed") && event.sessionId === sessionId) {
            const metadata = event.metadata
            if (metadata) {
              filesChanged += metadata.editedFiles.length
              toolCalls += metadata.toolStats.totalCalls
            }

            if (event.type === "session_completed" && (event as SessionCompletedEvent).tokensUsed) {
              const tokens = (event as SessionCompletedEvent).tokensUsed!
              tokensInput += tokens.input
              tokensOutput += tokens.output
            }

            // Update last activity to latest event
            if (new Date(event.timestamp) > new Date(lastActivity)) {
              lastActivity = event.timestamp
            }
          }
        }
      }

      taskMetrics.push({
        path: task.path,
        title: task.title,
        sessionCount: sessionIds.length,
        filesChanged,
        toolCalls,
        tokensUsed: {
          input: tokensInput,
          output: tokensOutput,
        },
        lastActivity,
      })
    }

    // Sort by last activity descending
    taskMetrics.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())

    return taskMetrics
  }),

  /**
   * Get hot files - files ranked by edit frequency
   */
  getHotFiles: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Build map of sessionId -> taskPath
    const sessionTaskMap = new Map<string, string>()
    for (const event of registryEvents) {
      if (event.type === "session_created" && event.taskPath && !deletedSessionIds.has(event.sessionId)) {
        sessionTaskMap.set(event.sessionId, event.taskPath)
      }
    }

    // Aggregate file changes by path
    const fileAggregates = new Map<string, {
      editCount: number
      lastModified: Date
      operations: { create: number; edit: number; delete: number }
      sessions: Map<string, number> // sessionId -> edit count for that session
    }>()

    for (const event of registryEvents) {
      if ((event.type === "session_completed" || event.type === "session_failed") && !deletedSessionIds.has(event.sessionId)) {
        const metadata = event.metadata
        if (metadata?.editedFiles) {
          for (const file of metadata.editedFiles) {
            const path = file.repoRelativePath || file.relativePath || file.path

            let aggregate = fileAggregates.get(path)
            if (!aggregate) {
              aggregate = {
                editCount: 0,
                lastModified: new Date(file.timestamp),
                operations: { create: 0, edit: 0, delete: 0 },
                sessions: new Map(),
              }
              fileAggregates.set(path, aggregate)
            }

            // Update aggregate
            aggregate.editCount++

            // Track operation type
            aggregate.operations[file.operation]++

            // Update last modified
            const timestamp = new Date(file.timestamp)
            if (timestamp > aggregate.lastModified) {
              aggregate.lastModified = timestamp
            }

            // Track session that modified this file
            const sessionEditCount = aggregate.sessions.get(event.sessionId) || 0
            aggregate.sessions.set(event.sessionId, sessionEditCount + 1)
          }
        }
      }
    }

    // Convert to HotFile array
    const hotFiles: HotFile[] = []
    for (const [path, aggregate] of fileAggregates.entries()) {
      const sessions = Array.from(aggregate.sessions.entries()).map(([sessionId, editCount]) => ({
        sessionId,
        taskPath: sessionTaskMap.get(sessionId),
        editCount,
      }))

      hotFiles.push({
        path,
        editCount: aggregate.editCount,
        lastModified: aggregate.lastModified.toISOString(),
        operations: aggregate.operations,
        sessions,
      })
    }

    // Sort by edit count descending
    hotFiles.sort((a, b) => b.editCount - a.editCount)

    return hotFiles
  }),

  /**
   * Get enhanced tool call details with session context
   */
  getToolCallDetails: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Build map of sessionId -> taskPath
    const sessionTaskMap = new Map<string, string>()
    for (const event of registryEvents) {
      if (event.type === "session_created" && event.taskPath && !deletedSessionIds.has(event.sessionId)) {
        sessionTaskMap.set(event.sessionId, event.taskPath)
      }
    }

    // Aggregate tool calls with session context
    const toolAggregates = new Map<string, {
      totalCalls: number
      sessions: Map<string, number> // sessionId -> call count for that session
      timestamps: Date[]
    }>()

    for (const event of registryEvents) {
      if ((event.type === "session_completed" || event.type === "session_failed") && !deletedSessionIds.has(event.sessionId)) {
        const metadata = event.metadata
        if (metadata?.toolStats) {
          for (const [tool, count] of Object.entries(metadata.toolStats.byTool)) {
            let aggregate = toolAggregates.get(tool)
            if (!aggregate) {
              aggregate = {
                totalCalls: 0,
                sessions: new Map(),
                timestamps: [],
              }
              toolAggregates.set(tool, aggregate)
            }

            aggregate.totalCalls += count

            // Track session that used this tool
            const sessionCallCount = aggregate.sessions.get(event.sessionId) || 0
            aggregate.sessions.set(event.sessionId, sessionCallCount + count)

            // Add timestamp (using event timestamp as proxy for tool usage time)
            aggregate.timestamps.push(new Date(event.timestamp))
          }
        }
      }
    }

    // Convert to ToolCallDetails array
    const toolDetails: ToolCallDetails[] = []
    for (const [tool, aggregate] of toolAggregates.entries()) {
      // Sort timestamps to get first/last used
      aggregate.timestamps.sort((a, b) => a.getTime() - b.getTime())

      const sessions = Array.from(aggregate.sessions.entries()).map(([sessionId, callCount]) => ({
        sessionId,
        taskPath: sessionTaskMap.get(sessionId),
        callCount,
      }))

      toolDetails.push({
        tool,
        totalCalls: aggregate.totalCalls,
        sessions,
        firstUsed: aggregate.timestamps[0]?.toISOString() || new Date().toISOString(),
        lastUsed: aggregate.timestamps[aggregate.timestamps.length - 1]?.toISOString() || new Date().toISOString(),
      })
    }

    // Sort by total calls descending
    toolDetails.sort((a, b) => b.totalCalls - a.totalCalls)

    return toolDetails
  }),

  /**
   * Get daily stats breakdown for trend visualization
   * Aggregates sessions, tasks, tool calls, files, and tokens by day
   */
  getDailyStats: procedure.query(async ({ ctx }) => {
    const tasks = listTasks(ctx.workingDir)
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Initialize daily buckets map
    const dailyBuckets = new Map<string, {
      sessionsCreated: number
      tasksCreated: number
      toolCalls: number
      filesChanged: number
      tokensInput: number
      tokensOutput: number
    }>()

    // Helper to ensure bucket exists
    const ensureBucket = (date: string) => {
      if (!dailyBuckets.has(date)) {
        dailyBuckets.set(date, {
          sessionsCreated: 0,
          tasksCreated: 0,
          toolCalls: 0,
          filesChanged: 0,
          tokensInput: 0,
          tokensOutput: 0,
        })
      }
      return dailyBuckets.get(date)!
    }

    // Aggregate sessions created per day
    for (const event of registryEvents) {
      if (event.type === "session_created" && !deletedSessionIds.has(event.sessionId)) {
        const date = toDateBucket(new Date(event.timestamp))
        const bucket = ensureBucket(date)
        bucket.sessionsCreated++
      }
    }

    // Aggregate tool calls, files, and tokens from completed/failed sessions
    for (const event of registryEvents) {
      if ((event.type === "session_completed" || event.type === "session_failed") && !deletedSessionIds.has(event.sessionId)) {
        const date = toDateBucket(new Date(event.timestamp))
        const bucket = ensureBucket(date)

        const metadata = event.metadata
        if (metadata) {
          bucket.toolCalls += metadata.toolStats.totalCalls
          bucket.filesChanged += metadata.editedFiles.length
        }

        if (event.type === "session_completed" && (event as SessionCompletedEvent).tokensUsed) {
          const tokens = (event as SessionCompletedEvent).tokensUsed!
          bucket.tokensInput += tokens.input
          bucket.tokensOutput += tokens.output
        }
      }
    }

    // Aggregate tasks created per day
    for (const task of tasks) {
      const date = toDateBucket(new Date(task.createdAt))
      const bucket = ensureBucket(date)
      bucket.tasksCreated++
    }

    // Convert to sorted array (most recent first)
    const dailyStats: DailyStats[] = Array.from(dailyBuckets.entries())
      .map(([date, bucket]) => ({
        date,
        sessionsCreated: bucket.sessionsCreated,
        tasksCreated: bucket.tasksCreated,
        toolCalls: bucket.toolCalls,
        filesChanged: bucket.filesChanged,
        tokensUsed: {
          input: bucket.tokensInput,
          output: bucket.tokensOutput,
        },
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    return dailyStats
  }),
})
