/**
 * GitHub tRPC Router
 * Provides GitHub API access for authenticated users
 */

import { z } from "zod"
import { publicProcedure, router } from "./trpc"
import { listUserRepos, getRepo } from "@/lib/github/client"
import {
  cloneRepo,
  listClonedRepos,
  deleteClonedRepo,
  isRepoCloned,
} from "@/lib/github/clone-service"
import { TRPCError } from "@trpc/server"
import { createLogger } from "@/lib/logger"

const log = createLogger('GitHub')

export const githubRouter = router({
  /**
   * List repos accessible by authenticated user
   */
  listRepos: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.githubToken) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "GitHub authentication required",
      })
    }

    return listUserRepos(ctx.githubToken)
  }),

  /**
   * Get specific repo details
   */
  getRepo: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.githubToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "GitHub authentication required",
        })
      }

      return getRepo(ctx.githubToken, input.owner, input.repo)
    }),

  /**
   * Get current user's GitHub session
   */
  getSession: publicProcedure.query(async ({ ctx }) => {
    return {
      authenticated: !!ctx.githubToken,
      userId: ctx.userId,
      username: ctx.username,
    }
  }),

  /**
   * Clone a GitHub repository
   */
  cloneRepo: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.githubToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "GitHub authentication required",
        })
      }

      log.info('cloneRepo', `Cloning ${input.owner}/${input.repo}`, { user: ctx.username })
      const repoPath = await cloneRepo(
        ctx.workingDir,
        input.owner,
        input.repo,
        ctx.githubToken
      )
      log.info('cloneRepo', `Clone completed`, { path: repoPath })

      return {
        success: true,
        path: repoPath,
        owner: input.owner,
        repo: input.repo,
      }
    }),

  /**
   * List all cloned repos
   */
  listClonedRepos: publicProcedure.query(async ({ ctx }) => {
    return listClonedRepos(ctx.workingDir)
  }),

  /**
   * Check if a repo is cloned
   */
  isRepoCloned: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return isRepoCloned(ctx.workingDir, input.owner, input.repo)
    }),

  /**
   * Delete a cloned repo
   */
  deleteClonedRepo: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      log.warn('deleteClonedRepo', `Deleting cloned repo: ${input.owner}/${input.repo}`)
      await deleteClonedRepo(ctx.workingDir, input.owner, input.repo)
      return { success: true }
    }),
})
