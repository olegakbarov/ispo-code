/**
 * Path validation utilities for preventing path traversal attacks
 *
 * Ensures agents cannot access files outside their working directory
 */

import { resolve, relative, normalize, sep } from "path"

/**
 * Validate that a file path is within the allowed working directory
 *
 * @param filePath - The file path to validate (absolute or relative)
 * @param workingDir - The working directory to restrict access to
 * @returns The normalized absolute path if valid
 * @throws Error if path traversal is detected
 *
 * @example
 * ```ts
 * // Safe paths
 * validatePath('src/index.ts', '/project') // -> '/project/src/index.ts'
 * validatePath('/project/src/index.ts', '/project') // -> '/project/src/index.ts'
 *
 * // Path traversal attempts (throws)
 * validatePath('../../../etc/passwd', '/project') // throws
 * validatePath('/etc/passwd', '/project') // throws
 * validatePath('src/../../../etc/passwd', '/project') // throws
 * ```
 */
export function validatePath(filePath: string, workingDir: string): string {
  // Normalize both paths to handle . and .. segments
  const normalizedWorkingDir = normalize(resolve(workingDir))
  const normalizedPath = normalize(resolve(normalizedWorkingDir, filePath))

  // Calculate relative path from working dir to target
  const rel = relative(normalizedWorkingDir, normalizedPath)

  // If relative path starts with .., it's trying to escape
  if (rel.startsWith('..' + sep) || rel === '..') {
    throw new Error(
      `Path traversal detected: "${filePath}" attempts to access files outside working directory`
    )
  }

  // Additional check: ensure normalized path starts with working dir
  if (!normalizedPath.startsWith(normalizedWorkingDir + sep) && normalizedPath !== normalizedWorkingDir) {
    throw new Error(
      `Path traversal detected: "${filePath}" resolves outside working directory`
    )
  }

  return normalizedPath
}

/**
 * Validate multiple paths at once
 *
 * @param paths - Array of paths to validate
 * @param workingDir - The working directory to restrict access to
 * @returns Array of normalized absolute paths
 * @throws Error if any path contains path traversal
 */
export function validatePaths(paths: string[], workingDir: string): string[] {
  return paths.map((path) => validatePath(path, workingDir))
}

/**
 * Check if a path is safe without throwing
 *
 * @param filePath - The file path to check
 * @param workingDir - The working directory to restrict access to
 * @returns true if path is safe, false if it contains path traversal
 */
export function isPathSafe(filePath: string, workingDir: string): boolean {
  try {
    validatePath(filePath, workingDir)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize a path by removing dangerous components
 *
 * This is less strict than validatePath - it tries to make the path safe
 * rather than rejecting it. Use validatePath for security-critical operations.
 *
 * @param filePath - The file path to sanitize
 * @returns Sanitized path relative to working directory
 */
export function sanitizePath(filePath: string): string {
  // Remove leading slashes to prevent absolute path access
  let cleaned = filePath.replace(/^\/+/, '')

  // Remove .. segments that could escape
  cleaned = cleaned.split(sep).filter((segment) => segment !== '..').join(sep)

  // Normalize multiple slashes
  cleaned = cleaned.replace(/\/+/g, '/')

  // Remove leading ./
  cleaned = cleaned.replace(/^\.\//, '')

  return cleaned
}
