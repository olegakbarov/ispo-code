/**
 * Path resolution utilities for agent file operations
 */

import { relative, resolve, isAbsolute } from "path"
import { execSync } from "child_process"

/**
 * Get the git repository root directory
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

  // Calculate path relative to git root
  const gitRoot = getGitRoot(workingDir)
  const repoRelativePath = gitRoot && isAbsolute(absolutePath)
    ? relative(gitRoot, absolutePath)
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
