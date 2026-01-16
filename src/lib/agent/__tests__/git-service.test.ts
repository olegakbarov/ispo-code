import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { mergeBranch } from '../git-service'

function runGit(args: string[], cwd: string) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    throw new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`)
  }
}

describe('mergeBranch', () => {
  let repoDir: string

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'ispo-code-git-'))
    runGit(['init'], repoDir)
    writeFileSync(join(repoDir, 'README.md'), 'init\n')
    runGit(['add', 'README.md'], repoDir)
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'init'], repoDir)
    runGit(['branch', '-M', 'main'], repoDir)
  })

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true })
  })

  it('returns a clear error when the source branch does not exist', () => {
    const result = mergeBranch(repoDir, 'main', 'ispo-code/session-missing')

    expect(result.success).toBe(false)
    expect(result.error).toContain("Branch 'ispo-code/session-missing' does not exist")
  })
})
