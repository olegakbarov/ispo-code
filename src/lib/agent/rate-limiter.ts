/**
 * Rate Limiter for LLM Usage
 *
 * Tracks and enforces limits on:
 * - Requests per user/session
 * - Tokens per request
 * - Total token usage per time period
 *
 * Uses in-memory storage with TTL-based cleanup for performance.
 * For production with multiple servers, consider Redis backend.
 */

export interface RateLimitConfig {
  /** Maximum requests per user per minute */
  maxRequestsPerMinute: number
  /** Maximum tokens per request */
  maxTokensPerRequest: number
  /** Maximum total tokens per user per minute */
  maxTotalTokensPerMinute: number
  /** Maximum total tokens per user per hour */
  maxTotalTokensPerHour: number
  /** Temporary suspension duration in milliseconds */
  suspensionDurationMs: number
}

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number // seconds until request can be retried
  currentUsage?: {
    requestsThisMinute: number
    tokensThisMinute: number
    tokensThisHour: number
  }
}

export interface UsageRecord {
  timestamp: number
  tokens: number
}

export interface UserState {
  /** Request timestamps in the current window */
  requests: number[] // timestamps
  /** Token usage records with timestamps */
  tokenUsage: UsageRecord[]
  /** Suspension end time (if suspended) */
  suspendedUntil?: number
  /** Number of suspension violations */
  violationCount: number
}

/**
 * Rate Limiter for controlling LLM usage
 */
