/**
 * Abuse Detection Service
 *
 * Monitors LLM usage patterns to identify and respond to potential abuse.
 * Tracks:
 * - Excessive request rates
 * - Unusual token consumption patterns
 * - Repeated rate limit violations
 */

import { getRateLimiter } from "./rate-limiter"
import { SecurityConfig } from "./security-config"

export interface AbuseMetrics {
  userId: string
  requestsThisMinute: number
  tokensThisMinute: number
  tokensThisHour: number
  violationCount: number
  isSuspended: boolean
  suspendedUntil?: Date
  abuseScore: number // 0-100, higher = more suspicious
  flags: string[]
}

export interface AbuseAlert {
  userId: string
  timestamp: Date
  severity: "low" | "medium" | "high" | "critical"
  reason: string
  metrics: AbuseMetrics
  action: "warn" | "suspend" | "block"
}

/**
 * Calculate abuse score based on usage patterns
 */
function calculateAbuseScore(metrics: AbuseMetrics): number {
  let score = 0

  // Factor 1: Request rate (0-30 points)
  const requestRate = metrics.requestsThisMinute / SecurityConfig.RATE_LIMIT_REQUESTS_PER_MINUTE
  if (requestRate > 0.9) score += 30
  else if (requestRate > 0.7) score += 20
  else if (requestRate > 0.5) score += 10

  // Factor 2: Token usage rate (0-30 points)
  const tokenRate = metrics.tokensThisMinute / SecurityConfig.RATE_LIMIT_TOKENS_PER_MINUTE
  if (tokenRate > 0.9) score += 30
  else if (tokenRate > 0.7) score += 20
  else if (tokenRate > 0.5) score += 10

  // Factor 3: Violation count (0-40 points)
  if (metrics.violationCount >= SecurityConfig.RATE_LIMIT_MAX_VIOLATIONS) score += 40
  else if (metrics.violationCount >= 3) score += 30
  else if (metrics.violationCount >= 2) score += 20
  else if (metrics.violationCount >= 1) score += 10

  return Math.min(score, 100)
}

/**
 * Generate abuse flags based on patterns
 */
function generateAbuseFlags(metrics: AbuseMetrics): string[] {
  const flags: string[] = []

  if (metrics.requestsThisMinute >= SecurityConfig.RATE_LIMIT_REQUESTS_PER_MINUTE * 0.9) {
    flags.push("high_request_rate")
  }

  if (metrics.tokensThisMinute >= SecurityConfig.RATE_LIMIT_TOKENS_PER_MINUTE * 0.9) {
    flags.push("high_token_usage")
  }

  if (metrics.tokensThisHour >= SecurityConfig.RATE_LIMIT_TOKENS_PER_HOUR * 0.9) {
    flags.push("hourly_limit_approaching")
  }

  if (metrics.violationCount >= 3) {
    flags.push("repeat_offender")
  }

  if (metrics.isSuspended) {
    flags.push("currently_suspended")
  }

  return flags
}

/**
 * Abuse Detection Service
 */
