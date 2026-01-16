/**
 * Task Data Hook
 *
 * Consolidates all task-related tRPC queries from the tasks page.
 * Returns all data fetching results and derived values.
 */

import { useMemo } from 'react'
import { trpc } from '@/lib/trpc-client'
import type { PlannerAgentType } from '@/lib/agent/config'
import { useCancellingSessionsStore } from '@/lib/stores/cancelling-sessions'

type Mode = 'edit' | 'review' | 'debate'

interface UseTaskDataParams {
  selectedPath: string | null
  mode: Mode
}

export function useTaskData({ selectedPath, mode }: UseTaskDataParams) {
  // ─────────────────────────────────────────────────────────────────────────────
  // Core Queries
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: workingDir } = trpc.system.workingDir.useQuery()

  const { data: tasks = [] } = trpc.tasks.list.useQuery(undefined, {
    enabled: !!workingDir,
    // In review mode, reduce polling frequency since task list changes rarely
    refetchInterval: mode === 'review' ? 30000 : 5000,
  })

  const { data: availableTypes = [] } = trpc.agent.availableTypes.useQuery()

  const { data: rawActiveAgentSessions = {} } = trpc.tasks.getActiveAgentSessions.useQuery(undefined, {
    enabled: !!workingDir,
    // In review mode, agents are typically not running, reduce polling
    refetchInterval: mode === 'review' ? 10000 : 2000,
  })

  // Filter out sessions that are currently being cancelled to prevent race condition
  const cancellingIds = useCancellingSessionsStore((state: { cancellingIds: Set<string> }) => state.cancellingIds)
  const activeAgentSessions = useMemo(() => {
    const filtered: typeof rawActiveAgentSessions = {}
    for (const [taskPath, session] of Object.entries(rawActiveAgentSessions)) {
      if (!cancellingIds.has(session.sessionId)) {
        filtered[taskPath] = session
      }
    }
    return filtered
  }, [rawActiveAgentSessions, cancellingIds])

  // ─────────────────────────────────────────────────────────────────────────────
  // Task-specific Queries (require selectedPath)
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: taskSessions } = trpc.tasks.getSessionsForTask.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
      // In review mode, session list is static, reduce polling significantly
      refetchInterval: mode === 'review' ? 30000 : 5000,
    }
  )

  const { data: sectionsData } = trpc.tasks.getSections.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
    }
  )

  const { data: taskData } = trpc.tasks.get.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
    }
  )

  const { data: latestActiveMerge } = trpc.tasks.getLatestActiveMerge.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
    }
  )

  const { data: activeDebate } = trpc.debate.getForTask.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
      refetchInterval: mode === 'debate' ? 2000 : false, // Poll faster while in debate mode
    }
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived Values
  // ─────────────────────────────────────────────────────────────────────────────

  const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
    const candidates: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'openrouter']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  const selectedSummary = useMemo(() => {
    if (!selectedPath) return null
    return tasks.find((t) => t.path === selectedPath) ?? null
  }, [selectedPath, tasks])

  // Track active agent session for progress display (from polling)
  const activeSessionInfo = selectedPath ? activeAgentSessions[selectedPath] : undefined
  const activeSessionId = activeSessionInfo?.sessionId

  return {
    // Core data
    workingDir,
    tasks,
    availableTypes,
    activeAgentSessions,

    // Task-specific data
    taskSessions,
    sectionsData,
    taskData,
    latestActiveMerge,
    activeDebate,

    // Derived values
    availablePlannerTypes,
    selectedSummary,
    activeSessionInfo,
    activeSessionId,
  }
}
