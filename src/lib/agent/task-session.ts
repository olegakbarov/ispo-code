import type { RegistryEvent } from "@/streams/schemas"

/**
 * Build a set of deleted session IDs from registry events.
 */
function getDeletedSessionIds(registryEvents: RegistryEvent[]): Set<string> {
  const deleted = new Set<string>()
  for (const event of registryEvents) {
    if (event.type === "session_deleted") {
      deleted.add(event.sessionId)
    }
  }
  return deleted
}

/**
 * Get session IDs for a specific task path.
 * Also checks for sessions with taskPath#subtaskId format.
 */
function getSessionIdsForTaskPath(registryEvents: RegistryEvent[], taskPath: string): string[] {
  return registryEvents
    .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> => {
      if (event.type !== "session_created") return false
      if (!event.taskPath) return false

      // Direct match
      if (event.taskPath === taskPath) return true

      // Match taskPath#subtaskId pattern (sessions for subtasks)
      if (event.taskPath.startsWith(taskPath + "#")) return true

      return false
    })
    .map((event) => event.sessionId)
}

/**
 * Get session IDs for a specific subtask (taskPath#subtaskId format).
 */
export function getSessionIdsForSubtask(
  registryEvents: RegistryEvent[],
  taskPath: string,
  subtaskId: string
): string[] {
  const fullPath = `${taskPath}#${subtaskId}`
  return registryEvents
    .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> =>
      event.type === "session_created" && event.taskPath === fullPath
    )
    .map((event) => event.sessionId)
}

function getSplitFromCandidates(splitFrom?: string): string[] {
  if (!splitFrom) return []

  const candidates = [splitFrom]
  if (splitFrom.startsWith("tasks/archive/")) {
    const filename = splitFrom.split("/").pop()
    if (filename) {
      candidates.push(`tasks/${filename}`)
    }
  }

  return Array.from(new Set(candidates))
}

/**
 * Resolve session IDs for a task from the registry.
 * Includes sessions from:
 * - Direct task path matches
 * - Subtask sessions (taskPath#subtaskId)
 * - Fallback to splitFrom path (backward compat)
 */
export function resolveTaskSessionIdsFromRegistry(
  registryEvents: RegistryEvent[],
  taskPath: string,
  splitFrom?: string
): string[] {
  const directSessionIds = getSessionIdsForTaskPath(registryEvents, taskPath)
  if (directSessionIds.length > 0) {
    return directSessionIds
  }

  for (const candidate of getSplitFromCandidates(splitFrom)) {
    const candidateSessionIds = getSessionIdsForTaskPath(registryEvents, candidate)
    if (candidateSessionIds.length > 0) {
      return candidateSessionIds
    }
  }

  return []
}

/**
 * Get all active (non-deleted) session IDs for a task path.
 * Used by task deletion to kill all attached sessions.
 *
 * Includes:
 * - Sessions matching the task path directly
 * - Sessions for subtasks (taskPath#subtaskId)
 * - Fallback to splitFrom path for backward compat
 *
 * Excludes:
 * - Sessions that have been soft-deleted (session_deleted event)
 */
export function getActiveSessionIdsForTask(
  registryEvents: RegistryEvent[],
  taskPath: string,
  splitFrom?: string
): string[] {
  const deletedIds = getDeletedSessionIds(registryEvents)

  // Collect all session IDs for this task (including subtasks and splitFrom fallback)
  const allSessionIds = resolveTaskSessionIdsFromRegistry(registryEvents, taskPath, splitFrom)

  // Filter out deleted sessions
  return allSessionIds.filter((id) => !deletedIds.has(id))
}

/**
 * Build a set of failed session IDs from registry events.
 */
function getFailedSessionIds(registryEvents: RegistryEvent[]): Set<string> {
  const failed = new Set<string>()
  for (const event of registryEvents) {
    if (event.type === "session_failed") {
      failed.add(event.sessionId)
    }
  }
  return failed
}

/**
 * Check if a task has any failed (non-deleted) sessions.
 * Returns true if at least one session for this task has failed.
 */
export function taskHasFailedSession(
  registryEvents: RegistryEvent[],
  taskPath: string,
  splitFrom?: string
): boolean {
  const deletedIds = getDeletedSessionIds(registryEvents)
  const failedIds = getFailedSessionIds(registryEvents)

  // Get all session IDs for this task
  const taskSessionIds = resolveTaskSessionIdsFromRegistry(registryEvents, taskPath, splitFrom)

  // Check if any non-deleted session has failed
  for (const sessionId of taskSessionIds) {
    if (!deletedIds.has(sessionId) && failedIds.has(sessionId)) {
      return true
    }
  }

  return false
}

/**
 * Build a map of taskPath -> hasFailed for all tasks with sessions.
 * Used by sidebar to show error indicators for tasks with failed sessions.
 * Excludes deleted sessions from the check.
 */
export function getTaskFailedSessionsMap(
  registryEvents: RegistryEvent[]
): Map<string, boolean> {
  const deletedIds = getDeletedSessionIds(registryEvents)
  const failedIds = getFailedSessionIds(registryEvents)

  // Build map of taskPath -> session IDs (excluding deleted)
  const taskSessions = new Map<string, string[]>()
  for (const event of registryEvents) {
    if (event.type === "session_created" && event.taskPath) {
      // Extract base task path (strip #subtaskId if present)
      const baseTaskPath = event.taskPath.split("#")[0]

      if (!deletedIds.has(event.sessionId)) {
        const sessions = taskSessions.get(baseTaskPath) || []
        sessions.push(event.sessionId)
        taskSessions.set(baseTaskPath, sessions)
      }
    }
  }

  // Build result map: taskPath -> hasFailed
  const result = new Map<string, boolean>()
  for (const [taskPath, sessionIds] of taskSessions) {
    const hasFailed = sessionIds.some((id) => failedIds.has(id))
    if (hasFailed) {
      result.set(taskPath, true)
    }
  }

  return result
}
