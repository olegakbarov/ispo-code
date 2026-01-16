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
}

export function useAgentSessionTracking({
  activeSessionId,
  activeSessionInfo,
  taskSessions,
}: UseAgentSessionTrackingParams) {
  const utils = trpc.useUtils()

  // ─────────────────────────────────────────────────────────────────────────────
  // Live Session Query
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: liveSession } = trpc.agent.get.useQuery(
    { id: activeSessionId ?? '' },
    {
      enabled: !!activeSessionId,
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
    if (!activeSessionId) return

    const nextStatus = liveSession?.status ?? activeSessionInfo?.status
    const nextId = liveSession?.id ?? activeSessionId

    if (!nextStatus) return

    setAudioSessionSnapshot((prev) => {
      if (prev?.id === nextId && prev.status === nextStatus) return prev
      return { id: nextId, status: nextStatus }
    })
  }, [activeSessionId, activeSessionInfo?.status, liveSession?.id, liveSession?.status])

  const prevAudioSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const prev = prevAudioSessionIdRef.current
    const current = activeSessionId ?? null
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
  }, [activeSessionId, audioSessionSnapshot?.id, audioSessionSnapshot?.status, utils.client.agent.get])

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Session Memo
  // ─────────────────────────────────────────────────────────────────────────────

  const agentSession: AgentSession | null = useMemo(() => {
    if (!activeSessionId) return null

    if (!liveSession) {
      return {
        id: activeSessionId,
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
  }, [activeSessionId, activeSessionInfo?.status, liveSession])

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio Notification
  // ─────────────────────────────────────────────────────────────────────────────

  useAudioNotification({
    status: audioSessionSnapshot?.status,
    sessionId: audioSessionSnapshot?.id,
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Is Active Planning Session
  // ─────────────────────────────────────────────────────────────────────────────

  const isActivePlanningSession = useMemo(() => {
    if (!agentSession?.id || !taskSessions?.grouped.planning) return false
    return taskSessions.grouped.planning.some(
      (s) => s.sessionId === agentSession.id && ['pending', 'running', 'working'].includes(s.status)
    )
  }, [agentSession?.id, taskSessions?.grouped.planning])

  return {
    liveSession,
    agentSession,
    audioSessionSnapshot,
    isActivePlanningSession,
  }
}
