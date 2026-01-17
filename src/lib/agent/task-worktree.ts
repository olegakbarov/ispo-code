import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import { getGitRoot } from "./git-service"
import { ensureTaskWorktree, isWorktreeIsolationEnabled, type TaskWorktreeInfo } from "./git-worktree"
import { ensureTaskId } from "./task-service"

const PLAN_FILE_RE = /^tasks\/([^/]+)\/plan-agent-\d+\.md$/

function normalizeTaskPath(taskPath: string): string {
  return taskPath.trim().replace(/\\/g, "/")
}

function syncTaskFileToWorktree(params: {
  baseDir: string
  worktreePath: string
  taskPath: string
}) {
  const sourcePath = path.join(params.baseDir, params.taskPath)
  if (!existsSync(sourcePath)) {
    return
  }

  const destPath = path.join(params.worktreePath, params.taskPath)
  if (existsSync(destPath)) {
    return
  }

  mkdirSync(path.dirname(destPath), { recursive: true })
  const content = readFileSync(sourcePath, "utf-8")
  writeFileSync(destPath, content, "utf-8")
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
  if (!isWorktreeIsolationEnabled()) {
    return null
  }

  const normalizedTaskPath = normalizeTaskPath(params.taskPath)
  if (normalizedTaskPath.startsWith("tasks/archive/")) {
    return null
  }

  const repoRoot = getGitRoot(params.baseWorkingDir)
  if (!repoRoot) {
    return null
  }

  const rootTaskPath = resolveTaskRootPath(params.taskPath)
  const taskId = ensureTaskId(repoRoot, rootTaskPath)
  const worktreeInfo = ensureTaskWorktree({
    taskId,
    repoRoot,
    baseBranch: params.baseBranch,
  })

  if (!worktreeInfo) {
    return null
  }

  syncTaskFileToWorktree({
    baseDir: repoRoot,
    worktreePath: worktreeInfo.path,
    taskPath: rootTaskPath,
  })
  if (normalizedTaskPath !== rootTaskPath) {
    syncTaskFileToWorktree({
      baseDir: repoRoot,
      worktreePath: worktreeInfo.path,
      taskPath: normalizedTaskPath,
    })
  }

  return {
    ...worktreeInfo,
    rootTaskPath,
  }
}
