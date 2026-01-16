/**
 * Task Orchestrator Hook
 *
 * Handles orchestrator operations for debug runs:
 * - Debug run status polling
 * - Auto-trigger orchestrator when all debug sessions complete
 * - Orchestrator modal controls
 */

import { useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc-client'
import type { TasksAction, OrchestratorState } from '@/lib/stores/tasks-reducer'

interface TaskSessionInfo {
  sessionId: string
  sessionType?: 'planning' | 'review' | 'verify' | 'execution' | 'debug' | 'rewrite' | 'comment' | 'orchestrator'
  status?: string
}

interface TaskSessionsData {
  all: Array<TaskSessionInfo>
  grouped?: {
    planning: Array<TaskSessionInfo>
    review: Array<TaskSessionInfo>
    verify: Array<TaskSessionInfo>
    execution: Array<TaskSessionInfo>
    rewrite: Array<TaskSessionInfo>
    comment: Array<TaskSessionInfo>
    orchestrator: Array<TaskSessionInfo>
  }
}

interface UseTaskOrchestratorParams {
  selectedPath: string | null
  dispatch: React.Dispatch<TasksAction>
  orchestrator: OrchestratorState
  taskSessions: TaskSessionsData | undefined
  orchestrateMutation: ReturnType<typeof trpc.tasks.orchestrateDebugRun.useMutation>
}

export function useTaskOrchestrator({
  selectedPath,
  dispatch,
  orchestrator,
  taskSessions,
  orchestrateMutation,
}: UseTaskOrchestratorParams) {
  // ─────────────────────────────────────────────────────────────────────────────
  // Orchestrator Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCloseOrchestratorModal = useCallback(() => {
    dispatch({ type: 'RESET_ORCHESTRATOR' })
  }, [dispatch])

  // Query debug run status when we have a tracked debugRunId
  const { data: debugRunStatus } = trpc.tasks.getDebugRunStatus.useQuery(
    { debugRunId: orchestrator.debugRunId ?? '' },
    {
      enabled: !!orchestrator.debugRunId && orchestrator.triggered && !orchestrator.sessionId,
      refetchInterval: 2000,
    }
  )

  // Trigger orchestrator when all debug sessions complete
  const orchestratorTriggeredRef = useRef<string | null>(null)

  useEffect(() => {
    if (!orchestrator.debugRunId || !orchestrator.triggered) return
    if (orchestrator.sessionId) return
    if (orchestratorTriggeredRef.current === orchestrator.debugRunId) return
    if (!debugRunStatus) return
    if (!debugRunStatus.allTerminal) return

    orchestratorTriggeredRef.current = orchestrator.debugRunId

    const sessionWithPath = taskSessions?.all.find((s) =>
      s.sessionId && debugRunStatus.sessions.some(ds => ds.sessionId === s.sessionId)
    )
    const taskPathForOrchestrator = sessionWithPath ? selectedPath : selectedPath

    if (taskPathForOrchestrator) {
      orchestrateMutation.mutate({
        debugRunId: orchestrator.debugRunId,
        taskPath: taskPathForOrchestrator,
      })
    }
  }, [
    orchestrator.debugRunId,
    orchestrator.triggered,
    orchestrator.sessionId,
    debugRunStatus,
    selectedPath,
    taskSessions?.all,
    orchestrateMutation,
  ])

  return {
    handleCloseOrchestratorModal,
    debugRunStatus,
  }
}
