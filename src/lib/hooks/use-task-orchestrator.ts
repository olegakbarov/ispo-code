/**
 * Task Orchestrator Hook
 *
 * Handles orchestrator operations for debug runs and plan runs:
 * - Debug run status polling
 * - Plan run status polling
 * - Auto-trigger orchestrator when all sessions complete
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
  orchestratePlanMutation: ReturnType<typeof trpc.tasks.orchestratePlanRun.useMutation>
}

export function useTaskOrchestrator({
  selectedPath,
  dispatch,
  orchestrator,
  taskSessions,
  orchestrateMutation,
  orchestratePlanMutation,
}: UseTaskOrchestratorParams) {
  // ─────────────────────────────────────────────────────────────────────────────
  // Orchestrator Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCloseOrchestratorModal = useCallback(() => {
    dispatch({ type: 'RESET_ORCHESTRATOR' })
  }, [dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Debug Run Orchestration
  // ─────────────────────────────────────────────────────────────────────────────

  // Query debug run status when we have a tracked debugRunId
  const { data: debugRunStatus } = trpc.tasks.getDebugRunStatus.useQuery(
    { debugRunId: orchestrator.debugRunId ?? '' },
    {
      enabled: !!orchestrator.debugRunId && orchestrator.type === 'debug' && orchestrator.triggered && !orchestrator.sessionId,
      refetchInterval: 2000,
    }
  )

  // Trigger debug orchestrator when all debug sessions complete
  const debugOrchestratorTriggeredRef = useRef<string | null>(null)

  useEffect(() => {
    if (orchestrator.type !== 'debug') return
    if (!orchestrator.debugRunId || !orchestrator.triggered) return
    if (orchestrator.sessionId) return
    if (debugOrchestratorTriggeredRef.current === orchestrator.debugRunId) return
    if (!debugRunStatus) return
    if (!debugRunStatus.allTerminal) return

    debugOrchestratorTriggeredRef.current = orchestrator.debugRunId

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
    orchestrator.type,
    orchestrator.debugRunId,
    orchestrator.triggered,
    orchestrator.sessionId,
    debugRunStatus,
    selectedPath,
    taskSessions?.all,
    orchestrateMutation,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Plan Run Orchestration
  // ─────────────────────────────────────────────────────────────────────────────

  // Query plan run status when we have a tracked planRunId
  const { data: planRunStatus } = trpc.tasks.getPlanRunStatus.useQuery(
    { planRunId: orchestrator.planRunId ?? '' },
    {
      enabled: !!orchestrator.planRunId && orchestrator.type === 'plan' && orchestrator.triggered && !orchestrator.sessionId,
      refetchInterval: 2000,
    }
  )

  // Trigger plan orchestrator when all plan sessions complete (or fail)
  const planOrchestratorTriggeredRef = useRef<string | null>(null)

  useEffect(() => {
    if (orchestrator.type !== 'plan') return
    if (!orchestrator.planRunId || !orchestrator.triggered) return
    if (orchestrator.sessionId) return
    if (planOrchestratorTriggeredRef.current === orchestrator.planRunId) return
    if (!planRunStatus) return
    if (!planRunStatus.allTerminal) return
    if (!orchestrator.planPaths || !orchestrator.parentTaskPath) return

    planOrchestratorTriggeredRef.current = orchestrator.planRunId

    orchestratePlanMutation.mutate({
      planRunId: orchestrator.planRunId,
      parentTaskPath: orchestrator.parentTaskPath,
      plan1Path: orchestrator.planPaths[0],
      plan2Path: orchestrator.planPaths[1],
    })
  }, [
    orchestrator.type,
    orchestrator.planRunId,
    orchestrator.triggered,
    orchestrator.sessionId,
    orchestrator.planPaths,
    orchestrator.parentTaskPath,
    planRunStatus,
    orchestratePlanMutation,
  ])

  return {
    handleCloseOrchestratorModal,
    debugRunStatus,
    planRunStatus,
  }
}
