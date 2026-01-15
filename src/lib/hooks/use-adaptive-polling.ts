/**
 * Adaptive Polling Hook
 *
 * Implements exponential backoff for polling intervals based on session activity.
 * When sessions are active, polls frequently. When idle, backs off to reduce
 * network traffic and CPU usage.
 *
 * Configuration:
 * - BASE_INTERVAL: Starting interval when session is active (2s)
 * - MAX_INTERVAL: Maximum backoff interval (30s)
 * - BACKOFF_MULTIPLIER: How quickly to increase interval (1.5x)
 * - STABILITY_THRESHOLD: How many unchanged polls before increasing interval (3)
 */

import { useCallback, useRef } from 'react'
import type { SessionStatus } from '@/lib/agent/types'

/** Adaptive polling configuration */
const POLLING_CONFIG = {
  /** Base polling interval for active sessions (ms) */
  BASE_INTERVAL: 2000,
  /** Maximum polling interval during backoff (ms) */
  MAX_INTERVAL: 30000,
  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 1.5,
  /** Number of stable polls before increasing interval */
  STABILITY_THRESHOLD: 3,
  /** Jitter percentage to prevent cache stampedes (+/- 10%) */
  JITTER_PERCENT: 0.1,
}

/** Statuses that indicate the session is actively processing */
const ACTIVE_STATUSES: SessionStatus[] = [
  'pending',
  'running',
  'working',
  'waiting_approval',
  'waiting_input',
]

export interface AdaptivePollingState {
  /** Current polling interval in ms */
  currentInterval: number
  /** Number of consecutive unchanged polls */
  stableCount: number
  /** Last data hash for change detection */
  lastDataHash: string | null
}

export interface UseAdaptivePollingOptions {
  /** Session status for determining base behavior */
  status: SessionStatus | undefined
  /** Simple hash of the data for change detection */
  dataHash: string | null
  /** Whether polling should be completely disabled */
  disabled?: boolean
}

export interface UseAdaptivePollingResult {
  /** Current polling interval to use (ms), or false if polling should stop */
  refetchInterval: number | false
  /** Reset the polling state (call when session changes) */
  reset: () => void
}

/**
 * Hook for adaptive polling that backs off when data is stable.
 *
 * Usage:
 * ```tsx
 * const { refetchInterval, reset } = useAdaptivePolling({
 *   status: session?.status,
 *   dataHash: session ? computeHash(session) : null,
 * })
 *
 * const { data } = trpc.agent.getSessionWithMetadata.useQuery(
 *   { id: sessionId },
 *   { refetchInterval }
 * )
 * ```
 */
export function useAdaptivePolling({
  status,
  dataHash,
  disabled = false,
}: UseAdaptivePollingOptions): UseAdaptivePollingResult {
  const stateRef = useRef<AdaptivePollingState>({
    currentInterval: POLLING_CONFIG.BASE_INTERVAL,
    stableCount: 0,
    lastDataHash: null,
  })

  // Reset state when session changes
  const reset = useCallback(() => {
    stateRef.current = {
      currentInterval: POLLING_CONFIG.BASE_INTERVAL,
      stableCount: 0,
      lastDataHash: null,
    }
  }, [])

  // Determine if we should poll at all
  if (disabled || !status) {
    return { refetchInterval: false, reset }
  }

  const isActive = ACTIVE_STATUSES.includes(status)

  // Terminal states - stop polling entirely
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    return { refetchInterval: false, reset }
  }

  // Active state - always use base interval
  if (isActive) {
    // Reset backoff when active
    if (stateRef.current.currentInterval !== POLLING_CONFIG.BASE_INTERVAL) {
      stateRef.current.currentInterval = POLLING_CONFIG.BASE_INTERVAL
      stateRef.current.stableCount = 0
    }
    return {
      refetchInterval: addJitter(POLLING_CONFIG.BASE_INTERVAL),
      reset,
    }
  }

  // Idle state - apply adaptive backoff
  const state = stateRef.current

  // Check if data changed
  if (dataHash !== null) {
    if (dataHash === state.lastDataHash) {
      // Data unchanged - increment stability counter
      state.stableCount++

      // Apply backoff if stable long enough
      if (state.stableCount >= POLLING_CONFIG.STABILITY_THRESHOLD) {
        state.currentInterval = Math.min(
          state.currentInterval * POLLING_CONFIG.BACKOFF_MULTIPLIER,
          POLLING_CONFIG.MAX_INTERVAL
        )
        state.stableCount = 0 // Reset counter after backoff
      }
    } else {
      // Data changed - reset to base interval
      state.currentInterval = POLLING_CONFIG.BASE_INTERVAL
      state.stableCount = 0
    }
    state.lastDataHash = dataHash
  }

  return {
    refetchInterval: addJitter(state.currentInterval),
    reset,
  }
}

/**
 * Add random jitter to prevent cache stampedes.
 * Returns interval +/- JITTER_PERCENT randomly.
 */
function addJitter(interval: number): number {
  const jitter = interval * POLLING_CONFIG.JITTER_PERCENT
  return Math.round(interval + (Math.random() * 2 - 1) * jitter)
}

/**
 * Compute a simple hash of session data for change detection.
 * Uses status, output length, and completedAt as proxies for change.
 */
export function computeSessionHash(session: {
  status?: SessionStatus
  output?: { length: number }
  completedAt?: string
  error?: string
} | null): string | null {
  if (!session) return null
  return `${session.status}-${session.output?.length ?? 0}-${session.completedAt ?? ''}-${session.error ?? ''}`
}
