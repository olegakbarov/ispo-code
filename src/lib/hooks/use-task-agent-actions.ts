/**
 * Task Agent Actions Hook
 *
 * Handles agent-related operations:
 * - Assign to agent (implementation)
 * - Cancel agent
 * - Verify with agent
 * - Rewrite plan with agent
 * - Review/debate mode navigation
 * - Auto-run phase transitions
 */

import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { taskTrpcOptions } from '@/lib/trpc-task'
import { useTaskTRPCClient } from '@/lib/hooks/use-task-client'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { hasCompletedExecutionSession, inferAutoRunPhase, parseAutoRunFromContent } from '@/lib/tasks/auto-run'
import type { AgentType } from '@/lib/agent/types'
import type {
  TasksAction,
  EditorState,
  RewriteState,
  RunAgentState,
  VerifyAgentState,
} from '@/lib/stores/tasks-reducer'

interface AgentSession {
  id: string
  status?: string
  title?: string
  prompt?: string
}

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

interface UseTaskAgentActionsParams {
  selectedPath: string | null
  dispatch: React.Dispatch<TasksAction>
  editor: EditorState
  run: RunAgentState
  verify: VerifyAgentState
  rewrite: RewriteState
  taskSessions: TaskSessionsData | undefined
  agentSession: AgentSession | null
  buildSearchParams: (overrideReviewFile?: string | null) => {
    archiveFilter: 'all' | 'active' | 'archived'
    sortBy?: 'updated' | 'title' | 'progress'
    sortDir?: 'asc' | 'desc'
    reviewFile?: string
  }
  saveMutation: any
  assignToAgentMutation: any
  cancelAgentMutation: ReturnType<typeof trpc.agent.cancel.useMutation>
  verifyWithAgentMutation: any
  rewriteWithAgentMutation: any
  clearRewriteDraft: () => void
}

