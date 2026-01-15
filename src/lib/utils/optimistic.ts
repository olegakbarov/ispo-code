/**
 * Optimistic Update Utilities
 *
 * Shared helpers for implementing optimistic updates with TanStack Query/tRPC.
 * These utilities help ensure consistent patterns across mutations.
 */

import type { TRPCClientErrorLike } from "@trpc/client"
import type { AppRouter } from "@/trpc"

/**
 * Context returned from onMutate for rollback on error.
 * Each mutation defines its own specific context shape.
 */
export interface OptimisticContext<T> {
  /** Previous cache data for rollback */
  previousData: T
}

/**
 * Helper to create a standard error message from tRPC errors
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return "An unexpected error occurred"
}

/**
 * Type for tRPC client error
 */
export type TRPCError = TRPCClientErrorLike<AppRouter>

/**
 * Git status shape for optimistic updates
 */
export interface GitStatusData {
  branch?: string
  staged: Array<{ file: string; status: string }>
  modified: Array<{ file: string; status: string }>
  untracked: string[]
  ahead?: number
  behind?: number
}

/**
 * Optimistically remove files from git status cache.
 * Used after commits to immediately hide committed files.
 */
export function removeFilesFromGitStatus(
  status: GitStatusData | undefined,
  filesToRemove: string[]
): GitStatusData | undefined {
  if (!status) return status

  const removeSet = new Set(filesToRemove)

  return {
    ...status,
    staged: status.staged.filter((f) => !removeSet.has(f.file)),
    modified: status.modified.filter((f) => !removeSet.has(f.file)),
    untracked: status.untracked.filter((f) => !removeSet.has(f)),
  }
}

/**
 * Task list item shape for optimistic updates
 */
export interface TaskListItem {
  path: string
  title: string
  content?: string
  progress?: { done: number; total: number } | null
  archived?: boolean
  archivedDate?: string
}

/**
 * Optimistically move a task to archived state in the list.
 */
export function archiveTaskInList(
  tasks: TaskListItem[] | undefined,
  taskPath: string
): TaskListItem[] | undefined {
  if (!tasks) return tasks

  return tasks.map((task) => {
    if (task.path === taskPath) {
      return {
        ...task,
        archived: true,
        archivedDate: new Date().toISOString(),
      }
    }
    return task
  })
}

/**
 * Optimistically restore a task from archived state.
 */
export function restoreTaskInList(
  tasks: TaskListItem[] | undefined,
  taskPath: string
): TaskListItem[] | undefined {
  if (!tasks) return tasks

  return tasks.map((task) => {
    if (task.path === taskPath) {
      return {
        ...task,
        archived: false,
        archivedDate: undefined,
      }
    }
    return task
  })
}

/**
 * Generate a temporary task path for optimistic creates.
 * Uses timestamp-based slug similar to the server implementation.
 */
export function generateTempTaskPath(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)

  return `tasks/${slug}-temp.md`
}

/**
 * Add a temporary task to the list for optimistic creates.
 */
export function addTempTaskToList(
  tasks: TaskListItem[] | undefined,
  title: string,
  tempPath: string
): TaskListItem[] | undefined {
  if (!tasks) return [{ path: tempPath, title, archived: false }]

  return [{ path: tempPath, title, archived: false }, ...tasks]
}

/**
 * Remove a temporary task from the list (on error rollback).
 */
export function removeTempTaskFromList(
  tasks: TaskListItem[] | undefined,
  tempPath: string
): TaskListItem[] | undefined {
  if (!tasks) return tasks

  return tasks.filter((task) => task.path !== tempPath)
}

/**
 * Session shape for optimistic spawn
 */
export interface SessionListItem {
  id: string
  prompt: string
  title?: string
  status: string
  startedAt: string
  agentType?: string
  model?: string
}

/**
 * Add a placeholder session for optimistic spawn.
 */
export function addPlaceholderSession(
  sessions: SessionListItem[] | undefined,
  sessionId: string,
  prompt: string,
  title: string | undefined,
  agentType: string
): SessionListItem[] | undefined {
  const newSession: SessionListItem = {
    id: sessionId,
    prompt,
    title,
    status: "pending",
    startedAt: new Date().toISOString(),
    agentType,
  }

  if (!sessions) return [newSession]
  return [newSession, ...sessions]
}
