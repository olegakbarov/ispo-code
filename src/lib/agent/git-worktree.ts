/**
 * Git Worktree Service - manages isolated git worktrees per agent session
 */

import { spawnSync } from "child_process"
import { join } from "path"
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs"
import { isGitRepo, getGitRoot } from "./git-service"

export interface WorktreeOptions {
  sessionId: string
  /** Base branch to create worktree from (default: current branch) */
  baseBranch?: string
  /** Repository root (auto-detected if not provided) */
  repoRoot?: string
}

export interface WorktreeInfo {
  /** Path to the worktree directory */
  path: string
  /** Branch name for this worktree */
  branch: string
  /** Session ID this worktree belongs to */
  sessionId: string
}

export interface TaskWorktreeOptions {
  taskId: string
  /** Base branch to create worktree from (default: current branch) */
  baseBranch?: string
  /** Repository root (auto-detected if not provided) */
  repoRoot?: string
}

export interface TaskWorktreeInfo {
  /** Path to the worktree directory */
  path: string
  /** Branch name for this worktree */
  branch: string
  /** Task ID this worktree belongs to */
  taskId: string
}

/**
 * Execute a git command and return result
 */
function runGit(
  args: string[],
  cwd: string,
  options?: { env?: Record<string, string> }
): { ok: boolean; code: number; stdout: string; stderr: string } {
  const res = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: { ...(process.env as Record<string, string>), ...(options?.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  })

  const stdout = res.stdout ?? ""
  const stderr = res.stderr ?? ""
  const code = res.status ?? (res.error ? 1 : 0)

  return { ok: code === 0 && !res.error, code, stdout, stderr }
}

/**
 * Validate worktree branch name
 */
function isValidWorktreeBranch(name: string): boolean {
  if (!name || name.length === 0) return false
  if (!name.startsWith("ispo-code/session-")) return false
  // Additional validation from git-service
  if (name.includes('..') || name.includes('~') || name.includes('^')) return false
  if (name.includes(' ') || name.includes('\n') || name.includes('\t')) return false
  if (/[\\:?*\[\]]/.test(name)) return false
  if (name.endsWith('.lock') || name.includes('@{')) return false
  return true
}

/**
 * Validate task worktree branch name
 */
function isValidTaskWorktreeBranch(name: string): boolean {
  if (!name || name.length === 0) return false
  if (!name.startsWith("ispo-code/task-")) return false
  if (name.includes('..') || name.includes('~') || name.includes('^')) return false
  if (name.includes(' ') || name.includes('\n') || name.includes('\t')) return false
  if (/[\\:?*\[\]]/.test(name)) return false
  if (name.endsWith('.lock') || name.includes('@{')) return false
  return true
}

/**
 * Create a git worktree for an agent session
 *
 * Creates an isolated working directory on a new branch (ispo-code/session-{sessionId})
 * that the agent can modify without affecting other concurrent sessions.
 *
 * @param options - Worktree configuration
 * @returns WorktreeInfo with path and branch, or null if creation failed
 */
