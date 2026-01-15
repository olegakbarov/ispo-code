/**
 * Rate Limit tRPC Router
 *
 * Endpoints for monitoring and managing rate limits
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import { getRateLimiter } from "@/lib/agent/rate-limiter"
import { getAbuseDetector } from "@/lib/agent/abuse-detector"
import { SecurityConfig } from "@/lib/agent/security-config"

export const rateLimitRouter = router({
  /**
   * Get rate limit configuration
   */
  getConfig: procedure.query(() => {
    return {
      enabled: SecurityConfig.RATE_LIMIT_ENABLED,
      maxRequestsPerMinute: SecurityConfig.RATE_LIMIT_REQUESTS_PER_MINUTE,
      maxTokensPerRequest: SecurityConfig.RATE_LIMIT_MAX_TOKENS_PER_REQUEST,
      maxTokensPerMinute: SecurityConfig.RATE_LIMIT_TOKENS_PER_MINUTE,
      maxTokensPerHour: SecurityConfig.RATE_LIMIT_TOKENS_PER_HOUR,
      suspensionDurationMs: SecurityConfig.RATE_LIMIT_SUSPENSION_DURATION_MS,
      maxViolations: SecurityConfig.RATE_LIMIT_MAX_VIOLATIONS,
    }
  }),

  /**
   * Get rate limit stats for a specific user
   */
  getUserStats: procedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => {
      const rateLimiter = getRateLimiter()
      const stats = rateLimiter.getUserStats(input.userId)

      if (!stats) {
        return null
      }

      return {
        userId: input.userId,
        requestsThisMinute: stats.requestsThisMinute,
        tokensThisMinute: stats.tokensThisMinute,
        tokensThisHour: stats.tokensThisHour,
        isSuspended: stats.isSuspended,
        suspendedUntil: stats.suspendedUntil?.toISOString(),
        violationCount: stats.violationCount,
      }
    }),

  /**
   * Get all users' rate limit stats
   */
  getAllStats: procedure.query(() => {
    const rateLimiter = getRateLimiter()
    const allStats = rateLimiter.getAllUserStats()
    const result: Array<{
      userId: string
      requestsThisMinute: number
      tokensThisMinute: number
      tokensThisHour: number
      isSuspended: boolean
      suspendedUntil?: string
      violationCount: number
    }> = []

    for (const [userId, stats] of allStats) {
      if (!stats) continue
      result.push({
        userId,
        requestsThisMinute: stats.requestsThisMinute,
        tokensThisMinute: stats.tokensThisMinute,
        tokensThisHour: stats.tokensThisHour,
        isSuspended: stats.isSuspended,
        suspendedUntil: stats.suspendedUntil?.toISOString(),
        violationCount: stats.violationCount,
      })
    }

    return result
  }),

  /**
   * Get abuse metrics for a specific user
   */
  getUserAbuse: procedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => {
      const detector = getAbuseDetector()
      const metrics = detector.checkUser(input.userId)

      if (!metrics) {
        return null
      }

      return {
        userId: metrics.userId,
        requestsThisMinute: metrics.requestsThisMinute,
        tokensThisMinute: metrics.tokensThisMinute,
        tokensThisHour: metrics.tokensThisHour,
        violationCount: metrics.violationCount,
        isSuspended: metrics.isSuspended,
        suspendedUntil: metrics.suspendedUntil?.toISOString(),
        abuseScore: metrics.abuseScore,
        flags: metrics.flags,
      }
    }),

  /**
   * Get all suspicious users
   */
  getSuspiciousUsers: procedure
    .input(z.object({ threshold: z.number().optional().default(40) }))
    .query(({ input }) => {
      const detector = getAbuseDetector()
      const suspicious = detector.getSuspiciousUsers(input.threshold)
      const result: Array<{
        userId: string
        requestsThisMinute: number
        tokensThisMinute: number
        tokensThisHour: number
        violationCount: number
        isSuspended: boolean
        suspendedUntil?: string
        abuseScore: number
        flags: string[]
      }> = []

      for (const [, metrics] of suspicious) {
        result.push({
          userId: metrics.userId,
          requestsThisMinute: metrics.requestsThisMinute,
          tokensThisMinute: metrics.tokensThisMinute,
          tokensThisHour: metrics.tokensThisHour,
          violationCount: metrics.violationCount,
          isSuspended: metrics.isSuspended,
          suspendedUntil: metrics.suspendedUntil?.toISOString(),
          abuseScore: metrics.abuseScore,
          flags: metrics.flags,
        })
      }

      return result
    }),

  /**
   * Manually suspend a user
   */
  suspendUser: procedure
    .input(z.object({
      userId: z.string(),
      durationMs: z.number().optional(),
    }))
    .mutation(({ input }) => {
      const rateLimiter = getRateLimiter()
      rateLimiter.suspend(input.userId, input.durationMs)

      return {
        success: true,
        message: `User ${input.userId} suspended`,
      }
    }),

  /**
   * Clear rate limit data for a user
   */
  clearUser: procedure
    .input(z.object({ userId: z.string() }))
    .mutation(({ input }) => {
      const rateLimiter = getRateLimiter()
      rateLimiter.clearUser(input.userId)

      return {
        success: true,
        message: `Rate limit data cleared for user ${input.userId}`,
      }
    }),

  /**
   * Reset all rate limit data
   */
  reset: procedure.mutation(() => {
    const rateLimiter = getRateLimiter()
    rateLimiter.reset()

    return {
      success: true,
      message: "All rate limit data reset",
    }
  }),
})
