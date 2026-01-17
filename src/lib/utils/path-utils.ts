/**
 * Path resolution utilities for agent file operations
 */

import { relative, resolve, isAbsolute, dirname } from "path"
import { execSync } from "child_process"
import { readFileSync, statSync } from "fs"

/**
 * Get the git repository root directory.
 * If in a worktree, returns the worktree root (use getMainRepoRoot for main repo).
 */
export function getGitRoot(cwd: string): string | null {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim()
    return root
  } catch {
    return null
  }
}

/**
 * Get the main repository root, even when in a worktree.
 * For worktrees, this returns the parent repo root, not the worktree root.
 */
export function getMainRepoRoot(cwd: string): string | null {
  try {
    // First get the git directory
    const gitDir = execSync("git rev-parse --git-dir", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim()

    // Resolve to absolute path
    const absoluteGitDir = isAbsolute(gitDir) ? gitDir : resolve(cwd, gitDir)

    // Check if .git is a file (worktree) or directory (main repo)
    const stat = statSync(absoluteGitDir)

    if (stat.isFile()) {
      // This is a worktree - .git file contains path to main repo's .git
      const gitFileContent = readFileSync(absoluteGitDir, "utf-8").trim()
      // Format: "gitdir: /path/to/main/repo/.git/worktrees/name"
      const match = gitFileContent.match(/^gitdir:\s*(.+)$/)
      if (match) {
        const worktreeGitDir = match[1]
        // Go up from .git/worktrees/name to get main repo root
        // worktreeGitDir is like: /main/repo/.git/worktrees/session-id
        const mainGitDir = resolve(worktreeGitDir, "../..") // up to .git
        return dirname(mainGitDir) // parent of .git is repo root
      }
    }

    // Regular repo - just get the toplevel
    return getGitRoot(cwd)
  } catch {
    return getGitRoot(cwd)
  }
}

/**
 * Calculate relative paths for a file
 */
export function calculateRelativePaths(
  absolutePath: string,
  workingDir: string
): {
  relativePath: string
  repoRelativePath: string | null
} {
  // Calculate path relative to working directory
  const relativePath = isAbsolute(absolutePath)
    ? relative(workingDir, absolutePath)
    : absolutePath

  // Calculate path relative to main repo root (handles worktrees correctly)
  const mainRepoRoot = getMainRepoRoot(workingDir)
  const repoRelativePath = mainRepoRoot && isAbsolute(absolutePath)
    ? relative(mainRepoRoot, absolutePath)
    : null

  return { relativePath, repoRelativePath: repoRelativePath || relativePath }
}

/**
 * Resolve a relative path to absolute based on working directory
 */
export function resolveWorkingPath(
  pathStr: string,
  workingDir: string
): string {
  return isAbsolute(pathStr) ? pathStr : resolve(workingDir, pathStr)
}
