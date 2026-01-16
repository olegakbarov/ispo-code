/**
 * Audio Notification Hook
 *
 * Watches session status transitions and plays audio notifications
 * when sessions reach terminal states (completed/failed).
 *
 * Features:
 * - Detects status transitions (not just current state)
 * - Respects user's audioEnabled setting
 * - Debounces to prevent duplicate plays on rapid updates
 * - Uses cached TTS from server
 */

import { useEffect, useRef, useCallback } from "react"
import { useSettingsStore } from "@/lib/stores/settings"
import { isTerminalStatus, ACTIVE_STATUSES } from "@/lib/agent/status"
import type { SessionStatus } from "@/lib/agent/types"
import { trpc } from "@/lib/trpc-client"
import { audioUnlockedPromise, isAudioUnlocked } from "@/lib/audio/audio-unlock"
import { enqueueNotificationAudio } from "@/lib/audio/notification-player"
import { getPhaseFromSessionTitle } from "@/lib/utils/session-phase"

interface UseAudioNotificationOptions {
  /** Current session status */
  status: SessionStatus | undefined
  /** Session ID for logging/debugging */
  sessionId?: string
  /** Task title for context in notification */
  taskTitle?: string
  /** Session title for phase inference (e.g., "Plan: Add feature") */
  sessionTitle?: string
}

/**
 * Hook to play audio notifications on session completion.
 *
 * Only plays when:
 * - audioEnabled is true in settings
 * - A voice is selected
 * - Status transitions from an active state to a terminal state
 */
export function useAudioNotification({
  status,
  sessionId,
  taskTitle,
  sessionTitle,
}: UseAudioNotificationOptions) {
  const { audioEnabled, selectedVoiceId } = useSettingsStore()

  // Track previous status to detect transitions
  const prevStatusRef = useRef<SessionStatus | undefined>(undefined)

  // Track if we've already played for this session to prevent duplicates
  const hasPlayedRef = useRef(false)

  // Generate notification mutation
  const generateNotification = trpc.audio.generateNotification.useMutation()

  // Play audio notification
  // Returns true if play succeeded, false otherwise
  const playNotification = useCallback(
    async (type: "completed" | "failed"): Promise<boolean> => {
      if (!selectedVoiceId) return false

      // Check if audio has been unlocked by user interaction
      if (!isAudioUnlocked()) {
        console.warn("[AudioNotification] Audio not unlocked yet - waiting for user interaction")
        await audioUnlockedPromise
      }

      if (!isAudioUnlocked()) {
        console.warn("[AudioNotification] Audio still locked - skipping notification")
        return false
      }

      try {
        // Extract phase from session title for more specific notification
        const phase = getPhaseFromSessionTitle(sessionTitle)

        const result = await generateNotification.mutateAsync({
          voiceId: selectedVoiceId,
          type,
          taskTitle,
          phase,
        })

        // Use shared queue instead of creating new Audio()
        await enqueueNotificationAudio(result.audioDataUrl)
        console.debug("[AudioNotification] Successfully played", type, "notification", taskTitle ? `for: ${taskTitle}` : "")
        return true
      } catch (error) {
        // Check if this is an autoplay policy error
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          console.warn("[AudioNotification] Autoplay blocked - user needs to interact with page first")
        } else {
          console.error("[AudioNotification] Failed to play:", error)
        }
        return false
      }
    },
    [selectedVoiceId, generateNotification, taskTitle, sessionTitle]
  )

  // Watch for status transitions
  useEffect(() => {
    const prevStatus = prevStatusRef.current

    // Update ref for next comparison
    prevStatusRef.current = status

    // Skip if notifications disabled or no voice selected
    if (!audioEnabled || !selectedVoiceId) return

    // Skip if no status or already played for this session
    if (!status || hasPlayedRef.current) return

    // Skip if this is the initial mount (no previous status yet)
    // This prevents playing on page refresh
    if (prevStatus === undefined) return

    // Check if we transitioned from an active state to a terminal state
    const wasActive = ACTIVE_STATUSES.includes(prevStatus)
    const isNowTerminal = isTerminalStatus(status)

    if (wasActive && isNowTerminal) {
      // Determine notification type
      let notificationType: "completed" | "failed" | null = null
      if (status === "completed") {
        notificationType = "completed"
      } else if (status === "failed") {
        notificationType = "failed"
      }
      // Note: 'cancelled' doesn't play a notification by design

      if (notificationType) {
        // Mark as attempting play - but allow retry if play fails
        hasPlayedRef.current = true

        // Play notification and reset flag if it fails
        playNotification(notificationType).then((success) => {
          if (!success) {
            // Reset flag to allow retry on next status poll
            // This handles cases where unlock wasn't ready yet
            console.debug("[AudioNotification] Play failed, allowing retry")
            hasPlayedRef.current = false
          }
        })
      }
    }
  }, [status, audioEnabled, selectedVoiceId, playNotification])

  // Reset hasPlayed when sessionId changes (new session)
  useEffect(() => {
    hasPlayedRef.current = false
    prevStatusRef.current = undefined
  }, [sessionId])
}