export class RateLimiter {
  private config: RateLimitConfig
  private userStates = new Map<string, UserState>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: RateLimitConfig) {
    this.config = config
    this.startCleanupTimer()
  }

  /**
   * Check if a request is allowed for the given user
   * @param userId - User or session identifier
   * @param estimatedTokens - Estimated tokens for this request (optional)
   */
  checkLimit(userId: string, estimatedTokens?: number): RateLimitResult {
    const now = Date.now()
    const state = this.getUserState(userId)

    // Check if user is suspended
    if (state.suspendedUntil && now < state.suspendedUntil) {
      const retryAfter = Math.ceil((state.suspendedUntil - now) / 1000)
      return {
        allowed: false,
        reason: `Account temporarily suspended. Retry after ${retryAfter} seconds.`,
        retryAfter,
      }
    }

    // Clear suspension if expired
    if (state.suspendedUntil && now >= state.suspendedUntil) {
      state.suspendedUntil = undefined
    }

    // Clean up old request timestamps (older than 1 minute)
    const oneMinuteAgo = now - 60_000
    state.requests = state.requests.filter(ts => ts > oneMinuteAgo)

    // Clean up old token usage (older than 1 hour)
    const oneHourAgo = now - 3600_000
    state.tokenUsage = state.tokenUsage.filter(record => record.timestamp > oneHourAgo)

    // Check requests per minute limit
    if (state.requests.length >= this.config.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: Maximum ${this.config.maxRequestsPerMinute} requests per minute`,
        retryAfter: 60,
        currentUsage: this.getCurrentUsage(state, now),
      }
    }

    // Check tokens per request limit (if provided)
    if (estimatedTokens !== undefined && estimatedTokens > this.config.maxTokensPerRequest) {
      return {
        allowed: false,
        reason: `Token limit exceeded: Maximum ${this.config.maxTokensPerRequest} tokens per request`,
        currentUsage: this.getCurrentUsage(state, now),
      }
    }

    // Calculate token usage in the last minute and hour
    const tokensThisMinute = state.tokenUsage
      .filter(record => record.timestamp > oneMinuteAgo)
      .reduce((sum, record) => sum + record.tokens, 0)

    const tokensThisHour = state.tokenUsage
      .reduce((sum, record) => sum + record.tokens, 0)

    // Check minute token limit (if estimated tokens provided)
    if (estimatedTokens !== undefined) {
      if (tokensThisMinute + estimatedTokens > this.config.maxTotalTokensPerMinute) {
        return {
          allowed: false,
          reason: `Token rate limit exceeded: Maximum ${this.config.maxTotalTokensPerMinute} tokens per minute`,
          retryAfter: 60,
          currentUsage: this.getCurrentUsage(state, now),
        }
      }

      // Check hour token limit
      if (tokensThisHour + estimatedTokens > this.config.maxTotalTokensPerHour) {
        const retryAfter = Math.ceil((3600_000 - (now - state.tokenUsage[0]?.timestamp || 0)) / 1000)
        return {
          allowed: false,
          reason: `Hourly token limit exceeded: Maximum ${this.config.maxTotalTokensPerHour} tokens per hour`,
          retryAfter,
          currentUsage: this.getCurrentUsage(state, now),
        }
      }
    }

    // Request is allowed
    return {
      allowed: true,
      currentUsage: this.getCurrentUsage(state, now),
    }
  }

  /**
   * Record a successful request
   * @param userId - User or session identifier
   * @param tokensUsed - Actual tokens used in the request
   */
  recordUsage(userId: string, tokensUsed: number): void {
    const state = this.getUserState(userId)
    const now = Date.now()

    state.requests.push(now)
    state.tokenUsage.push({ timestamp: now, tokens: tokensUsed })
  }

  /**
   * Suspend a user temporarily
   * @param userId - User or session identifier
   * @param durationMs - Suspension duration (defaults to config value)
   */
  suspend(userId: string, durationMs?: number): void {
    const state = this.getUserState(userId)
    const duration = durationMs ?? this.config.suspensionDurationMs

    state.suspendedUntil = Date.now() + duration
    state.violationCount++

    console.warn(`[RateLimiter] User ${userId} suspended for ${Math.ceil(duration / 1000)}s (violation #${state.violationCount})`)
  }

  /**
   * Check if a user is currently suspended
   */
  isSuspended(userId: string): boolean {
    const state = this.userStates.get(userId)
    if (!state || !state.suspendedUntil) return false

    const now = Date.now()
    if (now >= state.suspendedUntil) {
      state.suspendedUntil = undefined
      return false
    }

    return true
  }

  /**
   * Get current usage statistics for a user
   */
  getCurrentUsage(state: UserState, now: number): RateLimitResult["currentUsage"] {
    const oneMinuteAgo = now - 60_000
    const oneHourAgo = now - 3600_000

    const requestsThisMinute = state.requests.filter(ts => ts > oneMinuteAgo).length
    const tokensThisMinute = state.tokenUsage
      .filter(record => record.timestamp > oneMinuteAgo)
      .reduce((sum, record) => sum + record.tokens, 0)
    const tokensThisHour = state.tokenUsage
      .filter(record => record.timestamp > oneHourAgo)
      .reduce((sum, record) => sum + record.tokens, 0)

    return {
      requestsThisMinute,
      tokensThisMinute,
      tokensThisHour,
    }
  }

  /**
   * Get or create user state
   */
  private getUserState(userId: string): UserState {
    let state = this.userStates.get(userId)
    if (!state) {
      state = {
        requests: [],
        tokenUsage: [],
        violationCount: 0,
      }
      this.userStates.set(userId, state)
    }
    return state
  }

  /**
   * Get usage statistics for a specific user
   */
  getUserStats(userId: string): {
    requestsThisMinute: number
    tokensThisMinute: number
    tokensThisHour: number
    isSuspended: boolean
    suspendedUntil?: Date
    violationCount: number
  } | null {
    const state = this.userStates.get(userId)
    if (!state) return null

    const now = Date.now()
    const usage = this.getCurrentUsage(state, now)

    return {
      requestsThisMinute: usage?.requestsThisMinute ?? 0,
      tokensThisMinute: usage?.tokensThisMinute ?? 0,
      tokensThisHour: usage?.tokensThisHour ?? 0,
      isSuspended: state.suspendedUntil ? now < state.suspendedUntil : false,
      suspendedUntil: state.suspendedUntil ? new Date(state.suspendedUntil) : undefined,
      violationCount: state.violationCount,
    }
  }

  /**
   * Get all user statistics (for monitoring)
   */
  getAllUserStats(): Map<string, ReturnType<RateLimiter["getUserStats"]>> {
    const stats = new Map<string, ReturnType<RateLimiter["getUserStats"]>>()
    for (const [userId] of this.userStates) {
      stats.set(userId, this.getUserStats(userId))
    }
    return stats
  }

  /**
   * Clear all usage data for a user
   */
  clearUser(userId: string): void {
    this.userStates.delete(userId)
  }

  /**
   * Reset all usage data
   */
  reset(): void {
    this.userStates.clear()
  }

  /**
   * Cleanup old user states periodically
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      const oneHourAgo = now - 3600_000

      for (const [userId, state] of this.userStates.entries()) {
        // Remove users with no recent activity
        const hasRecentActivity = state.tokenUsage.some(record => record.timestamp > oneHourAgo)
        const isActive = state.suspendedUntil && now < state.suspendedUntil

        if (!hasRecentActivity && !isActive) {
          this.userStates.delete(userId)
        }
      }
    }, 300_000) // 5 minutes
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

/**
 * Singleton rate limiter instance
 */
let rateLimiterInstance: RateLimiter | null = null

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    // Default configuration (will be overridden by SecurityConfig)
    rateLimiterInstance = new RateLimiter({
      maxRequestsPerMinute: 60,
      maxTokensPerRequest: 50_000,
      maxTotalTokensPerMinute: 200_000,
      maxTotalTokensPerHour: 1_000_000,
      suspensionDurationMs: 15 * 60 * 1000, // 15 minutes
    })
  }
  return rateLimiterInstance
}

/**
 * Initialize rate limiter with custom configuration
 */
export function initRateLimiter(config: RateLimitConfig): RateLimiter {
  if (rateLimiterInstance) {
    rateLimiterInstance.destroy()
  }
  rateLimiterInstance = new RateLimiter(config)
  return rateLimiterInstance
}
