/**
 * Git Service - wrapper for git commands
 */

import { execSync, spawnSync } from "child_process"
import { readFileSync, writeFileSync, unlinkSync } from "fs"
import { join, resolve, relative } from "path"
import { tmpdir } from "os"

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
}

export type GitDiffView = "auto" | "staged" | "working"

// === Helper Functions ===

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
  let sanitized = message.replace(/\/[\w\-./]+/g, (match) => {
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
  switch (char) {
    case "A":
      return "added"
    case "M":
      return "modified"
    case "D":
      return "deleted"
    case "R":
      return "renamed"
    case "C":
      return "copied"
    default:
      return "modified"
  }
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
  const status = execGit("status --porcelain -u", cwd, { trim: false })

  const staged: GitFileStatus[] = []
  const modified: GitFileStatus[] = []
  const untracked: string[] = []

  for (const line of status.split("\n").filter(Boolean)) {
    const indexStatus = line[0]
    const worktreeStatus = line[1]
    const file = line.slice(3)

    if (indexStatus !== " " && indexStatus !== "?") {
      staged.push({
        file,
        status: parseGitStatus(indexStatus),
      })
    }

    if (worktreeStatus === "M") {
      modified.push({ file, status: "modified" })
    } else if (worktreeStatus === "D") {
      modified.push({ file, status: "deleted" })
    }

    if (indexStatus === "?") {
      untracked.push(file)
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
    const log = execGit(`log -n ${limit} --format="%h|||%B|||%an|||%ar|||END"`, cwd)
    return log.split("|||END\n").filter(Boolean).map((entry) => {
      const [hash, message, author, date] = entry.split("|||")
      return {
        hash: hash.trim(),
        message: message.trim(),
        author: author.trim(),
        date: date.trim()
      }
    })
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
    writeFileSync(tmpFile, message, "utf-8")
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
 * Checkout a branch
 */
export function checkoutBranch(cwd: string, branch: string): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (!branch.trim()) {
    return { success: false, error: "Branch name is required" }
  }
  if (!isValidBranchName(branch)) {
    return { success: false, error: "Invalid branch name" }
  }

  const result = runGit(["checkout", branch], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true }
}

/**
 * Discard changes in working directory (destructive!)
 */
export function discardChanges(cwd: string, files: string[]): { success: boolean; error?: string } {
  if (!isGitRepo(cwd)) {
    return { success: false, error: "Not a git repository" }
  }
  if (files.length === 0) {
    return { success: false, error: "No files specified" }
  }

  const result = runGit(["restore", "--", ...files], cwd)

  if (!result.ok) {
    return { success: false, error: sanitizeError(result.stderr || result.stdout) }
  }

  return { success: true }
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
    return {
      file,
      oldContent: "",
      newContent: "",
      isNew: false,
      isDeleted: false,
      isBinary: false,
    }
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

  // Check if file is binary
  try {
    const isBinaryCheck = execGit(`diff --no-ext-diff --no-textconv --numstat HEAD -- "${file}"`, cwd)
    if (isBinaryCheck.startsWith("-\t-\t")) {
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
    // File might not exist in HEAD
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
