/**
 * Git Service - wrapper for git commands
 */

import { execSync, spawnSync } from "child_process"
import { readFileSync, writeFileSync, unlinkSync } from "fs"
import { join, resolve, relative } from "path"
import { tmpdir } from "os"
import { match } from 'ts-pattern'

// === Types ===

export interface GitFileStatus {
  file: string
  status: "added" | "modified" | "deleted" | "renamed" | "copied"
}

export interface GitStatus {
  branch: string
  staged: GitFileStatus[]
  modified: GitFileStatus[]
  untracked: string[]
  ahead: number
  behind: number
}

export interface GitRemotesInfo {
  remotes: string[]
  defaultRemote: string | null
  upstream: string | null
}

export interface FileDiff {
  file: string
  oldContent: string
  newContent: string
  isNew: boolean
  isDeleted: boolean
  isBinary: boolean
  isImage?: boolean
}

export type GitDiffView = "auto" | "staged" | "working"

// === Helper Functions ===

/**
 * Check if a file is an image based on extension
 */
function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() || ''
  return ['gif', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
}

/**
 * Execute a git command and return stdout
 */
function execGit(
  cmd: string,
  cwd: string,
  options?: { trim?: boolean }
): string {
  const { trim = true } = options ?? {}

  try {
    const output = execSync(`git ${cmd}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30000,
    })
    return trim ? output.trim() : output
  } catch (error) {
    const err = error as { stderr?: string; message: string }
    throw new Error(`Git command failed: ${sanitizeError(err.stderr || err.message)}`)
  }
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeError(message: string): string {
  // Handle paths with spaces, parentheses, and special characters
  let sanitized = message.replace(/\/[^\s:]+/g, (match) => {
    const parts = match.split('/')
    return parts[parts.length - 1] || match
  })
  sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@/g, 'https://***:***@')
  return sanitized
}

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
 * Check if a directory is a git repository
 */
export function isGitRepo(cwd: string): boolean {
  try {
    execGit("rev-parse --is-inside-work-tree", cwd)
    return true
  } catch {
    return false
  }
}

/**
 * Parse git status character into status type
 */
function parseGitStatus(char: string): GitFileStatus["status"] {
  return match(char)
    .with("A", () => "added" as const)
    .with("M", () => "modified" as const)
    .with("D", () => "deleted" as const)
    .with("R", () => "renamed" as const)
    .with("C", () => "copied" as const)
    .otherwise(() => "modified" as const)
}

/**
 * Validate branch name against git ref naming rules
 */
function isValidBranchName(name: string): boolean {
  if (!name || name.length === 0) return false
  if (name.startsWith('-') || name.startsWith('.')) return false
  if (name.includes('..') || name.includes('~') || name.includes('^')) return false
  if (name.includes(' ') || name.includes('\n') || name.includes('\t')) return false
  if (/[\\:?*\[\]]/.test(name)) return false
  if (name.endsWith('.lock') || name.includes('@{')) return false
  return true
}

/**
 * Validate that a file path is safe (within repo root)
 */
function isPathSafe(repoRoot: string, filePath: string): boolean {
  const absolutePath = resolve(repoRoot, filePath)
  const relativePath = relative(repoRoot, absolutePath)
  return !relativePath.startsWith('..') && !relative(repoRoot, absolutePath).startsWith('/')
}

// === Query Functions ===

/**
 * Get current git status
 */
export function getGitStatus(cwd: string): GitStatus {
  if (!isGitRepo(cwd)) {
    return {
      branch: "",
      staged: [],
      modified: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    }
  }

  const branch = execGit("branch --show-current", cwd) || "HEAD"
  // Use porcelain v2 format with null-byte delimiters for robust parsing
  const status = execGit("status --porcelain=v2 -z -u", cwd, { trim: false })

  const staged: GitFileStatus[] = []
  const modified: GitFileStatus[] = []
  const untracked: string[] = []

  // Parse porcelain v2 format entries (null-byte delimited)
  const entries = status.split("\0").filter(Boolean)

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue

    // Handle branch headers (# branch.oid, # branch.head, etc.)
    if (entry.startsWith("#")) {
      continue
    }

    // Ordinary changed entries: "1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>"
    // Rename/copy entries: "2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>"
    // Unmerged entries: "u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>"
    // Untracked entries: "? <path>"
    // Ignored entries: "! <path>"

    if (entry.startsWith("? ")) {
      // Untracked file
      const file = entry.slice(2)
      untracked.push(file)
      continue
    }

    if (entry.startsWith("! ")) {
      // Ignored file - skip
      continue
    }

    // Parse regular and rename/copy entries
    const parts = entry.split(" ")
    if (parts.length < 2) continue

    const entryType = parts[0] // "1", "2", or "u"
    const xyStatus = parts[1] // Two-character status code

    if (!xyStatus || xyStatus.length < 2) continue

    const indexStatus = xyStatus[0]
    const worktreeStatus = xyStatus[1]

    let file = ""

    if (entryType === "2") {
      // Rename or copy entry: path is at index 9, old path is in next null-delimited entry
      file = parts.slice(9).join(" ")
      // Skip the old path entry (we only need the new path for operations)
      i++
    } else if (entryType === "1") {
      // Ordinary entry: path is at index 8
      file = parts.slice(8).join(" ")
    } else if (entryType === "u") {
      // Unmerged entry: path is at index 10
      file = parts.slice(10).join(" ")
    }

    if (!file) continue

    // Process staged changes (index status)
    if (indexStatus !== "." && indexStatus !== " ") {
      staged.push({
        file, // Always use the new path
        status: parseGitStatus(indexStatus),
      })
    }

    // Process working tree changes
    if (worktreeStatus === "M") {
      modified.push({ file, status: "modified" })
    } else if (worktreeStatus === "D") {
      modified.push({ file, status: "deleted" })
    }
  }

  let ahead = 0
  let behind = 0
  try {
    const tracking = execGit("rev-list --left-right --count HEAD...@{upstream}", cwd)
    const [aheadStr, behindStr] = tracking.split("\t")
    ahead = parseInt(aheadStr, 10) || 0
    behind = parseInt(behindStr, 10) || 0
  } catch {
    // No upstream configured
  }

  return { branch, staged, modified, untracked, ahead, behind }
}

/**
 * Get list of branches
 */
export function getBranches(cwd: string): { current: string; all: string[] } {
  if (!isGitRepo(cwd)) {
    return { current: "", all: [] }
  }

  const current = execGit("branch --show-current", cwd) || "HEAD"
  const allOutput = execGit("branch -a --format='%(refname:short)'", cwd)
  const all = allOutput.split("\n").filter(Boolean).map((b) => b.replace(/^'|'$/g, ""))

  return { current, all }
}

/**
 * Get recent commits
 */
export function getRecentCommits(
  cwd: string,
  limit = 10
): Array<{ hash: string; message: string; author: string; date: string }> {
  if (!isGitRepo(cwd)) {
    return []
  }

  try {
    // Use NUL byte delimiter to avoid collision with commit messages
    const log = execGit(`log -n ${limit} --format="%h%x00%B%x00%an%x00%ar%x00"`, cwd, { trim: false })
    return log.split("\x00\n").filter(Boolean).map((entry) => {
      const [hash, message, author, date] = entry.split("\x00")
      return {
        hash: (hash || '').trim(),
        message: (message || '').trim(),
        author: (author || '').trim(),
        date: (date || '').trim()
      }
    })
  } catch {
    return []
  }
}

/**
 * Get commits that touched specific files
 */
export function getCommitsForFiles(
  cwd: string,
  files: string[],
  limit = 50
): Array<{
  hash: string
  message: string
  author: string
  date: string
  timestamp: number
  files: string[]
}> {
  if (!isGitRepo(cwd)) {
    return []
  }
  if (files.length === 0) {
    return []
  }

  const repoRoot = getGitRoot(cwd) ?? cwd

  // Validate all file paths
  for (const file of files) {
    if (!isPathSafe(repoRoot, file)) {
      throw new Error(`Invalid file path: ${file}`)
    }
  }

  try {
    // Get commits that touched any of these files
    // Format: hash, message, author, timestamp, date, NUL, files touched (one per line)
    const args = [
      'log',
      '-n', String(limit),
      '--format=%h%x00%B%x00%an%x00%at%x00%ar%x00',
      '--name-only',
      '--',
      ...files
    ]

    const log = execGit(args.join(' '), cwd, { trim: false })

    // Parse the log output
    const commits: Array<{
      hash: string
      message: string
      author: string
      date: string
      timestamp: number
      files: string[]
    }> = []

    // Split by double newline (separates commits)
    const entries = log.split('\x00\n').filter(Boolean)

    for (const entry of entries) {
      const lines = entry.split('\n')
      if (lines.length === 0) continue

      // First line has the commit metadata
      const metadata = lines[0]?.split('\x00')
      if (!metadata || metadata.length < 5) continue

      const [hash, message, author, timestampStr, date] = metadata
      const timestamp = parseInt(timestampStr || '0', 10)

      // Remaining lines are the files (skip empty lines)
      const touchedFiles = lines.slice(1).filter(Boolean)

      commits.push({
        hash: (hash || '').trim(),
        message: (message || '').trim(),
        author: (author || '').trim(),
        date: (date || '').trim(),
        timestamp,
        files: touchedFiles
      })
    }

    return commits
  } catch {
    return []
  }
}

/**
 * Get git remotes info
 */
export function getGitRemotes(cwd: string): GitRemotesInfo {
  if (!isGitRepo(cwd)) {
    return { remotes: [], defaultRemote: null, upstream: null }
  }

  const remotesOutput = execGit("remote", cwd)
  const remotes = remotesOutput
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)

  const defaultRemote = remotes.includes("origin") ? "origin" : remotes[0] ?? null

  let upstream: string | null = null
  try {
    upstream = execGit("rev-parse --abbrev-ref --symbolic-full-name @{upstream}", cwd)
  } catch {
    upstream = null
  }

  return { remotes, defaultRemote, upstream }
}

/**
 * Get the root directory of the git repo
 */
export function getGitRoot(cwd: string): string | null {
  if (!isGitRepo(cwd)) {
    return null
  }
  return execGit("rev-parse --show-toplevel", cwd)
}

/**
 * Get repo-root-relative prefix for the current working directory
 */
export function getCwdPrefix(cwd: string): string {
  const root = getGitRoot(cwd)
  if (!root) return ""
  const relPath = relative(root, cwd)
  // Validate that cwd is within repo
  if (relPath.startsWith('..') || relPath.startsWith('/')) {
    throw new Error('Working directory is outside repository root')
  }
  if (!relPath || relPath === ".") return ""
  return relPath.replace(/\\/g, "/")
}

// === Mutation Functions ===

/**
 * Stage files for commit
 */
export function stageFiles(cwd: string, files: string[]): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (files.length === 0) {
    return { success: false, error: "No files specified" }
  }

  // Validate that all files are in git status (staged, modified, or untracked)
  const status = getGitStatus(cwd)
  const validFiles = new Set([
    ...status.staged.map(f => f.file),
    ...status.modified.map(f => f.file),
    ...status.untracked
  ])

  const invalidFiles = files.filter(f => !validFiles.has(f))
  if (invalidFiles.length > 0) {
    return { success: false, error: `Files not in git status: ${invalidFiles.join(', ')}` }
  }

  const result = runGit(["add", "--", ...files], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true }
}

/**
 * Unstage files (remove from staging area)
 */
export function unstageFiles(cwd: string, files: string[]): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (files.length === 0) {
    return { success: false, error: "No files specified" }
  }

  // Validate that all files are actually staged
  const status = getGitStatus(cwd)
  const stagedFiles = new Set(status.staged.map(f => f.file))

  const notStagedFiles = files.filter(f => !stagedFiles.has(f))
  if (notStagedFiles.length > 0) {
    return { success: false, error: `Files not staged: ${notStagedFiles.join(', ')}` }
  }

  const result = runGit(["restore", "--staged", "--", ...files], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true }
}

/**
 * Commit staged changes
 */
export function commitChanges(cwd: string, message: string): { success: boolean; hash?: string; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!message.trim()) {
    return { success: false, error: "Commit message is required" }
  }

  const tmpFile = join(tmpdir(), `commit-msg-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)

  try {
    writeFileSync(tmpFile, message, { encoding: "utf-8", mode: 0o600 })
    const result = runGit(["commit", "-F", tmpFile], cwd)

    if (!result.ok) {
      return { success: false, error: sanitizeError(result.stderr || result.stdout) }
    }

    const hashResult = runGit(["rev-parse", "--short", "HEAD"], cwd)
    const hash = hashResult.ok ? hashResult.stdout.trim() : undefined

    return { success: true, hash }
  } catch (error) {
    return { success: false, error: sanitizeError((error as Error).message) }
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get diffs for multiple files
 */
export function getDiffForFiles(
  cwd: string,
  files: string[],
  view: GitDiffView = "auto"
): Record<string, FileDiff> {
  const result: Record<string, FileDiff> = {}

  for (const file of files) {
    result[file] = getFileDiff(cwd, file, view)
  }

  return result
}

/**
 * Commit changes with specific files (scoped commit)
 */
export function commitScopedChanges(
  cwd: string,
  files: string[],
  message: string
): { success: boolean; hash?: string; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!message.trim()) {
    return { success: false, error: "Commit message is required" }
  }
  if (files.length === 0) {
    return { success: false, error: "At least one file must be specified" }
  }

  const repoRoot = execGit("rev-parse --show-toplevel", cwd)

  // Validate all file paths
  for (const file of files) {
    if (!isPathSafe(repoRoot, file)) {
      return { success: false, error: `Invalid file path: ${file}` }
    }
  }

  const tmpFile = join(tmpdir(), `commit-msg-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)

  try {
    // Stage only the specified files
    const stageResult = runGit(["add", ...files], cwd)
    if (!stageResult.ok) {
      return { success: false, error: sanitizeError(stageResult.stderr || stageResult.stdout) }
    }

    // Commit the staged files
    writeFileSync(tmpFile, message, { encoding: "utf-8", mode: 0o600 })
    const commitResult = runGit(["commit", "-F", tmpFile], cwd)

    if (!commitResult.ok) {
      return { success: false, error: sanitizeError(commitResult.stderr || commitResult.stdout) }
    }

    const hashResult = runGit(["rev-parse", "--short", "HEAD"], cwd)
    const hash = hashResult.ok ? hashResult.stdout.trim() : undefined

    return { success: true, hash }
  } catch (error) {
    return { success: false, error: sanitizeError((error as Error).message) }
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Checkout a branch
 */
export function checkoutBranch(cwd: string, branch: string): { success: boolean; error?: string; hasUncommittedChanges?: boolean } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!branch.trim()) {
    return { success: false, error: "Branch name is required" }
  }
  if (!isValidBranchName(branch)) {
    return { success: false, error: "Invalid branch name" }
  }

  // Check for uncommitted changes that might be lost
  const status = getGitStatus(cwd)
  const hasUncommittedChanges = status.staged.length > 0 || status.modified.length > 0 || status.untracked.length > 0

  const result = runGit(["checkout", branch], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout), hasUncommittedChanges }
  }

  return { success: true, hasUncommittedChanges }
}

/**
 * Discard changes in working directory (destructive!)
 *
 * WARNING: This permanently discards uncommitted changes!
 */
export function discardChanges(cwd: string, files: string[]): { success: boolean; error?: string; warning?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (files.length === 0) {
    return { success: false, error: "No files specified" }
  }

  // Validate that files exist in modified list
  const status = getGitStatus(cwd)
  const modifiedFiles = new Set(status.modified.map(f => f.file))

  const notModifiedFiles = files.filter(f => !modifiedFiles.has(f))
  if (notModifiedFiles.length > 0) {
    return { success: false, error: `Files not modified: ${notModifiedFiles.join(', ')}` }
  }

  const result = runGit(["restore", "--", ...files], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true, warning: 'Changes discarded permanently' }
}

/**
 * Create a new branch
 */
export function createBranch(cwd: string, branch: string): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!branch.trim()) {
    return { success: false, error: "Branch name is required" }
  }
  if (!isValidBranchName(branch)) {
    return { success: false, error: "Invalid branch name" }
  }

  const result = runGit(["checkout", "-b", branch], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true }
}

/**
 * Push to remote
 */
export function pushToRemote(
  cwd: string,
  options?: { remote?: string; branch?: string; setUpstream?: boolean }
): { success: boolean; output: string; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, output: "", error: "Not a git repository" }
  }

  const localBranch = (options?.branch?.trim() || execGit("branch --show-current", cwd) || "").trim()
  if (!localBranch) {
    return { success: false, output: "", error: "No current branch (detached HEAD). Cannot push." }
  }

  const remotesInfo = getGitRemotes(cwd)
  if (remotesInfo.remotes.length === 0) {
    return { success: false, output: "", error: "No git remotes configured." }
  }

  const upstream = remotesInfo.upstream
  const wantsSetUpstream = options?.setUpstream ?? !upstream

  const remote =
    options?.remote?.trim() ||
    (upstream ? upstream.split("/")[0] : remotesInfo.defaultRemote) ||
    remotesInfo.remotes[0]

  if (!remote) {
    return { success: false, output: "", error: "No git remotes configured." }
  }

  const args =
    wantsSetUpstream || !upstream
      ? ["push", "-u", remote, localBranch]
      : options?.remote || options?.branch
        ? ["push", remote, localBranch]
        : ["push"]

  const result = runGit(args, cwd, {
    env: {
      GIT_TERMINAL_PROMPT: "0",
      GCM_INTERACTIVE: "Never",
    },
  })

  const output = `${result.stdout}${result.stderr}`.trim()
  if (!result.ok) {
    return {
      success: false,
      output,
      error: output || `git ${args.join(" ")} failed (exit code ${result.code})`,
    }
  }

  return { success: true, output: output || "Push completed." }
}

// === Diff Functions ===

/**
 * Get diff for a specific file
 */
export function getFileDiff(
  cwd: string,
  file: string,
  view: GitDiffView = "auto"
): FileDiff {
  if (!isGitRepo(cwd)) {
    return {
      file,
      oldContent: "",
      newContent: "",
      isNew: false,
      isDeleted: false,
      isBinary: false,
    }
  }

  const repoRoot = getGitRoot(cwd) ?? cwd

  if (!isPathSafe(repoRoot, file)) {
    throw new Error(`Path traversal detected: ${file}`)
  }

  const safeExec = (cmd: string) => {
    try {
      return execGit(cmd, cwd)
    } catch {
      return ""
    }
  }

  const stagedNameStatus = safeExec(
    `diff --no-ext-diff --no-textconv --name-status --cached -- "${file}"`
  )
  const workingNameStatus = safeExec(
    `diff --no-ext-diff --no-textconv --name-status -- "${file}"`
  )
  const untrackedOutput = safeExec(`ls-files --others --exclude-standard -- "${file}"`)

  const isUntracked = untrackedOutput.split("\n").some((line) => line.trim() === file)
  const hasStaged = stagedNameStatus.trim().length > 0
  const hasWorking = workingNameStatus.trim().length > 0 || isUntracked

  const isDeleted =
    stagedNameStatus.split("\n").some((line) => line.startsWith("D\t")) ||
    workingNameStatus.split("\n").some((line) => line.startsWith("D\t"))

  const useStagedVersion =
    view === "staged" ? hasStaged : view === "working" ? false : hasStaged

  // Check if file is binary - only for files that exist in HEAD or index
  let isBinary = false
  if (!isUntracked) {
    try {
      const isBinaryCheck = execGit(`diff --no-ext-diff --no-textconv --numstat HEAD -- "${file}"`, cwd)
      if (isBinaryCheck.startsWith("-\t-\t")) {
        isBinary = true

        // For image files, read binary content as base64 data URLs
        if (isImageFile(file)) {
          const getMimeType = (filename: string): string => {
            const ext = filename.toLowerCase().split('.').pop() || ''
            const mimeTypes: Record<string, string> = {
              'gif': 'image/gif',
              'png': 'image/png',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'webp': 'image/webp',
              'svg': 'image/svg+xml',
              'bmp': 'image/bmp',
              'ico': 'image/x-icon',
            }
            return mimeTypes[ext] || 'application/octet-stream'
          }

          let oldImageContent = ""
          let newImageContent = ""

          // Get old image (from HEAD)
          try {
            const oldBuffer = Buffer.from(execGit(`show HEAD:"${file}"`, cwd, { trim: false }), 'binary')
            oldImageContent = `data:${getMimeType(file)};base64,${oldBuffer.toString('base64')}`
          } catch {
            // Old version doesn't exist (new image)
          }

          // Get new image (from working directory or staged)
          if (!isDeleted) {
            try {
              if (useStagedVersion) {
                const newBuffer = Buffer.from(execGit(`show :"${file}"`, cwd, { trim: false }), 'binary')
                newImageContent = `data:${getMimeType(file)};base64,${newBuffer.toString('base64')}`
              } else {
                const newBuffer = readFileSync(join(repoRoot, file))
                newImageContent = `data:${getMimeType(file)};base64,${newBuffer.toString('base64')}`
              }
            } catch {
              // Failed to read new image
            }
          }

          return {
            file,
            oldContent: oldImageContent,
            newContent: newImageContent,
            isNew: !oldImageContent && !!newImageContent,
            isDeleted,
            isBinary: true,
            isImage: true,
          }
        }

        // For non-image binary files, return empty content
        return {
          file,
          oldContent: "",
          newContent: "",
          isNew: false,
          isDeleted: false,
          isBinary: true,
        }
      }
    } catch {
      // File might not exist in HEAD, that's okay
    }
  }

  let oldContent = ""
  let newContent = ""
  let existsInHead = false

  if (!isUntracked) {
    try {
      oldContent = execGit(`show HEAD:"${file}"`, cwd, { trim: false })
      existsInHead = true
    } catch {
      // File doesn't exist in HEAD (new file)
    }
  }

  if (isDeleted) {
    newContent = ""
  } else if (useStagedVersion) {
    try {
      newContent = execGit(`show :"${file}"`, cwd, { trim: false })
    } catch {
      newContent = ""
    }
  } else {
    try {
      newContent = readFileSync(join(repoRoot, file), "utf-8")
    } catch {
      newContent = ""
    }
  }

  return {
    file,
    oldContent,
    newContent,
    isNew: !existsInHead && !isDeleted && (isUntracked || hasStaged || hasWorking),
    isDeleted,
    isBinary: false,
  }
}

/**
 * Get staged file diff (legacy - kept for compatibility)
 */
export function getStagedDiff(workingDir: string, filePath: string): string {
  try {
    return execSync(`git diff --cached -- "${filePath}"`, {
      cwd: workingDir,
      encoding: "utf-8",
    })
  } catch {
    return ""
  }
}

// === Additional Git Operations ===

/**
 * Fetch from remote
 */
export function fetchFromRemote(
  cwd: string,
  options?: { remote?: string; prune?: boolean }
): { success: boolean; output: string; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, output: "", error: "Not a git repository" }
  }

  const remotesInfo = getGitRemotes(cwd)
  if (remotesInfo.remotes.length === 0) {
    return { success: false, output: "", error: "No git remotes configured." }
  }

  const remote = options?.remote?.trim() || remotesInfo.defaultRemote || remotesInfo.remotes[0]
  if (!remote) {
    return { success: false, output: "", error: "No git remotes configured." }
  }

  const args = ["fetch", remote]
  if (options?.prune) {
    args.push("--prune")
  }

  const result = runGit(args, cwd)

  const output = `${result.stdout}${result.stderr}`.trim()
  if (!result.ok) {
    return {
      success: false,
      output,
      error: output || `git ${args.join(" ")} failed (exit code ${result.code})`,
    }
  }

  return { success: true, output: output || "Fetch completed." }
}

/**
 * Pull from remote (fetch + merge)
 */
export function pullFromRemote(
  cwd: string,
  options?: { remote?: string; branch?: string; rebase?: boolean }
): { success: boolean; output: string; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, output: "", error: "Not a git repository" }
  }

  const remotesInfo = getGitRemotes(cwd)
  if (remotesInfo.remotes.length === 0) {
    return { success: false, output: "", error: "No git remotes configured." }
  }

  const remote = options?.remote?.trim() || remotesInfo.defaultRemote || remotesInfo.remotes[0]
  if (!remote) {
    return { success: false, output: "", error: "No git remotes configured." }
  }

  const args = ["pull"]
  if (options?.rebase) {
    args.push("--rebase")
  }
  args.push(remote)
  if (options?.branch) {
    args.push(options.branch)
  }

  const result = runGit(args, cwd)

  const output = `${result.stdout}${result.stderr}`.trim()
  if (!result.ok) {
    return {
      success: false,
      output,
      error: output || `git ${args.join(" ")} failed (exit code ${result.code})`,
    }
  }

  return { success: true, output: output || "Pull completed." }
}

/**
 * Delete a branch
 */
export function deleteBranch(
  cwd: string,
  branch: string,
  options?: { force?: boolean }
): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!branch.trim()) {
    return { success: false, error: "Branch name is required" }
  }
  if (!isValidBranchName(branch)) {
    return { success: false, error: "Invalid branch name" }
  }

  // Prevent deleting current branch
  const currentBranch = execGit("branch --show-current", cwd) || "HEAD"
  if (branch === currentBranch) {
    return { success: false, error: "Cannot delete the currently checked out branch" }
  }

  const args = ["branch", options?.force ? "-D" : "-d", branch]
  const result = runGit(args, cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true }
}

/**
 * Check for merge conflicts
 */
export function hasMergeConflicts(cwd: string): boolean {
  if (!isGitRepo(cwd)) {
    return false
  }

  try {
    const conflicted = execGit("diff --name-only --diff-filter=U", cwd)
    return conflicted.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Get list of conflicted files
 */
export function getConflictedFiles(cwd: string): string[] {
  if (!isGitRepo(cwd)) {
    return []
  }

  try {
    const conflicted = execGit("diff --name-only --diff-filter=U", cwd)
    return conflicted.split("\n").filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Check if a branch exists (locally)
 */
export function branchExists(cwd: string, branch: string): boolean {
  if (!isGitRepo(cwd)) {
    return false
  }
  if (!branch.trim() || !isValidBranchName(branch)) {
    return false
  }

  const result = runGit(["rev-parse", "--verify", branch], cwd)
  return result.ok
}

// === Merge/Revert Operations ===

/**
 * Merge result from mergeBranch operation
 */
export interface MergeResult {
  success: boolean
  mergeCommitHash?: string
  error?: string
  hasConflicts?: boolean
}

/**
 * Merge a source branch into the target branch (typically main).
 * Uses --no-ff to always create a merge commit for clean reverts.
 *
 * @param cwd - Working directory
 * @param targetBranch - Branch to merge into (e.g., "main")
 * @param sourceBranch - Branch to merge from (e.g., "ispo-code/session-abc123")
 * @returns Merge result with commit hash or error
 */
export function mergeBranch(
  cwd: string,
  targetBranch: string,
  sourceBranch: string
): MergeResult {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!targetBranch.trim()) {
    return { success: false, error: "Target branch name is required" }
  }
  if (!sourceBranch.trim()) {
    return { success: false, error: "Source branch name is required" }
  }
  if (!isValidBranchName(targetBranch)) {
    return { success: false, error: "Invalid target branch name" }
  }
  if (!isValidBranchName(sourceBranch)) {
    return { success: false, error: "Invalid source branch name" }
  }

  // Check if source branch exists before attempting merge
  if (!branchExists(cwd, sourceBranch)) {
    return { success: false, error: `Branch '${sourceBranch}' does not exist. The worktree may have been deleted or worktree isolation was disabled.` }
  }

  // Check if target branch exists
  if (!branchExists(cwd, targetBranch)) {
    return { success: false, error: `Target branch '${targetBranch}' does not exist.` }
  }

  // Save current branch to return to later
  const currentBranch = execGit("branch --show-current", cwd) || "HEAD"

  try {
    // Checkout target branch first
    const checkoutResult = runGit(["checkout", targetBranch], cwd)
    if (!checkoutResult.ok) {
      return { success: false, error: sanitizeError(checkoutResult.stderr || checkoutResult.stdout) }
    }

    // Merge source branch with --no-ff to create merge commit
    const mergeResult = runGit(["merge", "--no-ff", sourceBranch, "-m", `Merge branch '${sourceBranch}' into ${targetBranch}`], cwd)

    if (!mergeResult.ok) {
      // Check if merge failed due to conflicts
      if (hasMergeConflicts(cwd)) {
        // Abort the merge
        runGit(["merge", "--abort"], cwd)
        // Return to original branch
        runGit(["checkout", currentBranch], cwd)
        return { success: false, error: "Merge conflicts detected", hasConflicts: true }
      }
      // Other merge error
      runGit(["checkout", currentBranch], cwd)
      return { success: false, error: sanitizeError(mergeResult.stderr || mergeResult.stdout) }
    }

    // Get the merge commit hash
    const hashResult = runGit(["rev-parse", "HEAD"], cwd)
    const mergeCommitHash = hashResult.ok ? hashResult.stdout.trim() : undefined

    // Return to original branch
    if (currentBranch !== targetBranch) {
      runGit(["checkout", currentBranch], cwd)
    }

    return { success: true, mergeCommitHash }
  } catch (error) {
    // Ensure we return to original branch on any error
    try {
      runGit(["checkout", currentBranch], cwd)
    } catch {
      // Ignore checkout failure during error handling
    }
    return { success: false, error: sanitizeError((error as Error).message) }
  }
}

/**
 * Get the last merge commit on a branch.
 * Useful for finding the commit to revert.
 *
 * @param cwd - Working directory
 * @param branch - Branch to check (defaults to current)
 * @returns Merge commit info or null if no merge commits found
 */
export function getLastMergeCommit(
  cwd: string,
  branch?: string
): { hash: string; message: string; date: string } | null {
  if (!isGitRepo(cwd)) {
    return null
  }

  try {
    // Find the most recent merge commit (commits with more than 1 parent)
    const branchRef = branch?.trim() || "HEAD"
    const log = execGit(`log ${branchRef} --merges -n 1 --format="%H%x00%s%x00%ar"`, cwd)

    if (!log.trim()) {
      return null
    }

    const [hash, message, date] = log.split("\x00")
    return {
      hash: hash.trim(),
      message: message.trim(),
      date: date.trim(),
    }
  } catch {
    return null
  }
}

/**
 * Revert result from revertCommit/revertMerge operations
 */
export interface RevertResult {
  success: boolean
  revertCommitHash?: string
  error?: string
}

/**
 * Revert a regular (non-merge) commit.
 *
 * @param cwd - Working directory
 * @param commitHash - Hash of commit to revert
 * @returns Revert result with new commit hash or error
 */
export function revertCommit(cwd: string, commitHash: string): RevertResult {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!commitHash.trim()) {
    return { success: false, error: "Commit hash is required" }
  }

  // Validate commit hash format (short or full)
  if (!/^[0-9a-f]{4,40}$/i.test(commitHash.trim())) {
    return { success: false, error: "Invalid commit hash format" }
  }

  const result = runGit(["revert", "--no-edit", commitHash], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  // Get the new revert commit hash
  const hashResult = runGit(["rev-parse", "--short", "HEAD"], cwd)
  const revertCommitHash = hashResult.ok ? hashResult.stdout.trim() : undefined

  return { success: true, revertCommitHash }
}

/**
 * Revert a merge commit.
 * Uses -m 1 to specify the mainline parent (first parent of merge).
 *
 * @param cwd - Working directory
 * @param mergeCommitHash - Hash of merge commit to revert
 * @returns Revert result with new commit hash or error
 */
export function revertMerge(cwd: string, mergeCommitHash: string): RevertResult {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!mergeCommitHash.trim()) {
    return { success: false, error: "Merge commit hash is required" }
  }

  // Validate commit hash format
  if (!/^[0-9a-f]{4,40}$/i.test(mergeCommitHash.trim())) {
    return { success: false, error: "Invalid commit hash format" }
  }

  // Use -m 1 to revert to first parent (mainline before merge)
  const result = runGit(["revert", "-m", "1", "--no-edit", mergeCommitHash], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  // Get the new revert commit hash
  const hashResult = runGit(["rev-parse", "--short", "HEAD"], cwd)
  const revertCommitHash = hashResult.ok ? hashResult.stdout.trim() : undefined

  return { success: true, revertCommitHash }
}