export function useTaskAgentActions({
  selectedPath,
  dispatch,
  editor,
  run,
  verify,
  rewrite,
  taskSessions,
  agentSession,
  buildSearchParams,
  saveMutation,
  assignToAgentMutation,
  cancelAgentMutation,
  verifyWithAgentMutation,
  rewriteWithAgentMutation,
  clearRewriteDraft,
}: UseTaskAgentActionsParams) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()
  const taskTrpc = taskTrpcOptions(selectedPath ?? undefined)
  const taskClient = useTaskTRPCClient(selectedPath)

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAssignToAgent = useCallback(() => {
    if (!selectedPath) return
    dispatch({ type: 'SET_IMPLEMENT_MODAL_OPEN', payload: true })
  }, [selectedPath, dispatch])

  const handleCloseImplementModal = useCallback(() => {
    dispatch({ type: 'SET_IMPLEMENT_MODAL_OPEN', payload: false })
  }, [dispatch])

  const handleStartImplement = useCallback(async (agentType: AgentType, model: string | undefined, instructions?: string) => {
    if (!selectedPath) return

    // Save first if dirty
    if (editor.dirty) {
      await saveMutation.mutateAsync({ path: selectedPath, content: editor.draft })
      dispatch({ type: 'SET_DIRTY', payload: false })
    }

    try {
      dispatch({ type: 'SET_SAVE_ERROR', payload: null })
      await assignToAgentMutation.mutateAsync({
        path: selectedPath,
        agentType,
        model,
        instructions,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign to agent'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Failed to assign to agent:', err)
      throw err
    }
  }, [selectedPath, editor.dirty, editor.draft, saveMutation, assignToAgentMutation, dispatch])

  const handleCancelAgent = useCallback((sessionId: string) => {
    console.log('[handleCancelAgent] Cancelling session:', sessionId)
    cancelAgentMutation.mutate({ id: sessionId })
  }, [cancelAgentMutation])

  // ─────────────────────────────────────────────────────────────────────────────
  // Review/Verify Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleReview = useCallback(() => {
    if (!selectedPath) return
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/debate` },
      search: buildSearchParams(),
    })
  }, [selectedPath, navigate, buildSearchParams])

  const handleVerify = useCallback(() => {
    dispatch({ type: 'SET_VERIFY_MODAL_OPEN', payload: true })
  }, [dispatch])

  const handleCloseDebatePanel = useCallback(() => {
    if (!selectedPath) return
    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(selectedPath) },
      search: buildSearchParams(),
    })
  }, [selectedPath, navigate, buildSearchParams])

  const handleStartVerify = useCallback(async (agentType: AgentType, model: string | undefined, instructions?: string) => {
    if (!selectedPath) return

    try {
      dispatch({ type: 'SET_SAVE_ERROR', payload: null })
      await verifyWithAgentMutation.mutateAsync({
        path: selectedPath,
        agentType,
        model,
        instructions,
      })
    } catch (err) {
      console.error('Failed to start verify:', err)
      dispatch({ type: 'SET_SAVE_ERROR', payload: err instanceof Error ? err.message : 'Failed to start verify' })
      throw err
    }
  }, [selectedPath, verifyWithAgentMutation, dispatch])

  const handleCloseVerifyModal = useCallback(() => {
    dispatch({ type: 'SET_VERIFY_MODAL_OPEN', payload: false })
  }, [dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Debate Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDebateAccept = useCallback(async () => {
    if (!selectedPath) return

    utils.tasks.list.invalidate()

    try {
      const client = taskClient ?? utils.client
      const task = await client.tasks.get.query({ path: selectedPath })
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
    } catch (err) {
      console.error('Failed to refresh task after debate accept:', err)
    }
  }, [selectedPath, taskClient, utils, dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Rewrite Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleRewritePlan = useCallback(async () => {
    if (!selectedPath || !rewrite.comment.trim()) return

    try {
      dispatch({ type: 'SET_SAVE_ERROR', payload: null })
      await rewriteWithAgentMutation.mutateAsync({
        path: selectedPath,
        agentType: rewrite.agentType,
        model: rewrite.model || undefined,
        userComment: rewrite.comment,
      })
      dispatch({ type: 'RESET_REWRITE' })
      clearRewriteDraft()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rewrite plan'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Failed to rewrite plan:', err)
    }
  }, [selectedPath, rewrite.comment, rewrite.agentType, rewrite.model, rewriteWithAgentMutation, dispatch, clearRewriteDraft])

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Run Phase Transitions
  // ─────────────────────────────────────────────────────────────────────────────

  const autoRunTriggeredRef = useRef<Record<string, string | undefined>>({})
  const prevAutoRunStatusRef = useRef<Record<string, string | undefined>>({})

  // Query task data to get autoRun flag
  const { data: taskDataForAutoRun } = trpc.tasks.get.useQuery(
    { path: selectedPath ?? '' },
    { enabled: !!selectedPath, ...taskTrpc }
  )

  useEffect(() => {
    if (!selectedPath || !agentSession) return

    const prevStatus = prevAutoRunStatusRef.current[selectedPath]
    const currentStatus = agentSession.status

    // Update our own ref for next comparison
    prevAutoRunStatusRef.current[selectedPath] = currentStatus

    // Check if autoRun is enabled for this task
    const taskContent = taskDataForAutoRun?.content
    if (!taskContent) return

    const autoRun = parseAutoRunFromContent(taskContent)
    if (!autoRun) return

    // Skip on initial mount (no previous status yet)
    if (prevStatus === undefined) return

    // Only trigger once per session
    const triggerKey = `${selectedPath}-${agentSession.id}`
    if (autoRunTriggeredRef.current[triggerKey]) return

    const wasActive =
      prevStatus === 'running' ||
      prevStatus === 'pending' ||
      prevStatus === 'working' ||
      prevStatus === 'waiting_approval' ||
      prevStatus === 'waiting_input' ||
      prevStatus === 'idle'
    const isNowCompleted = currentStatus === 'completed'

    if (wasActive && isNowCompleted) {
      const phase = inferAutoRunPhase(agentSession.title, agentSession.prompt)
      if (!phase) return

      // Mark as triggered
      autoRunTriggeredRef.current[triggerKey] = currentStatus

      if (phase === 'planning') {
        // Planning completed → auto-trigger implementation
        console.log('[auto-run] Planning completed, triggering implementation...')

        // Delay to allow UI to update and commit message to be generated
        setTimeout(() => {
          // Get stored agent preferences from state
          const agentType = run.agentType
          const model = run.model

          handleStartImplement(agentType, model, undefined).catch((err) => {
            console.error('[auto-run] Failed to auto-trigger implementation:', err)
          })
        }, 2000)
      } else if (phase === 'execution') {
        // Implementation completed → auto-trigger verification
        // BUT first, validate that there's actually a completed execution session
        // This prevents verification from running if no implementation was done
        const executionSessions = taskSessions?.grouped?.execution
        const hasCompletedExecution = hasCompletedExecutionSession(executionSessions, currentStatus)

        if (!hasCompletedExecution) {
          console.log('[auto-run] Skipping verification: no completed execution session found')
          return
        }

        console.log('[auto-run] Implementation completed, triggering verification...')

        // Delay to allow UI to update
        setTimeout(() => {
          // Get stored agent preferences from state
          const agentType = verify.agentType
          const model = verify.model

          handleStartVerify(agentType, model, undefined).catch((err) => {
            console.error('[auto-run] Failed to auto-trigger verification:', err)
          })
        }, 2000)
      }
    }
  }, [
    selectedPath,
    agentSession?.id,
    agentSession?.status,
    agentSession?.title,
    agentSession?.prompt,
    taskDataForAutoRun?.content,
    taskSessions?.grouped?.execution,
    run.agentType,
    run.model,
    verify.agentType,
    verify.model,
    handleStartImplement,
    handleStartVerify,
  ])

  return {
    handleAssignToAgent,
    handleCloseImplementModal,
    handleStartImplement,
    handleCancelAgent,
    handleReview,
    handleVerify,
    handleCloseDebatePanel,
    handleStartVerify,
    handleCloseVerifyModal,
    handleDebateAccept,
    handleRewritePlan,
  }
}