export function createWorktree(options: WorktreeOptions): WorktreeInfo | null {
  const { sessionId, baseBranch, repoRoot: providedRepoRoot } = options

  // Detect repository root
  const repoRoot = providedRepoRoot ?? getGitRoot(process.cwd())
  if (!repoRoot || !isGitRepo(repoRoot)) {
    console.error("[git-worktree] Not a git repository")
    return null
  }

  // Generate unique branch name for this session
  const branch = `ispo-code/session-${sessionId}`
  if (!isValidWorktreeBranch(branch)) {
    console.error(`[git-worktree] Invalid branch name: ${branch}`)
    return null
  }

  // Determine base branch (default to current branch)
  let baseBranchResolved = baseBranch
  if (!baseBranchResolved) {
    const currentBranchResult = runGit(["branch", "--show-current"], repoRoot)
    baseBranchResolved = currentBranchResult.stdout.trim() || "HEAD"
  }

  // Create worktree directory (in .git/worktrees managed area)
  const worktreePath = join(repoRoot, ".ispo-code", "worktrees", sessionId)

  // Ensure parent directory exists
  const worktreesDir = join(repoRoot, ".ispo-code", "worktrees")
  try {
    mkdirSync(worktreesDir, { recursive: true })
  } catch (error) {
    console.error("[git-worktree] Failed to create worktrees directory:", error)
    return null
  }

  // Check if branch already exists (cleanup from previous failed session)
  const branchExistsResult = runGit(["rev-parse", "--verify", branch], repoRoot)
  if (branchExistsResult.ok) {
    console.warn(`[git-worktree] Branch ${branch} already exists, deleting...`)
    const deleteBranchResult = runGit(["branch", "-D", branch], repoRoot)
    if (!deleteBranchResult.ok) {
      console.error(`[git-worktree] Failed to delete existing branch: ${deleteBranchResult.stderr}`)
      return null
    }
  }

  // Check if worktree path already exists
  if (existsSync(worktreePath)) {
    console.warn(`[git-worktree] Worktree path ${worktreePath} already exists, removing...`)
    try {
      rmSync(worktreePath, { recursive: true, force: true })
    } catch (error) {
      console.error(`[git-worktree] Failed to remove existing worktree path:`, error)
      return null
    }
  }

  // Create worktree with new branch
  const createResult = runGit(
    ["worktree", "add", "-b", branch, worktreePath, baseBranchResolved],
    repoRoot
  )

  if (!createResult.ok) {
    console.error(`[git-worktree] Failed to create worktree: ${createResult.stderr}`)
    return null
  }

  console.log(`[git-worktree] Created worktree at ${worktreePath} on branch ${branch}`)

  return {
    path: worktreePath,
    branch,
    sessionId,
  }
}

/**
 * Ensure a git worktree exists for a task
 *
 * Reuses existing worktree/branch if present.
 */
export function ensureTaskWorktree(options: TaskWorktreeOptions): TaskWorktreeInfo | null {
  const { taskId, baseBranch, repoRoot: providedRepoRoot } = options

  const repoRoot = providedRepoRoot ?? getGitRoot(process.cwd())
  if (!repoRoot || !isGitRepo(repoRoot)) {
    console.error("[git-worktree] Not a git repository")
    return null
  }

  const branch = `ispo-code/task-${taskId}`
  if (!isValidTaskWorktreeBranch(branch)) {
    console.error(`[git-worktree] Invalid task branch name: ${branch}`)
    return null
  }

  let baseBranchResolved = baseBranch
  if (!baseBranchResolved) {
    const currentBranchResult = runGit(["branch", "--show-current"], repoRoot)
    baseBranchResolved = currentBranchResult.stdout.trim() || "HEAD"
  }

  const worktreesDir = join(repoRoot, ".ispo-code", "worktrees", "tasks")
  const worktreePath = join(worktreesDir, taskId)

  try {
    mkdirSync(worktreesDir, { recursive: true })
  } catch (error) {
    console.error("[git-worktree] Failed to create task worktrees directory:", error)
    return null
  }

  if (existsSync(worktreePath)) {
    return {
      path: worktreePath,
      branch,
      taskId,
    }
  }

  const branchExistsResult = runGit(["rev-parse", "--verify", branch], repoRoot)
  const args = branchExistsResult.ok
    ? ["worktree", "add", worktreePath, branch]
    : ["worktree", "add", "-b", branch, worktreePath, baseBranchResolved]

  const createResult = runGit(args, repoRoot)
  if (!createResult.ok) {
    console.error(`[git-worktree] Failed to create task worktree: ${createResult.stderr}`)
    return null
  }

  console.log(`[git-worktree] Created task worktree at ${worktreePath} on branch ${branch}`)

  return {
    path: worktreePath,
    branch,
    taskId,
  }
}

/**
 * Delete a git worktree
 *
 * Removes the worktree directory and associated branch.
 *
 * @param worktreePath - Path to the worktree to delete
 * @param options - Additional options
 * @returns true if deletion succeeded (or worktree didn't exist)
 */
