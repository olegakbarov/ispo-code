/**
 * Git tRPC Router
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import {
  getGitStatus,
  getBranches,
  getRecentCommits,
  getGitRemotes,
  getCwdPrefix,
  getFileDiff,
  stageFiles,
  unstageFiles,
  commitChanges,
  checkoutBranch,
  discardChanges,
  createBranch,
  pushToRemote,
} from "@/lib/agent/git-service"

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

  diff: procedure
    .input(z.object({
      file: z.string().min(1),
      view: z.enum(["auto", "staged", "working"]).optional().default("auto"),
    }))
    .query(({ ctx, input }) => {
      return getFileDiff(ctx.workingDir, input.file, input.view)
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
})
