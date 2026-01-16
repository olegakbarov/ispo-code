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

import { useEffect, useRef, useCallback, useMemo } from 'react'
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
  taskTitle?: string
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

  // Fetch task list to build taskPath -> title map
  const { data: tasks } = trpc.tasks.list.useQuery(undefined, {
    refetchInterval: false, // Only fetch once, titles don't change frequently
  })

  // Build taskPath -> title map for resolving session task titles
  const taskTitleMap = useMemo(() => {
    if (!tasks) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const task of tasks) {
      map.set(task.path, task.title)
    }
    return map
  }, [tasks])

  // Play audio notification (internal - called after debounce)
  const playNotification = useCallback(
    async (
      type: 'completed' | 'failed',
      options?: { taskTitle?: string; count?: number }
    ): Promise<boolean> => {
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
        const payload: {
          voiceId: string
          type: 'completed' | 'failed'
          taskTitle?: string
          count?: number
        } = {
          voiceId: selectedVoiceId,
          type,
        }

        if (options?.taskTitle) {
          payload.taskTitle = options.taskTitle
        }

        if (options?.count && options.count > 1) {
          payload.count = options.count
        }

        const result = await generateNotification.mutateAsync({
          ...payload,
        })

        const audio = new Audio()
        audio.src = result.audioDataUrl
        await audio.play()
        console.debug('[GlobalAudio] Successfully played notification', {
          type,
          taskTitle: options?.taskTitle,
          count: options?.count,
        })
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
    const completedNotifs = pending.filter((n) => n.type === 'completed')
    const failedNotifs = pending.filter((n) => n.type === 'failed')

    // Clear the queue
    pendingNotificationsRef.current = []
    debounceTimerRef.current = null

    console.debug('[GlobalAudio] Flushing notifications:', { completed: completedNotifs.length, failed: failedNotifs.length })

    // Play notification for the dominant type (or completed if tied)
    // If there are failures, prioritize reporting failures
    // Use the first available taskTitle from the relevant type
    if (failedNotifs.length > 0) {
      const taskTitle = failedNotifs.length === 1 ? failedNotifs[0]?.taskTitle : undefined
      playNotification('failed', { taskTitle, count: failedNotifs.length })
    } else if (completedNotifs.length > 0) {
      const taskTitle = completedNotifs.length === 1 ? completedNotifs[0]?.taskTitle : undefined
      playNotification('completed', { taskTitle, count: completedNotifs.length })
    }
  }, [playNotification])

  // Queue a notification with debounce
  const queueNotification = useCallback(
    (type: 'completed' | 'failed', sessionId: string, taskTitle?: string) => {
      pendingNotificationsRef.current.push({ type, sessionId, taskTitle })

      // Reset the debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(flushPendingNotifications, DEBOUNCE_DELAY_MS)
      console.debug('[GlobalAudio] Queued notification:', { type, sessionId, taskTitle, queueSize: pendingNotificationsRef.current.length })
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

              // Resolve task title from taskPath
              const taskTitle = session.taskPath ? taskTitleMap.get(session.taskPath) : undefined

              queueNotification(notificationType, sessionId, taskTitle)
            }
          })
          .catch((error) => {
            console.error('[GlobalAudio] Failed to fetch session status:', error)
          })
      }
    }

    // Update snapshot for next comparison
    prevSessionsRef.current = currentSessions
  }, [activeAgentSessions, audioEnabled, selectedVoiceId, queueNotification, utils.client.agent.get, taskTitleMap])

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