export function deleteWorktree(
  worktreePath: string,
  options?: { branch?: string; force?: boolean }
): boolean {
  const { branch, force = true } = options ?? {}

  // Find the repository root - try parent directory if worktree doesn't exist
  let repoRoot = existsSync(worktreePath)
    ? getGitRoot(worktreePath)
    : getGitRoot(process.cwd())

  if (!repoRoot) {
    console.error("[git-worktree] Cannot find repository root for worktree")
    return false
  }

  // Remove worktree directory if it exists
  if (existsSync(worktreePath)) {
    const removeArgs = ["worktree", "remove"]
    if (force) {
      removeArgs.push("--force")
    }
    removeArgs.push(worktreePath)

    const removeResult = runGit(removeArgs, repoRoot)
    if (!removeResult.ok) {
      console.error(`[git-worktree] Failed to remove worktree: ${removeResult.stderr}`)
      // Try to manually remove the directory if git failed
      try {
        rmSync(worktreePath, { recursive: true, force: true })
        console.log(`[git-worktree] Manually removed worktree directory`)
      } catch (error) {
        console.error(`[git-worktree] Failed to manually remove worktree:`, error)
        return false
      }
    }
    console.log(`[git-worktree] Deleted worktree at ${worktreePath}`)
  } else {
    console.warn(`[git-worktree] Worktree path ${worktreePath} does not exist, skipping directory removal`)
  }

  // Delete the branch if provided (regardless of whether worktree existed)
  if (branch && isValidWorktreeBranch(branch)) {
    const deleteBranchResult = runGit(["branch", "-D", branch], repoRoot)
    if (!deleteBranchResult.ok) {
      console.warn(`[git-worktree] Failed to delete branch ${branch}: ${deleteBranchResult.stderr}`)
      // Don't fail the entire operation if branch deletion fails
    } else {
      console.log(`[git-worktree] Deleted branch ${branch}`)
    }
  }

  return true
}

/**
 * Detailed worktree information
 */
export interface WorktreeDetails {
  /** Path to the worktree directory */
  path: string
  /** Branch name (null if detached HEAD) */
  branch: string | null
  /** HEAD commit hash */
  head: string
  /** Whether this is a bare repository */
  bare: boolean
  /** Whether this is the main worktree */
  isMain: boolean
}

/**
 * List all worktrees
 *
 * @param repoRoot - Repository root directory
 * @returns Array of worktree paths
 */
export function listWorktrees(repoRoot: string): string[] {
  if (!isGitRepo(repoRoot)) {
    return []
  }

  const listResult = runGit(["worktree", "list", "--porcelain"], repoRoot)
  if (!listResult.ok) {
    console.error(`[git-worktree] Failed to list worktrees: ${listResult.stderr}`)
    return []
  }

  const worktrees: string[] = []
  const lines = listResult.stdout.split("\n")

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      const path = line.substring("worktree ".length).trim()
      worktrees.push(path)
    }
  }

  return worktrees
}

/**
 * List all worktrees with detailed information
 *
 * @param repoRoot - Repository root directory
 * @returns Array of detailed worktree info
 */
export function listWorktreesDetailed(repoRoot: string): WorktreeDetails[] {
  if (!isGitRepo(repoRoot)) {
    return []
  }

  const listResult = runGit(["worktree", "list", "--porcelain"], repoRoot)
  if (!listResult.ok) {
    console.error(`[git-worktree] Failed to list worktrees: ${listResult.stderr}`)
    return []
  }

  const worktrees: WorktreeDetails[] = []
  const lines = listResult.stdout.split("\n")

  let current: Partial<WorktreeDetails> = {}
  let isFirst = true

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      // Save previous worktree if exists
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch ?? null,
          head: current.head ?? "",
          bare: current.bare ?? false,
          isMain: current.isMain ?? false,
        })
      }
      current = {
        path: line.substring("worktree ".length).trim(),
        isMain: isFirst,
      }
      isFirst = false
    } else if (line.startsWith("HEAD ")) {
      current.head = line.substring("HEAD ".length).trim()
    } else if (line.startsWith("branch ")) {
      // Branch format: refs/heads/branch-name
      const ref = line.substring("branch ".length).trim()
      current.branch = ref.replace(/^refs\/heads\//, "")
    } else if (line === "bare") {
      current.bare = true
    } else if (line === "detached") {
      current.branch = null
    }
  }

  // Don't forget the last worktree
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch ?? null,
      head: current.head ?? "",
      bare: current.bare ?? false,
      isMain: current.isMain ?? false,
    })
  }

  return worktrees
}

