import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { spawnSync } from "child_process"
import { resolveDaemonWorktree } from "../worktree"
import { deleteWorktree } from "@/lib/agent/git-worktree"
import type { DaemonConfig } from "../agent-daemon"

function runGit(args: string[], cwd: string) {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" })
  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr).trim() : ""
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`)
  }
  return result.stdout ? String(result.stdout) : ""
}

describe("resolveDaemonWorktree", () => {
  let repoDir: string
  let originalDisable: string | undefined

  beforeEach(() => {
    originalDisable = process.env.DISABLE_WORKTREE_ISOLATION
    delete process.env.DISABLE_WORKTREE_ISOLATION

    repoDir = mkdtempSync(join(tmpdir(), "ispo-code-daemon-"))
    runGit(["init"], repoDir)
    writeFileSync(join(repoDir, "README.md"), "init\n")
    runGit(["add", "README.md"], repoDir)
    runGit(["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], repoDir)
    runGit(["branch", "-M", "main"], repoDir)
  })

  afterEach(() => {
    if (originalDisable === undefined) {
      delete process.env.DISABLE_WORKTREE_ISOLATION
    } else {
      process.env.DISABLE_WORKTREE_ISOLATION = originalDisable
    }

    rmSync(repoDir, { recursive: true, force: true })
  })

  it("creates a worktree for new daemon sessions", () => {
    const sessionId = "abc123"
    const config: DaemonConfig = {
      sessionId,
      agentType: "claude",
      prompt: "test",
      workingDir: repoDir,
      daemonNonce: "nonce",
    }

    const result = resolveDaemonWorktree(config)

    const expectedPath = join(realpathSync(repoDir), ".ispo-code", "worktrees", sessionId)
    expect(result.worktreePath).toBe(expectedPath)
    expect(result.worktreeBranch).toBe(`ispo-code/session-${sessionId}`)
    expect(result.spawnWorkingDir).toBe(expectedPath)
    expect(existsSync(expectedPath)).toBe(true)
    expect(runGit(["worktree", "list"], repoDir)).toContain(expectedPath)

    deleteWorktree(expectedPath)
  })
})
