import { existsSync } from "fs"
import type { DaemonConfig } from "./agent-daemon"
import { createWorktree, getWorktreeForSession, isWorktreeIsolationEnabled } from "@/lib/agent/git-worktree"
import { ensureTaskWorktreeForPath } from "@/lib/agent/task-worktree"
import { getGitRoot } from "@/lib/agent/git-service"

export interface DaemonWorktreeResult {
  worktreePath?: string
  worktreeBranch?: string
  spawnWorkingDir: string
}

export function resolveDaemonWorktree(config: DaemonConfig): DaemonWorktreeResult {
  const baseWorkingDir = config.workingDir

  if (!isWorktreeIsolationEnabled()) {
    return { spawnWorkingDir: baseWorkingDir }
  }

  const repoRoot = getGitRoot(baseWorkingDir)
  if (!repoRoot) {
    return { spawnWorkingDir: baseWorkingDir }
  }

  if (config.taskPath) {
    const taskWorktree = ensureTaskWorktreeForPath({
      taskPath: config.taskPath,
      baseWorkingDir: repoRoot,
    })
    if (taskWorktree) {
      return {
        worktreePath: taskWorktree.path,
        worktreeBranch: taskWorktree.branch,
        spawnWorkingDir: taskWorktree.path,
      }
    }
  }

  if (config.worktreePath && existsSync(config.worktreePath)) {
    return {
      worktreePath: config.worktreePath,
      worktreeBranch: config.worktreeBranch,
      spawnWorkingDir: config.worktreePath,
    }
  }

  if (config.isResume) {
    const existing = getWorktreeForSession(config.sessionId, repoRoot)
    if (existing) {
      return {
        worktreePath: existing.path,
        worktreeBranch: existing.branch,
        spawnWorkingDir: existing.path,
      }
    }

    return { spawnWorkingDir: baseWorkingDir }
  }

  const created = createWorktree({ sessionId: config.sessionId, repoRoot })
  if (!created) {
    return { spawnWorkingDir: baseWorkingDir }
  }

  return {
    worktreePath: created.path,
    worktreeBranch: created.branch,
    spawnWorkingDir: created.path,
  }
}