/**
 * Get worktree info for a session
 *
 * @param sessionId - Session ID
 * @param repoRoot - Repository root directory
 * @returns WorktreeInfo if worktree exists for this session
 */
export function getWorktreeForSession(
  sessionId: string,
  repoRoot: string
): WorktreeInfo | null {
  const expectedPath = join(repoRoot, ".ispo-code", "worktrees", sessionId)
  const expectedBranch = `ispo-code/session-${sessionId}`

  if (!existsSync(expectedPath)) {
    return null
  }

  return {
    path: expectedPath,
    branch: expectedBranch,
    sessionId,
  }
}

/**
 * Get task worktree info for a task ID
 */
export function getTaskWorktreeForId(
  taskId: string,
  repoRoot: string
): TaskWorktreeInfo | null {
  const expectedPath = join(repoRoot, ".ispo-code", "worktrees", "tasks", taskId)
  const expectedBranch = `ispo-code/task-${taskId}`

  if (!existsSync(expectedPath)) {
    return null
  }

  return {
    path: expectedPath,
    branch: expectedBranch,
    taskId,
  }
}

/**
 * Check if worktree isolation is enabled
 *
 * Enabled by default. Set DISABLE_WORKTREE_ISOLATION=true to disable.
 */
export function isWorktreeIsolationEnabled(): boolean {
  return process.env.DISABLE_WORKTREE_ISOLATION !== "true"
}

/**
 * Cleanup orphaned worktrees and branches
 *
 * Removes worktrees that no longer have active sessions, and also cleans up
 * orphaned branches that exist without a corresponding worktree directory.
 * This should be called on server startup to clean up from crashes.
 *
 * @param repoRoot - Repository root directory
 * @param activeSessions - Set of active session IDs
 * @returns Number of worktrees/branches cleaned up
 */
export function cleanupOrphanedWorktrees(
  repoRoot: string,
  activeSessions: Set<string>
): number {
  if (!isGitRepo(repoRoot)) {
    return 0
  }

  let cleanedCount = 0
  const worktreesDir = join(repoRoot, ".ispo-code", "worktrees")

  // Phase 1: Clean up orphaned worktree directories
  if (existsSync(worktreesDir)) {
    try {
      const entries = readdirSync(worktreesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const sessionId = entry.name
        if (activeSessions.has(sessionId)) {
          continue // Session is still active
        }

        const worktreePath = join(worktreesDir, sessionId)
        const branch = `ispo-code/session-${sessionId}`

        console.log(`[git-worktree] Cleaning up orphaned worktree for session ${sessionId}`)
        if (deleteWorktree(worktreePath, { branch, force: true })) {
          cleanedCount++
        }
      }
    } catch (error) {
      console.error("[git-worktree] Failed to cleanup orphaned worktrees:", error)
    }
  }

  // Phase 2: Clean up orphaned branches (branches without worktree directories)
  try {
    const branchResult = runGit(["branch", "--list", "ispo-code/session-*"], repoRoot)
    if (branchResult.ok) {
      const branches = branchResult.stdout
        .split("\n")
        .map((line) => line.trim().replace(/^\*\s*/, "").replace(/^\+\s*/, ""))
        .filter((b) => b.startsWith("ispo-code/session-"))

      for (const branch of branches) {
        // Extract session ID from branch name
        const sessionId = branch.replace("ispo-code/session-", "")
        if (!sessionId) continue

        // Skip if session is active
        if (activeSessions.has(sessionId)) {
          continue
        }

        // Skip if worktree directory exists (already handled in Phase 1)
        const worktreePath = join(worktreesDir, sessionId)
        if (existsSync(worktreePath)) {
          continue
        }

        // This is an orphaned branch - delete it
        console.log(`[git-worktree] Cleaning up orphaned branch ${branch} (no worktree directory)`)
        const deleteResult = runGit(["branch", "-D", branch], repoRoot)
        if (deleteResult.ok) {
          cleanedCount++
          console.log(`[git-worktree] Deleted orphaned branch ${branch}`)
        } else {
          console.warn(`[git-worktree] Failed to delete orphaned branch ${branch}: ${deleteResult.stderr}`)
        }
      }
    }
  } catch (error) {
    console.error("[git-worktree] Failed to cleanup orphaned branches:", error)
  }

  return cleanedCount
}
