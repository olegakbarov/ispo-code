/**
 * Git tRPC Router
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import { gitLogger } from "@/lib/logger"
import {
  getGitStatus,
  getBranches,
  getRecentCommits,
  getCommitsForFiles,
  getGitRemotes,
  getCwdPrefix,
  getGitRoot,
  getFileDiff,
  getDiffForFiles,
  stageFiles,
  unstageFiles,
  commitChanges,
  commitScopedChanges,
  checkoutBranch,
  discardChanges,
  createBranch,
  pushToRemote,
  fetchFromRemote,
  pullFromRemote,
  deleteBranch,
  hasMergeConflicts,
  getConflictedFiles,
  mergeBranch,
  getLastMergeCommit,
  revertMerge,
} from "@/lib/agent/git-service"
import { listWorktreesDetailed, cleanupOrphanedWorktrees } from "@/lib/agent/git-worktree"
import { getKnownSessionIds } from "@/lib/agent/session-index"
import { generateCommitMessage } from "@/lib/agent/commit-message-generator"

export const gitRouter = router({
  // === Queries ===

  /** Repo-root-relative prefix used for path calculations */
  cwdPrefix: procedure.query(({ ctx }) => {
    return getCwdPrefix(ctx.workingDir)
  }),

  status: procedure.query(({ ctx }) => {
    return getGitStatus(ctx.workingDir)
  }),

  branches: procedure.query(({ ctx }) => {
    return getBranches(ctx.workingDir)
  }),

  remotes: procedure.query(({ ctx }) => {
    return getGitRemotes(ctx.workingDir)
  }),

  commits: procedure
    .input(z.object({ limit: z.number().min(1).max(100).optional().default(10) }))
    .query(({ ctx, input }) => {
      return getRecentCommits(ctx.workingDir, input.limit)
    }),

  /** Get commits that touched specific files */
  commitsForFiles: procedure
    .input(z.object({
      files: z.array(z.string()).min(1, "At least one file is required"),
      limit: z.number().min(1).max(100).optional().default(50),
    }))
    .query(({ ctx, input }) => {
      return getCommitsForFiles(ctx.workingDir, input.files, input.limit)
    }),

  diff: procedure
    .input(z.object({
      file: z.string().min(1),
      view: z.enum(["auto", "staged", "working"]).optional().default("auto"),
      /** Optional override for working directory (for worktree support) */
      workingDir: z.string().optional(),
    }))
    .query(({ ctx, input }) => {
      // Use explicit workingDir if provided, otherwise fall back to context
      const effectiveWorkingDir = input.workingDir || ctx.workingDir
      return getFileDiff(effectiveWorkingDir, input.file, input.view)
    }),

  /** Get diffs for multiple files */
  diffFiles: procedure
    .input(z.object({
      files: z.array(z.string()).min(1),
      view: z.enum(["auto", "staged", "working"]).optional().default("auto"),
    }))
    .query(({ ctx, input }) => {
      return getDiffForFiles(ctx.workingDir, input.files, input.view)
    }),

  conflicts: procedure.query(({ ctx }) => {
    return {
      hasConflicts: hasMergeConflicts(ctx.workingDir),
      conflictedFiles: getConflictedFiles(ctx.workingDir),
    }
  }),

  /** List all git worktrees in the repository */
  worktrees: procedure.query(({ ctx }) => {
    const repoRoot = getGitRoot(ctx.workingDir)
    if (!repoRoot) {
      return []
    }
    return listWorktreesDetailed(repoRoot)
  }),

  // === Mutations ===

  stage: procedure
    .input(z.object({ files: z.array(z.string()).min(1) }))
    .mutation(({ ctx, input }) => {
      return stageFiles(ctx.workingDir, input.files)
    }),

  unstage: procedure
    .input(z.object({ files: z.array(z.string()).min(1) }))
    .mutation(({ ctx, input }) => {
      return unstageFiles(ctx.workingDir, input.files)
    }),

  commit: procedure
    .input(z.object({ message: z.string().min(1, "Commit message is required") }))
    .mutation(({ ctx, input }) => {
      gitLogger.info('commit', 'Creating commit', { message: input.message.slice(0, 72), cwd: ctx.workingDir })
      const result = commitChanges(ctx.workingDir, input.message)
      gitLogger.info('commit', 'Commit created', { hash: result.hash })
      return result
    }),

  /** Commit specific files (scoped commit) */
  commitScoped: procedure
    .input(z.object({
      files: z.array(z.string()).min(1, "At least one file is required"),
      message: z.string().min(1, "Commit message is required"),
    }))
    .mutation(({ ctx, input }) => {
      gitLogger.info('commitScoped', 'Creating scoped commit', {
        fileCount: input.files.length,
        files: input.files.slice(0, 5),
        message: input.message.slice(0, 72),
      })
      const result = commitScopedChanges(ctx.workingDir, input.files, input.message)
      gitLogger.info('commitScoped', 'Scoped commit created', { hash: result.hash })
      return result
    }),

  checkout: procedure
    .input(z.object({ branch: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      gitLogger.info('checkout', `Switching to branch: ${input.branch}`)
      return checkoutBranch(ctx.workingDir, input.branch)
    }),

  discard: procedure
    .input(z.object({ files: z.array(z.string()).min(1) }))
    .mutation(({ ctx, input }) => {
      gitLogger.warn('discard', 'Discarding changes', { fileCount: input.files.length, files: input.files })
      return discardChanges(ctx.workingDir, input.files)
    }),

  createBranch: procedure
    .input(z.object({ branch: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      return createBranch(ctx.workingDir, input.branch)
    }),

  push: procedure
    .input(z.object({
      remote: z.string().optional(),
      branch: z.string().optional(),
      setUpstream: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      gitLogger.info('push', 'Pushing to remote', {
        remote: input.remote ?? 'origin',
        branch: input.branch,
        setUpstream: input.setUpstream,
      })
      return pushToRemote(ctx.workingDir, {
        remote: input.remote,
        branch: input.branch,
        setUpstream: input.setUpstream,
      })
    }),

  fetch: procedure
    .input(z.object({
      remote: z.string().optional(),
      prune: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return fetchFromRemote(ctx.workingDir, {
        remote: input.remote,
        prune: input.prune,
      })
    }),

  pull: procedure
    .input(z.object({
      remote: z.string().optional(),
      branch: z.string().optional(),
      rebase: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      gitLogger.info('pull', 'Pulling from remote', {
        remote: input.remote ?? 'origin',
        branch: input.branch,
        rebase: input.rebase ?? false,
      })
      return pullFromRemote(ctx.workingDir, {
        remote: input.remote,
        branch: input.branch,
        rebase: input.rebase,
      })
    }),

  deleteBranch: procedure
    .input(z.object({
      branch: z.string().min(1),
      force: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      gitLogger.warn('deleteBranch', `Deleting branch: ${input.branch}`, { force: input.force ?? false })
      return deleteBranch(ctx.workingDir, input.branch, {
        force: input.force,
      })
    }),

  /** Generate commit message using AI based on task and changed files */
  generateCommitMessage: procedure
    .input(z.object({
      taskTitle: z.string().optional(),
      taskDescription: z.string().optional(),
      files: z.array(z.string()).min(1, "At least one file is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get diffs for the files
      const diffs = getDiffForFiles(ctx.workingDir, input.files, "auto")

      // Convert FileDiff objects to unified diff strings
      const diffStrings = Object.entries(diffs).map(([file, diff]) => {
        if (diff.isBinary) {
          return `Binary file: ${file}`
        }
        if (diff.isNew) {
          return `New file: ${file}\n${diff.newContent}`
        }
        if (diff.isDeleted) {
          return `Deleted file: ${file}\n${diff.oldContent}`
        }
        // For modified files, show a simple diff representation
        return `Modified: ${file}\n--- old\n+++ new\n${diff.oldContent}\n---\n${diff.newContent}`
      })

      // Generate commit message using AI
      const result = await generateCommitMessage({
        taskTitle: input.taskTitle,
        taskDescription: input.taskDescription,
        changedFiles: input.files,
        diffs: diffStrings,
      })

      return result
    }),

  // === Merge/Revert Operations ===

  /** Merge a source branch into target branch (e.g., worktree branch to main) */
  mergeBranch: procedure
    .input(z.object({
      targetBranch: z.string().min(1, "Target branch is required"),
      sourceBranch: z.string().min(1, "Source branch is required"),
    }))
    .mutation(({ ctx, input }) => {
      gitLogger.info('mergeBranch', `Merging ${input.sourceBranch} into ${input.targetBranch}`)
      const result = mergeBranch(ctx.workingDir, input.targetBranch, input.sourceBranch)
      gitLogger.info('mergeBranch', 'Merge completed', { success: result.success, hash: result.mergeCommitHash })
      return result
    }),

  /** Get the most recent merge commit on a branch */
  getLastMergeCommit: procedure
    .input(z.object({
      branch: z.string().optional(),
    }))
    .query(({ ctx, input }) => {
      return getLastMergeCommit(ctx.workingDir, input.branch)
    }),

  /** Revert a merge commit (uses -m 1 to revert to first parent) */
  revertMerge: procedure
    .input(z.object({
      mergeCommitHash: z.string().min(1, "Merge commit hash is required"),
    }))
    .mutation(({ ctx, input }) => {
      gitLogger.warn('revertMerge', `Reverting merge commit: ${input.mergeCommitHash}`)
      return revertMerge(ctx.workingDir, input.mergeCommitHash)
    }),

  /** Cleanup orphaned worktrees that don't have active sessions */
  cleanupWorktrees: procedure.mutation(async ({ ctx }) => {
    gitLogger.info('cleanupWorktrees', 'Starting worktree cleanup')
    const repoRoot = getGitRoot(ctx.workingDir)
    if (!repoRoot) {
      gitLogger.warn('cleanupWorktrees', 'Not a git repository, skipping cleanup')
      return { cleanedCount: 0, error: "Not a git repository" }
    }

    const activeSessionIds = await getKnownSessionIds()
    gitLogger.debug('cleanupWorktrees', 'Active sessions', { count: activeSessionIds.size })
    const cleanedCount = cleanupOrphanedWorktrees(repoRoot, activeSessionIds)
    gitLogger.info('cleanupWorktrees', `Cleaned ${cleanedCount} orphaned worktrees`)

    return { cleanedCount }
  }),
})
