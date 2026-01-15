/**
 * Git Worktree Service - manages isolated git worktrees per agent session
 */

import { spawnSync } from "child_process"
import { join } from "path"
import { existsSync, mkdirSync, rmSync } from "fs"
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
  if (!name.startsWith("agentz/session-")) return false
  // Additional validation from git-service
  if (name.includes('..') || name.includes('~') || name.includes('^')) return false
  if (name.includes(' ') || name.includes('\n') || name.includes('\t')) return false
  if (/[\\:?*\[\]]/.test(name)) return false
  if (name.endsWith('.lock') || name.includes('@{')) return false
  return true
}

/**
 * Create a git worktree for an agent session
 *
 * Creates an isolated working directory on a new branch (agentz/session-{sessionId})
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
  const branch = `agentz/session-${sessionId}`
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
  const worktreePath = join(repoRoot, ".agentz", "worktrees", sessionId)

  // Ensure parent directory exists
  const worktreesDir = join(repoRoot, ".agentz", "worktrees")
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
 * Delete a git worktree
 *
 * Removes the worktree directory and associated branch.
 *
 * @param worktreePath - Path to the worktree to delete
 * @param options - Additional options
 * @returns true if deletion succeeded
 */
export function deleteWorktree(
  worktreePath: string,
  options?: { branch?: string; force?: boolean }
): boolean {
  const { branch, force = true } = options ?? {}

  if (!existsSync(worktreePath)) {
    console.warn(`[git-worktree] Worktree path ${worktreePath} does not exist`)
    return false
  }

  // Find the repository root for this worktree
  const repoRoot = getGitRoot(worktreePath)
  if (!repoRoot) {
    console.error("[git-worktree] Cannot find repository root for worktree")
    return false
  }

  // Remove worktree
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

  // Delete the branch if provided
  if (branch && isValidWorktreeBranch(branch)) {
    const deleteBranchResult = runGit(["branch", "-D", branch], repoRoot)
    if (!deleteBranchResult.ok) {
      console.warn(`[git-worktree] Failed to delete branch ${branch}: ${deleteBranchResult.stderr}`)
      // Don't fail the entire operation if branch deletion fails
    } else {
      console.log(`[git-worktree] Deleted branch ${branch}`)
    }
  }

  console.log(`[git-worktree] Deleted worktree at ${worktreePath}`)
  return true
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
  const expectedPath = join(repoRoot, ".agentz", "worktrees", sessionId)
  const expectedBranch = `agentz/session-${sessionId}`

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
 * Check if worktree isolation is enabled
 *
 * Enabled by default. Set DISABLE_WORKTREE_ISOLATION=true to disable.
 */
export function isWorktreeIsolationEnabled(): boolean {
  return process.env.DISABLE_WORKTREE_ISOLATION !== "true"
}

/**
 * Cleanup orphaned worktrees
 *
 * Removes worktrees that no longer have active sessions.
 * This should be called on server startup to clean up from crashes.
 *
 * @param repoRoot - Repository root directory
 * @param activeSessions - Set of active session IDs
 * @returns Number of worktrees cleaned up
 */
export function cleanupOrphanedWorktrees(
  repoRoot: string,
  activeSessions: Set<string>
): number {
  if (!isGitRepo(repoRoot)) {
    return 0
  }

  const worktreesDir = join(repoRoot, ".agentz", "worktrees")
  if (!existsSync(worktreesDir)) {
    return 0
  }

  let cleanedCount = 0

  try {
    const { readdirSync } = require("fs")
    const entries = readdirSync(worktreesDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const sessionId = entry.name
      if (activeSessions.has(sessionId)) {
        continue // Session is still active
      }

      const worktreePath = join(worktreesDir, sessionId)
      const branch = `agentz/session-${sessionId}`

      console.log(`[git-worktree] Cleaning up orphaned worktree for session ${sessionId}`)
      if (deleteWorktree(worktreePath, { branch, force: true })) {
        cleanedCount++
      }
    }
  } catch (error) {
    console.error("[git-worktree] Failed to cleanup orphaned worktrees:", error)
  }

  return cleanedCount
}
