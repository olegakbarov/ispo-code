/**
 * Global Audio Notifications Hook
 *
 * Monitors ALL active sessions across all tasks and plays audio notifications
 * when any session transitions to a terminal state (completed/failed).
 *
 * This hook should be mounted once at a high level (e.g., __root.tsx or tasks layout)
 * to ensure notifications fire regardless of which task is currently selected.
 *
 * Features debounce logic: if multiple sessions complete within a short window,
 * plays a single summary notification instead of overlapping audio.
 */

import { useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '@/lib/stores/settings'
import { trpc } from '@/lib/trpc-client'
import { audioUnlockedPromise, isAudioUnlocked } from '@/lib/audio/audio-unlock'
import type { SessionStatus } from '@/lib/agent/types'

/** How long to wait for additional completions before playing notification (ms) */
const DEBOUNCE_DELAY_MS = 3000

/** Session info needed for tracking transitions */
interface TrackedSession {
  sessionId: string
  status: SessionStatus
}

/** Map of sessionId -> TrackedSession */
type SessionSnapshot = Record<string, TrackedSession>

/** Queued notification waiting to be played */
interface QueuedNotification {
  type: 'completed' | 'failed'
  sessionId: string
}

/**
 * Hook to play audio notifications when any session completes.
 *
 * Tracks all active sessions and detects transitions to terminal states.
 * Uses debounce logic to batch multiple rapid completions into a single notification.
 */
export function useGlobalAudioNotifications() {
  const { audioEnabled, selectedVoiceId } = useSettingsStore()
  const utils = trpc.useUtils()

  // Track previous session states to detect transitions (keyed by sessionId)
  const prevSessionsRef = useRef<SessionSnapshot>({})

  // Track sessions we've already notified for (prevents duplicates)
  const notifiedSessionsRef = useRef<Set<string>>(new Set())

  // Debounce state: queue of pending notifications and timer
  const pendingNotificationsRef = useRef<QueuedNotification[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Generate notification mutation
  const generateNotification = trpc.audio.generateNotification.useMutation()

  // Play audio notification (internal - called after debounce)
  const playNotification = useCallback(
    async (type: 'completed' | 'failed'): Promise<boolean> => {
      if (!selectedVoiceId) return false

      // Check if audio has been unlocked by user interaction
      if (!isAudioUnlocked()) {
        console.debug('[GlobalAudio] Audio not unlocked yet - waiting for user interaction')
        await audioUnlockedPromise
      }

      if (!isAudioUnlocked()) {
        console.debug('[GlobalAudio] Audio still locked - skipping notification')
        return false
      }

      try {
        const result = await generateNotification.mutateAsync({
          voiceId: selectedVoiceId,
          type,
        })

        const audio = new Audio()
        audio.src = result.audioDataUrl
        await audio.play()
        console.debug('[GlobalAudio] Successfully played', type, 'notification')
        return true
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          console.warn('[GlobalAudio] Autoplay blocked - user needs to interact with page first')
        } else {
          console.error('[GlobalAudio] Failed to play:', error)
        }
        return false
      }
    },
    [selectedVoiceId, generateNotification]
  )

  // Flush pending notifications - plays a single notification for batched completions
  const flushPendingNotifications = useCallback(() => {
    const pending = pendingNotificationsRef.current
    if (pending.length === 0) return

    // Count by type
    const completed = pending.filter((n) => n.type === 'completed').length
    const failed = pending.filter((n) => n.type === 'failed').length

    // Clear the queue
    pendingNotificationsRef.current = []
    debounceTimerRef.current = null

    console.debug('[GlobalAudio] Flushing notifications:', { completed, failed })

    // Play notification for the dominant type (or completed if tied)
    // If there are failures, prioritize reporting failures
    if (failed > 0) {
      playNotification('failed')
    } else if (completed > 0) {
      playNotification('completed')
    }
  }, [playNotification])

  // Queue a notification with debounce
  const queueNotification = useCallback(
    (type: 'completed' | 'failed', sessionId: string) => {
      pendingNotificationsRef.current.push({ type, sessionId })

      // Reset the debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(flushPendingNotifications, DEBOUNCE_DELAY_MS)
      console.debug('[GlobalAudio] Queued notification:', { type, sessionId, queueSize: pendingNotificationsRef.current.length })
    },
    [flushPendingNotifications]
  )

  // Poll active sessions
  const { data: activeAgentSessions } = trpc.tasks.getActiveAgentSessions.useQuery(undefined, {
    refetchInterval: 2000,
  })

  // Detect session transitions
  useEffect(() => {
    if (!audioEnabled || !selectedVoiceId) return
    if (!activeAgentSessions) return

    const prevSessions = prevSessionsRef.current

    // Build current session map (sessionId -> session info)
    const currentSessions: SessionSnapshot = {}
    for (const [, session] of Object.entries(activeAgentSessions)) {
      currentSessions[session.sessionId] = {
        sessionId: session.sessionId,
        status: session.status,
      }
    }

    // Find sessions that disappeared from active list (potentially completed/failed)
    for (const sessionId of Object.keys(prevSessions)) {
      const currentState = currentSessions[sessionId]

      // Session disappeared from active list - it may have completed
      if (!currentState && !notifiedSessionsRef.current.has(sessionId)) {
        // Fetch the final status to confirm
        utils.client.agent.get
          .query({ id: sessionId })
          .then((session) => {
            if (!session) return
            if (notifiedSessionsRef.current.has(sessionId)) return

            // Check if it reached a terminal state
            if (session.status === 'completed' || session.status === 'failed') {
              notifiedSessionsRef.current.add(sessionId)
              const notificationType = session.status === 'completed' ? 'completed' : 'failed'
              queueNotification(notificationType, sessionId)
            }
          })
          .catch((error) => {
            console.error('[GlobalAudio] Failed to fetch session status:', error)
          })
      }
    }

    // Update snapshot for next comparison
    prevSessionsRef.current = currentSessions
  }, [activeAgentSessions, audioEnabled, selectedVoiceId, queueNotification, utils.client.agent.get])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Clean up notified sessions periodically to prevent memory leak
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Keep only last 100 notified sessions
      if (notifiedSessionsRef.current.size > 100) {
        const arr = Array.from(notifiedSessionsRef.current)
        notifiedSessionsRef.current = new Set(arr.slice(-50))
      }
    }, 60000) // Every minute

    return () => clearInterval(cleanup)
  }, [])
}
