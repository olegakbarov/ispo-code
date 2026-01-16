import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync, execSync } from 'child_process'
import { archiveTask, createTask, generateArchiveCommitMessage } from '../task-service'
import { getGitStatus, commitScopedChanges } from '../git-service'

function runGit(args: string[], cwd: string) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
  if (result.status !== 0) {
    const stderr = result.stderr || ''
    throw new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`)
  }
}

describe('Archive Commit Flow', () => {
  let repoDir: string

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'agentz-archive-test-'))
    runGit(['init'], repoDir)

    // Create tasks directory
    mkdirSync(join(repoDir, 'tasks'), { recursive: true })

    // Initial commit to establish repo
    writeFileSync(join(repoDir, 'README.md'), 'init\n')
    runGit(['add', 'README.md'], repoDir)
    runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'init'], repoDir)
    runGit(['branch', '-M', 'main'], repoDir)
  })

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true })
  })

  describe('generateArchiveCommitMessage', () => {
    it('generates correct commit message format', () => {
      const message = generateArchiveCommitMessage(
        'Fix authentication bug',
        'tasks/archive/2026-01/fix-authentication-bug.md'
      )

      expect(message).toBe(
        'chore: archive task "Fix authentication bug"\n\nMoved to tasks/archive/2026-01/fix-authentication-bug.md'
      )
    })

    it('handles task titles with special characters', () => {
      const message = generateArchiveCommitMessage(
        'Update "API" endpoint: /users',
        'tasks/archive/2026-01/update-api-endpoint-users.md'
      )

      expect(message).toContain('chore: archive task "Update "API" endpoint: /users"')
    })
  })

  describe('archiveTask + commitScopedChanges integration', () => {
    it('archives task and commits the rename', () => {
      // Create a task
      const { path: taskPath } = createTask(repoDir, {
        title: 'Test Task',
        content: '# Test Task\n\n- [ ] Do something'
      })

      // Commit the new task
      runGit(['add', taskPath], repoDir)
      runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Add test task'], repoDir)

      // Get status before archive
      const statusBefore = getGitStatus(repoDir)
      expect(statusBefore.staged.length).toBe(0)
      expect(statusBefore.modified.length).toBe(0)

      // Archive the task (this would be done by tRPC mutation)
      const archiveResult = archiveTask(repoDir, taskPath)

      // Verify archive path format
      expect(archiveResult.path).toMatch(/^tasks\/archive\/\d{4}-\d{2}\/.+\.md$/)

      // Get git status after archive but before commit
      const statusAfterArchive = getGitStatus(repoDir)
      // Git should detect the rename (staged + modified/deleted)
      expect(statusAfterArchive.staged.length + statusAfterArchive.modified.length).toBeGreaterThan(0)

      // Commit the archive rename
      const task = { title: 'Test Task' }
      const commitMessage = generateArchiveCommitMessage(task.title, archiveResult.path)
      const commitResult = commitScopedChanges(
        repoDir,
        [taskPath, archiveResult.path],
        commitMessage
      )

      expect(commitResult.success).toBe(true)
      expect(commitResult.hash).toBeDefined()

      // Verify clean git status after commit
      const statusAfterCommit = getGitStatus(repoDir)
      expect(statusAfterCommit.staged.length).toBe(0)
      expect(statusAfterCommit.modified.length).toBe(0)
      expect(statusAfterCommit.untracked.length).toBe(0)

      // Verify archived file exists
      expect(existsSync(join(repoDir, archiveResult.path))).toBe(true)

      // Verify commit message in git log
      const log = execSync('git log -1 --format=%B', { cwd: repoDir, encoding: 'utf-8' })
      expect(log).toContain('chore: archive task "Test Task"')
      expect(log).toContain(`Moved to ${archiveResult.path}`)
    })

    it('detects unrelated staged files before archive', () => {
      // Create and commit a task
      const { path: taskPath } = createTask(repoDir, {
        title: 'Test Task',
        content: '# Test Task\n\n- [ ] Do something'
      })
      runGit(['add', taskPath], repoDir)
      runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Add test task'], repoDir)

      // Stage an unrelated file
      writeFileSync(join(repoDir, 'unrelated.txt'), 'unrelated content')
      runGit(['add', 'unrelated.txt'], repoDir)

      // Get git status - in the real tRPC mutation, this check happens before archiving
      const status = getGitStatus(repoDir)
      expect(status.staged.length).toBeGreaterThan(0)

      // The tRPC mutation would throw here if staged files exist
      // This simulates that guard behavior
      const hasStagedFiles = status.staged.length > 0
      expect(hasStagedFiles).toBe(true)

      // In the real flow, archive would not proceed because of the guard
      // This test verifies that the guard correctly detects staged files
    })

    it('archives task with existing archive directory', () => {
      // Create archive directory ahead of time
      const yearMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      mkdirSync(join(repoDir, 'tasks', 'archive', yearMonth), { recursive: true })

      // Create and commit a task
      const { path: taskPath } = createTask(repoDir, {
        title: 'Another Task',
        content: '# Another Task\n\n- [ ] Something'
      })
      runGit(['add', taskPath], repoDir)
      runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Add another task'], repoDir)

      // Archive and commit
      const archiveResult = archiveTask(repoDir, taskPath)
      const commitMessage = generateArchiveCommitMessage('Another Task', archiveResult.path)
      const commitResult = commitScopedChanges(
        repoDir,
        [taskPath, archiveResult.path],
        commitMessage
      )

      expect(commitResult.success).toBe(true)
      expect(existsSync(join(repoDir, archiveResult.path))).toBe(true)

      // Verify clean status
      const status = getGitStatus(repoDir)
      expect(status.staged.length).toBe(0)
      expect(status.modified.length).toBe(0)
    })

    it('handles archive name conflicts by appending number', () => {
      // Create and commit first task
      const { path: taskPath1 } = createTask(repoDir, {
        title: 'Duplicate Name',
        content: '# First\n\n- [ ] Task 1'
      })
      runGit(['add', taskPath1], repoDir)
      runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Add first task'], repoDir)

      // Archive first task
      const archiveResult1 = archiveTask(repoDir, taskPath1)
      const commitResult1 = commitScopedChanges(
        repoDir,
        [taskPath1, archiveResult1.path],
        generateArchiveCommitMessage('Duplicate Name', archiveResult1.path)
      )
      expect(commitResult1.success).toBe(true)

      // Create and commit second task with same title
      const { path: taskPath2 } = createTask(repoDir, {
        title: 'Duplicate Name',
        content: '# Second\n\n- [ ] Task 2'
      })
      runGit(['add', taskPath2], repoDir)
      runGit(['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Add second task'], repoDir)

      // Archive second task (should get -2 suffix)
      const archiveResult2 = archiveTask(repoDir, taskPath2)
      expect(archiveResult2.path).toContain('-2.md')

      const commitResult2 = commitScopedChanges(
        repoDir,
        [taskPath2, archiveResult2.path],
        generateArchiveCommitMessage('Duplicate Name', archiveResult2.path)
      )
      expect(commitResult2.success).toBe(true)

      // Verify both archived files exist
      expect(existsSync(join(repoDir, archiveResult1.path))).toBe(true)
      expect(existsSync(join(repoDir, archiveResult2.path))).toBe(true)

      // Verify clean status
      const status = getGitStatus(repoDir)
      expect(status.staged.length).toBe(0)
      expect(status.modified.length).toBe(0)
    })
  })
})
