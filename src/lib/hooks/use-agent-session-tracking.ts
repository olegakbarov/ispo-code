/**
 * Agent Session Tracking Hook
 *
 * Handles live session tracking, audio notification snapshots,
 * and derived session state for the tasks page.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { trpc } from '@/lib/trpc-client'
import { useAudioNotification } from '@/lib/hooks/use-audio-notification'
import { isTerminalStatus } from '@/lib/agent/status'
import type { SessionStatus } from '@/lib/agent/types'
import type { AgentSession } from '@/components/tasks/agent-types'

interface ActiveSessionInfo {
  sessionId: string
  status: SessionStatus
}

interface TaskSessionsData {
  grouped: {
    planning?: Array<{ sessionId: string; status: string }>
  }
  all: Array<{ sessionId: string }>
}

interface UseAgentSessionTrackingParams {
  activeSessionId: string | undefined
  activeSessionInfo: ActiveSessionInfo | undefined
  taskSessions: TaskSessionsData | undefined
  taskTitle?: string
}

/** Statuses considered active (not terminal) */
const ACTIVE_STATUSES = ['pending', 'running', 'working', 'waiting_approval', 'waiting_input', 'idle']

export function useAgentSessionTracking({
  activeSessionId,
  activeSessionInfo,
  taskSessions,
  taskTitle,
}: UseAgentSessionTrackingParams) {
  const utils = trpc.useUtils()

  // ─────────────────────────────────────────────────────────────────────────────
  // Prefer Planning Session - find active planning session if one exists
  // ─────────────────────────────────────────────────────────────────────────────

  const activePlanningSessionId = useMemo(() => {
    if (!taskSessions?.grouped.planning) return undefined
    const activePlanning = taskSessions.grouped.planning.find(
      (s) => ACTIVE_STATUSES.includes(s.status)
    )
    return activePlanning?.sessionId
  }, [taskSessions?.grouped.planning])

  // Use planning session if active, otherwise fall back to generic active session
  const effectiveSessionId = activePlanningSessionId ?? activeSessionId

  // ─────────────────────────────────────────────────────────────────────────────
  // Live Session Query
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: liveSession } = trpc.agent.get.useQuery(
    { id: effectiveSessionId ?? '' },
    {
      enabled: !!effectiveSessionId,
      refetchInterval: 1000,
    }
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio Notification Snapshot Logic
  // ─────────────────────────────────────────────────────────────────────────────

  const [audioSessionSnapshot, setAudioSessionSnapshot] = useState<{
    id: string
    status: SessionStatus
  } | null>(null)

  useEffect(() => {
    if (!effectiveSessionId) return

    const nextStatus = liveSession?.status ?? activeSessionInfo?.status
    const nextId = liveSession?.id ?? effectiveSessionId

    if (!nextStatus) return

    setAudioSessionSnapshot((prev) => {
      if (prev?.id === nextId && prev.status === nextStatus) return prev
      return { id: nextId, status: nextStatus }
    })
  }, [effectiveSessionId, activeSessionInfo?.status, liveSession?.id, liveSession?.status])

  const prevAudioSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const prev = prevAudioSessionIdRef.current
    const current = effectiveSessionId ?? null
    prevAudioSessionIdRef.current = current

    if (!prev || current) return

    const lastStatus = audioSessionSnapshot?.id === prev ? audioSessionSnapshot.status : undefined
    if (lastStatus && isTerminalStatus(lastStatus)) return

    utils.client.agent.get
      .query({ id: prev })
      .then((session) => {
        if (!session) return
        setAudioSessionSnapshot((snapshot) => {
          if (snapshot?.id === session.id && snapshot.status === session.status) return snapshot
          return { id: session.id, status: session.status }
        })
      })
      .catch((error) => {
        console.error('Failed to fetch final session status for audio notification:', error)
      })
  }, [effectiveSessionId, audioSessionSnapshot?.id, audioSessionSnapshot?.status, utils.client.agent.get])

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Session Memo
  // ─────────────────────────────────────────────────────────────────────────────

  const agentSession: AgentSession | null = useMemo(() => {
    if (!effectiveSessionId) return null

    if (!liveSession) {
      return {
        id: effectiveSessionId,
        status: activeSessionInfo?.status ?? 'running',
        prompt: 'Agent running...',
        output: [],
      }
    }

    return {
      id: liveSession.id,
      status: liveSession.status,
      prompt: liveSession.prompt,
      output: liveSession.output,
      error: liveSession.error,
    }
  }, [effectiveSessionId, activeSessionInfo?.status, liveSession])

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio Notification
  // ─────────────────────────────────────────────────────────────────────────────

  useAudioNotification({
    status: audioSessionSnapshot?.status,
    sessionId: audioSessionSnapshot?.id,
    taskTitle,
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Is Active Planning Session
  // ─────────────────────────────────────────────────────────────────────────────

  // True when we're tracking an active planning session
  const isActivePlanningSession = !!activePlanningSessionId

  return {
    liveSession,
    agentSession,
    audioSessionSnapshot,
    isActivePlanningSession,
  }
}