export class AbuseDetector {
  private alertCallbacks: ((alert: AbuseAlert) => void)[] = []
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startMonitoring()
  }

  /**
   * Register a callback for abuse alerts
   */
  onAlert(callback: (alert: AbuseAlert) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Check a specific user for abuse patterns
   */
  checkUser(userId: string): AbuseMetrics | null {
    const rateLimiter = getRateLimiter()
    const stats = rateLimiter.getUserStats(userId)

    if (!stats) return null

    const metrics: AbuseMetrics = {
      userId,
      requestsThisMinute: stats.requestsThisMinute,
      tokensThisMinute: stats.tokensThisMinute,
      tokensThisHour: stats.tokensThisHour,
      violationCount: stats.violationCount,
      isSuspended: stats.isSuspended,
      suspendedUntil: stats.suspendedUntil,
      abuseScore: 0,
      flags: [],
    }

    metrics.abuseScore = calculateAbuseScore(metrics)
    metrics.flags = generateAbuseFlags(metrics)

    return metrics
  }

  /**
   * Analyze user behavior and generate alerts if needed
   */
  analyzeUser(userId: string): AbuseAlert | null {
    const metrics = this.checkUser(userId)
    if (!metrics) return null

    // Determine severity and action based on abuse score
    let severity: AbuseAlert["severity"]
    let action: AbuseAlert["action"]
    let reason: string

    if (metrics.abuseScore >= 80) {
      severity = "critical"
      action = "block"
      reason = "Critical abuse detected: persistent rate limit violations"
    } else if (metrics.abuseScore >= 60) {
      severity = "high"
      action = "suspend"
      reason = "High abuse score: multiple violations or excessive usage"
    } else if (metrics.abuseScore >= 40) {
      severity = "medium"
      action = "warn"
      reason = "Moderate abuse score: approaching rate limits"
    } else if (metrics.abuseScore >= 20) {
      severity = "low"
      action = "warn"
      reason = "Low abuse score: elevated usage detected"
    } else {
      return null // No alert needed
    }

    const alert: AbuseAlert = {
      userId,
      timestamp: new Date(),
      severity,
      reason,
      metrics,
      action,
    }

    return alert
  }

  /**
   * Get metrics for all users
   */
  getAllMetrics(): Map<string, AbuseMetrics> {
    const rateLimiter = getRateLimiter()
    const allStats = rateLimiter.getAllUserStats()
    const allMetrics = new Map<string, AbuseMetrics>()

    for (const [userId, stats] of allStats) {
      if (!stats) continue

      const metrics: AbuseMetrics = {
        userId,
        requestsThisMinute: stats.requestsThisMinute,
        tokensThisMinute: stats.tokensThisMinute,
        tokensThisHour: stats.tokensThisHour,
        violationCount: stats.violationCount,
        isSuspended: stats.isSuspended,
        suspendedUntil: stats.suspendedUntil,
        abuseScore: 0,
        flags: [],
      }

      metrics.abuseScore = calculateAbuseScore(metrics)
      metrics.flags = generateAbuseFlags(metrics)

      allMetrics.set(userId, metrics)
    }

    return allMetrics
  }

  /**
   * Get users with suspicious activity (abuse score > threshold)
   */
  getSuspiciousUsers(threshold = 40): Map<string, AbuseMetrics> {
    const allMetrics = this.getAllMetrics()
    const suspicious = new Map<string, AbuseMetrics>()

    for (const [userId, metrics] of allMetrics) {
      if (metrics.abuseScore >= threshold) {
        suspicious.set(userId, metrics)
      }
    }

    return suspicious
  }

  /**
   * Emit an alert to all registered callbacks
   */
  private emitAlert(alert: AbuseAlert): void {
    console.warn(`[AbuseDetector] ${alert.severity.toUpperCase()} alert for user ${alert.userId}: ${alert.reason}`)
    console.warn(`[AbuseDetector] Metrics:`, alert.metrics)

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert)
      } catch (err) {
        console.error(`[AbuseDetector] Error in alert callback:`, err)
      }
    }
  }

  /**
   * Monitor all users periodically
   */
  private startMonitoring(): void {
    // Check every 30 seconds
    this.monitoringInterval = setInterval(() => {
      const allMetrics = this.getAllMetrics()

      for (const [userId, metrics] of allMetrics) {
        if (metrics.abuseScore >= 40) {
          const alert = this.analyzeUser(userId)
          if (alert) {
            this.emitAlert(alert)

            // Take action based on severity
            if (alert.action === "suspend" || alert.action === "block") {
              const rateLimiter = getRateLimiter()
              const suspensionTime = alert.action === "block"
                ? SecurityConfig.RATE_LIMIT_SUSPENSION_DURATION_MS * 4 // 1 hour for blocks
                : SecurityConfig.RATE_LIMIT_SUSPENSION_DURATION_MS

              rateLimiter.suspend(userId, suspensionTime)
            }
          }
        }
      }
    }, 30_000) // 30 seconds
  }

  /**
   * Stop monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }
}

/**
 * Singleton abuse detector instance
 */
let abuseDetectorInstance: AbuseDetector | null = null

/**
 * Get the global abuse detector instance
 */
export function getAbuseDetector(): AbuseDetector {
  if (!abuseDetectorInstance) {
    abuseDetectorInstance = new AbuseDetector()

    // Default alert handler
    abuseDetectorInstance.onAlert((alert) => {
      console.warn(`[AbuseAlert] ${alert.severity}: ${alert.reason}`)
      console.warn(`[AbuseAlert] User: ${alert.userId}, Score: ${alert.metrics.abuseScore}`)
      console.warn(`[AbuseAlert] Action: ${alert.action}`)
    })
  }
  return abuseDetectorInstance
}
