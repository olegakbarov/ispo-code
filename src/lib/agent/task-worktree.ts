import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import { getGitRoot } from "./git-service"
import { ensureTaskWorktree, isWorktreeIsolationEnabled, type TaskWorktreeInfo } from "./git-worktree"
import { ensureTaskId } from "./task-service"

const PLAN_FILE_RE = /^tasks\/([^/]+)\/plan-agent-\d+\.md$/
const TASK_PERF_DEBUG = process.env.TASK_PERF_DEBUG === "true"

const logTaskPerf = (message: string, data?: Record<string, unknown>) => {
  if (!TASK_PERF_DEBUG) return
  if (data) {
    console.log(`[task-perf] ${message}`, data)
  } else {
    console.log(`[task-perf] ${message}`)
  }
}

function normalizeTaskPath(taskPath: string): string {
  return taskPath.trim().replace(/\\/g, "/")
}

function syncTaskFileToWorktree(params: {
  baseDir: string
  worktreePath: string
  taskPath: string
}): boolean {
  const sourcePath = path.join(params.baseDir, params.taskPath)
  if (!existsSync(sourcePath)) {
    return false
  }

  const destPath = path.join(params.worktreePath, params.taskPath)
  if (existsSync(destPath)) {
    return false
  }

  mkdirSync(path.dirname(destPath), { recursive: true })
  const content = readFileSync(sourcePath, "utf-8")
  writeFileSync(destPath, content, "utf-8")
  return true
}

export function resolveTaskRootPath(taskPath: string): string {
  const normalized = normalizeTaskPath(taskPath)
  const match = normalized.match(PLAN_FILE_RE)
  if (match) {
    return `tasks/${match[1]}.md`
  }
  return normalized
}

export function ensureTaskWorktreeForPath(params: {
  taskPath: string
  baseWorkingDir: string
  baseBranch?: string
}): (TaskWorktreeInfo & { rootTaskPath: string }) | null {
  const start = TASK_PERF_DEBUG ? performance.now() : 0

  if (!isWorktreeIsolationEnabled()) {
    logTaskPerf("worktree disabled", { taskPath: params.taskPath })
    return null
  }

  const normalizedTaskPath = normalizeTaskPath(params.taskPath)
  if (normalizedTaskPath.startsWith("tasks/archive/")) {
    logTaskPerf("worktree skipped (archived task)", { taskPath: normalizedTaskPath })
    return null
  }

  const repoRoot = getGitRoot(params.baseWorkingDir)
  if (!repoRoot) {
    logTaskPerf("worktree skipped (no repo root)", { taskPath: normalizedTaskPath })
    return null
  }

  const rootTaskPath = resolveTaskRootPath(params.taskPath)
  const taskIdStart = TASK_PERF_DEBUG ? performance.now() : 0
  const taskId = ensureTaskId(repoRoot, rootTaskPath)
  const taskIdMs = TASK_PERF_DEBUG ? performance.now() - taskIdStart : 0
  const worktreePath = path.join(repoRoot, ".ispo-code", "worktrees", "tasks", taskId)
  const existed = existsSync(worktreePath)
  const worktreeStart = TASK_PERF_DEBUG ? performance.now() : 0
  const worktreeInfo = ensureTaskWorktree({
    taskId,
    repoRoot,
    baseBranch: params.baseBranch,
  })
  const worktreeMs = TASK_PERF_DEBUG ? performance.now() - worktreeStart : 0

  if (!worktreeInfo) {
    logTaskPerf("worktree ensure failed", {
      taskPath: normalizedTaskPath,
      rootTaskPath,
      taskId,
      existed,
      taskIdMs: Math.round(taskIdMs),
      worktreeMs: Math.round(worktreeMs),
    })
    return null
  }

  const syncStart = TASK_PERF_DEBUG ? performance.now() : 0
  const syncedRoot = syncTaskFileToWorktree({
    baseDir: repoRoot,
    worktreePath: worktreeInfo.path,
    taskPath: rootTaskPath,
  })
  let syncedNormalized = false
  if (normalizedTaskPath !== rootTaskPath) {
    syncedNormalized = syncTaskFileToWorktree({
      baseDir: repoRoot,
      worktreePath: worktreeInfo.path,
      taskPath: normalizedTaskPath,
    })
  }
  const syncMs = TASK_PERF_DEBUG ? performance.now() - syncStart : 0
  const totalMs = TASK_PERF_DEBUG ? performance.now() - start : 0

  logTaskPerf("ensureTaskWorktreeForPath", {
    taskPath: normalizedTaskPath,
    rootTaskPath,
    taskId,
    existed,
    created: !existed,
    taskIdMs: Math.round(taskIdMs),
    worktreeMs: Math.round(worktreeMs),
    syncMs: Math.round(syncMs),
    syncedRoot,
    syncedNormalized,
    totalMs: Math.round(totalMs),
  })

  return {
    ...worktreeInfo,
    rootTaskPath,
  }
}
