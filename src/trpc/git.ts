/**
 * Git tRPC Router
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
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
import { listWorktreesDetailed } from "@/lib/agent/git-worktree"
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
    }))
    .query(({ ctx, input }) => {
      return getFileDiff(ctx.workingDir, input.file, input.view)
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
      return commitChanges(ctx.workingDir, input.message)
    }),

  /** Commit specific files (scoped commit) */
  commitScoped: procedure
    .input(z.object({
      files: z.array(z.string()).min(1, "At least one file is required"),
      message: z.string().min(1, "Commit message is required"),
    }))
    .mutation(({ ctx, input }) => {
      return commitScopedChanges(ctx.workingDir, input.files, input.message)
    }),

  checkout: procedure
    .input(z.object({ branch: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      return checkoutBranch(ctx.workingDir, input.branch)
    }),

  discard: procedure
    .input(z.object({ files: z.array(z.string()).min(1) }))
    .mutation(({ ctx, input }) => {
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
      return mergeBranch(ctx.workingDir, input.targetBranch, input.sourceBranch)
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
      return revertMerge(ctx.workingDir, input.mergeCommitHash)
    }),
})
