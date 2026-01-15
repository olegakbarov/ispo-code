import type { RegistryEvent } from "@/streams/schemas"

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
