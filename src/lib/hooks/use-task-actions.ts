/**
 * Task Action Handlers Hook
 *
 * Consolidates all task action handlers:
 * - CRUD operations (create, delete, archive, restore)
 * - Agent operations (assign, cancel, verify, rewrite)
 * - Modal handlers
 * - Debate/split/commit handlers
 * - Orchestrator effects and handlers
 * - Pre-generate commit message effect
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useDebouncedCallback } from '@/lib/utils/debounce'
import { trpc } from '@/lib/trpc-client'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { generateOptimisticTaskPath } from '@/lib/utils/slugify'
import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'
import type { AgentSession } from '@/components/tasks/agent-types'
import type { MergeHistoryEntry } from '@/lib/agent/task-service'
import type {
  TasksAction,
  EditorState,
  CreateModalState,
  RunAgentState,
  VerifyAgentState,
  RewriteState,
  OrchestratorState,
  PendingCommitState,
} from '@/lib/stores/tasks-reducer'

interface TaskSummary {
  path: string
  title: string
  archived: boolean
}

interface TaskSessionsData {
  all: Array<{ sessionId: string }>
}

/** Extract autoRun flag from markdown content: <!-- autoRun: true|false --> */
function parseAutoRun(content: string): boolean | undefined {
  const match = content.match(/<!--\s*autoRun:\s*(true|false)\s*-->/)
  return match ? match[1] === 'true' : undefined
}

interface UseTaskActionsParams {
  selectedPath: string | null
  workingDir: string | null
  activeSessionId: string | null | undefined
  latestActiveMerge: MergeHistoryEntry | null | undefined
  mode?: 'edit' | 'review' | 'debate'
  dispatch: React.Dispatch<TasksAction>
  editor: EditorState
  create: CreateModalState
  run: RunAgentState
  verify: VerifyAgentState
  rewrite: RewriteState
  orchestrator: OrchestratorState
  pendingCommit: PendingCommitState
  tasks: TaskSummary[]
  taskSessions: TaskSessionsData | undefined
  selectedSummary: TaskSummary | null
  agentSession: AgentSession | null
  availablePlannerTypes: PlannerAgentType[]
  buildSearchParams: (overrideReviewFile?: string | null) => {
    archiveFilter: 'all' | 'active' | 'archived'
    sortBy?: 'updated' | 'title' | 'progress'
    sortDir?: 'asc' | 'desc'
    reviewFile?: string
  }
  // Mutations
  saveMutation: ReturnType<typeof trpc.tasks.save.useMutation>
  createMutation: ReturnType<typeof trpc.tasks.create.useMutation>
  createWithAgentMutation: ReturnType<typeof trpc.tasks.createWithAgent.useMutation>
  debugWithAgentsMutation: ReturnType<typeof trpc.tasks.debugWithAgents.useMutation>
  deleteMutation: ReturnType<typeof trpc.tasks.delete.useMutation>
  archiveMutation: ReturnType<typeof trpc.tasks.archive.useMutation>
  restoreMutation: ReturnType<typeof trpc.tasks.restore.useMutation>
  assignToAgentMutation: ReturnType<typeof trpc.tasks.assignToAgent.useMutation>
  cancelAgentMutation: ReturnType<typeof trpc.agent.cancel.useMutation>
  verifyWithAgentMutation: ReturnType<typeof trpc.tasks.verifyWithAgent.useMutation>
  rewriteWithAgentMutation: ReturnType<typeof trpc.tasks.rewriteWithAgent.useMutation>
  splitTaskMutation: ReturnType<typeof trpc.tasks.splitTask.useMutation>
  orchestrateMutation: ReturnType<typeof trpc.tasks.orchestrateDebugRun.useMutation>
  mergeBranchMutation: ReturnType<typeof trpc.git.mergeBranch.useMutation>
  recordMergeMutation: ReturnType<typeof trpc.tasks.recordMerge.useMutation>
  setQAStatusMutation: ReturnType<typeof trpc.tasks.setQAStatus.useMutation>
  revertMergeMutation: ReturnType<typeof trpc.git.revertMerge.useMutation>
  recordRevertMutation: ReturnType<typeof trpc.tasks.recordRevert.useMutation>
  // Draft management
  clearRewriteDraft: () => void
  clearCreateTitleDraft: () => void
}

export function useTaskActions({
  selectedPath,
  workingDir,
  activeSessionId,
  latestActiveMerge,
  mode,
  dispatch,
  editor,
  create,
  run,
  verify,
  rewrite,
  orchestrator,
  pendingCommit,
  tasks,
  taskSessions,
  selectedSummary,
  agentSession,
  availablePlannerTypes,
  buildSearchParams,
  saveMutation,
  createMutation,
  createWithAgentMutation,
  debugWithAgentsMutation,
  deleteMutation,
  archiveMutation,
  restoreMutation,
  assignToAgentMutation,
  cancelAgentMutation,
  verifyWithAgentMutation,
  rewriteWithAgentMutation,
  splitTaskMutation,
  orchestrateMutation,
  mergeBranchMutation,
  recordMergeMutation,
  setQAStatusMutation,
  revertMergeMutation,
  recordRevertMutation,
  clearRewriteDraft,
  clearCreateTitleDraft,
}: UseTaskActionsParams) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  // Pending commit values for current task
  const pendingCommitForSelected = selectedPath ? pendingCommit[selectedPath] : undefined
  const pendingCommitMessage = pendingCommitForSelected?.message ?? null
  const pendingCommitGenerating = pendingCommitForSelected?.isGenerating ?? false

  // ─────────────────────────────────────────────────────────────────────────────
  // Debounced Autosave
  // ─────────────────────────────────────────────────────────────────────────────

  const debouncedSave = useDebouncedCallback(
    async (path: string, content: string) => {
      dispatch({ type: 'SET_SAVING', payload: true })
      try {
        await saveMutation.mutateAsync({ path, content })
      } catch {
        // Error handled in onError callback
      } finally {
        dispatch({ type: 'SET_SAVING', payload: false })
      }
    },
    500
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Modal Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    dispatch({ type: 'OPEN_CREATE_MODAL' })
  }, [dispatch])

  const handleCloseCreate = useCallback(() => {
    dispatch({ type: 'CLOSE_CREATE_MODAL' })
    if (selectedPath) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(selectedPath) },
        search: buildSearchParams(),
      })
    } else {
      navigate({ to: '/tasks', search: buildSearchParams() })
    }
  }, [dispatch, navigate, selectedPath, buildSearchParams])

  const handleCreate = useCallback(() => {
    const title = create.title.trim()
    if (!title) return

    // Generate optimistic path for immediate navigation
    const existingPaths = new Set(tasks.map(t => t.path))
    const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

    // Optimistic update: reset state and clear draft immediately for instant feedback
    dispatch({ type: 'RESET_CREATE_MODAL' })
    clearCreateTitleDraft()

    // Navigate immediately to optimistic path (0ms latency)
    if (!create.useAgent) {
      // For basic create, navigate to task editor immediately
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(optimisticPath) },
        search: buildSearchParams(),
      })
    }

    // Fire mutation without await (fire-and-forget pattern)
    // The mutation will handle reconciliation and redirect if needed
    if (create.useAgent) {
      if (create.taskType === 'bug') {
        const selectedAgents = create.debugAgents
          .filter((da) => da.selected)
          .map((da) => ({ agentType: da.agentType, model: da.model || undefined }))

        if (selectedAgents.length > 0) {
          debugWithAgentsMutation.mutate(
            { title, agents: selectedAgents, autoRun: create.autoRun },
            { onError: (err) => console.error('Failed to create debug task:', err) }
          )
        }
      } else {
        createWithAgentMutation.mutate(
          {
            title,
            taskType: create.taskType,
            agentType: create.agentType,
            model: create.model || undefined,
            autoRun: create.autoRun,
          },
          { onError: (err) => console.error('Failed to create task with agent:', err) }
        )
      }
    } else {
      createMutation.mutate(
        { title },
        { onError: (err) => console.error('Failed to create task:', err) }
      )
    }
  }, [
    create.title,
    create.useAgent,
    create.taskType,
    create.debugAgents,
    create.agentType,
    create.model,
    tasks,
    debugWithAgentsMutation,
    createWithAgentMutation,
    createMutation,
    dispatch,
    clearCreateTitleDraft,
    navigate,
    buildSearchParams,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!selectedPath) return

    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      payload: {
        open: true,
        title: 'Delete Task',
        message: 'Are you sure you want to delete this task?',
        confirmText: 'Delete',
        variant: 'danger',
        onConfirm: async () => {
          try {
            await deleteMutation.mutateAsync({ path: selectedPath })
          } catch (err) {
            console.error('Failed to delete task:', err)
          }
        },
      },
    })
  }, [selectedPath, deleteMutation, dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Archive/Restore Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!selectedPath) return

    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      payload: {
        open: true,
        title: 'Archive Task',
        message: 'Archive this task? It will be moved to tasks/archive/',
        confirmText: 'Archive',
        variant: 'default',
        onConfirm: async () => {
          try {
            await archiveMutation.mutateAsync({ path: selectedPath })
          } catch (err) {
            console.error('Failed to archive task:', err)
          }
        },
      },
    })
  }, [selectedPath, archiveMutation, dispatch])

  const handleRestore = useCallback(async () => {
    if (!selectedPath) return
    try {
      await restoreMutation.mutateAsync({ path: selectedPath })
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }, [selectedPath, restoreMutation])

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
  // Split Task Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleOpenSplitModal = useCallback(() => {
    dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: true })
  }, [dispatch])

  const handleCloseSplitModal = useCallback(() => {
    dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: false })
  }, [dispatch])

  const handleSplitTask = useCallback(async (sectionIndices: number[], archiveOriginal: boolean) => {
    if (!selectedPath) return

    try {
      await splitTaskMutation.mutateAsync({
        sourcePath: selectedPath,
        sectionIndices,
        archiveOriginal,
      })
    } catch (err) {
      console.error('Failed to split task:', err)
    }
  }, [selectedPath, splitTaskMutation])

  // ─────────────────────────────────────────────────────────────────────────────
  // Commit/Archive Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleOpenCommitArchiveModal = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: true })
  }, [dispatch])

  const handleCloseCommitArchiveModal = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: false })
    if (selectedPath) {
      dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
    }
  }, [selectedPath, dispatch])

  const handleCommitSuccess = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: false })
    if (selectedPath) {
      dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
    }
  }, [selectedPath, dispatch])

  const handleArchiveSuccess = useCallback(() => {
    const topmostTask = tasks.find(
      (t) => !t.archived && t.path !== selectedPath
    )
    if (topmostTask) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(topmostTask.path) },
        search: buildSearchParams(),
      })
    } else {
      navigate({ to: '/tasks', search: buildSearchParams() })
    }
  }, [tasks, selectedPath, navigate, buildSearchParams])

  // ─────────────────────────────────────────────────────────────────────────────
  // QA Workflow Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleMergeSuccess = useCallback(() => {
    utils.tasks.get.invalidate()
    utils.tasks.getLatestActiveMerge.invalidate()
  }, [utils])

  const expectedWorktreeBranch = activeSessionId ? `agentz/session-${activeSessionId}` : undefined
  const { data: branchData } = trpc.git.branches.useQuery(undefined, {
    enabled: !!workingDir && !!expectedWorktreeBranch,
  })
  const activeWorktreeBranch = useMemo(() => {
    if (!expectedWorktreeBranch || !branchData?.all) return undefined
    return branchData.all.includes(expectedWorktreeBranch) ? expectedWorktreeBranch : undefined
  }, [expectedWorktreeBranch, branchData?.all])

  const handleMergeToMain = useCallback(async () => {
    if (!selectedPath || !activeSessionId || !activeWorktreeBranch) return

    dispatch({ type: 'SET_SAVE_ERROR', payload: null })
    try {
      const mergeResult = await mergeBranchMutation.mutateAsync({
        targetBranch: 'main',
        sourceBranch: activeWorktreeBranch,
      })

      if (mergeResult.success && mergeResult.mergeCommitHash) {
        await recordMergeMutation.mutateAsync({
          path: selectedPath,
          sessionId: activeSessionId,
          commitHash: mergeResult.mergeCommitHash,
        })
      } else if (!mergeResult.success) {
        dispatch({ type: 'SET_SAVE_ERROR', payload: mergeResult.error || 'Merge failed' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Merge failed'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Merge to main failed:', err)
    }
  }, [
    selectedPath,
    activeSessionId,
    activeWorktreeBranch,
    mergeBranchMutation,
    recordMergeMutation,
    dispatch,
  ])

  const handleSetQAPass = useCallback(async () => {
    if (!selectedPath) return

    try {
      await setQAStatusMutation.mutateAsync({
        path: selectedPath,
        status: 'pass',
      })
    } catch (err) {
      console.error('Failed to set QA pass:', err)
    }
  }, [selectedPath, setQAStatusMutation])

  const handleSetQAFail = useCallback(async () => {
    if (!selectedPath) return

    try {
      await setQAStatusMutation.mutateAsync({
        path: selectedPath,
        status: 'fail',
      })
    } catch (err) {
      console.error('Failed to set QA fail:', err)
    }
  }, [selectedPath, setQAStatusMutation])

  const handleRevertMerge = useCallback(async () => {
    if (!selectedPath || !latestActiveMerge) return

    dispatch({ type: 'SET_SAVE_ERROR', payload: null })
    try {
      const revertResult = await revertMergeMutation.mutateAsync({
        mergeCommitHash: latestActiveMerge.commitHash,
      })

      if (revertResult.success && revertResult.revertCommitHash) {
        await recordRevertMutation.mutateAsync({
          path: selectedPath,
          mergeCommitHash: latestActiveMerge.commitHash,
          revertCommitHash: revertResult.revertCommitHash,
        })
      } else if (!revertResult.success) {
        dispatch({ type: 'SET_SAVE_ERROR', payload: revertResult.error || 'Revert failed' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Revert failed'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Revert merge failed:', err)
    }
  }, [
    selectedPath,
    latestActiveMerge,
    revertMergeMutation,
    recordRevertMutation,
    dispatch,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Debate Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDebateAccept = useCallback(async () => {
    if (!selectedPath) return

    utils.tasks.list.invalidate()

    try {
      const task = await utils.client.tasks.get.query({ path: selectedPath })
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
    } catch (err) {
      console.error('Failed to refresh task after debate accept:', err)
    }
  }, [selectedPath, utils, dispatch])

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-generate Commit Message - Shared Helper
  // ─────────────────────────────────────────────────────────────────────────────

  const triggerCommitMessageGeneration = useCallback(() => {
    if (!selectedPath) return
    if (pendingCommitGenerating || pendingCommitMessage) return

    dispatch({
      type: 'SET_PENDING_COMMIT_GENERATING',
      payload: { path: selectedPath, isGenerating: true },
    })

    utils.client.tasks.getChangedFilesForTask
      .query({ path: selectedPath })
      .then((files) => {
        if (files.length === 0) {
          dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
          return
        }

        const gitRelativeFiles = files.map(
          (f) => f.repoRelativePath || f.relativePath || f.path
        )
        const taskTitle = selectedSummary?.title ?? 'Task'

        return utils.client.git.generateCommitMessage
          .mutate({
            taskTitle,
            taskDescription: editor.draft,
            files: gitRelativeFiles,
          })
          .then((result) => {
            dispatch({
              type: 'SET_PENDING_COMMIT_MESSAGE',
              payload: { path: selectedPath, message: result.message },
            })
          })
      })
      .catch((err) => {
        console.error('Failed to pre-generate commit message:', err)
      })
      .finally(() => {
        dispatch({
          type: 'SET_PENDING_COMMIT_GENERATING',
          payload: { path: selectedPath, isGenerating: false },
        })
      })
  }, [
    selectedPath,
    pendingCommitGenerating,
    pendingCommitMessage,
    selectedSummary?.title,
    editor.draft,
    utils.client.tasks.getChangedFilesForTask,
    utils.client.git.generateCommitMessage,
    dispatch,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-generate on Agent Completion
  // ─────────────────────────────────────────────────────────────────────────────

  const prevAgentStatusRef = useRef<Record<string, string | undefined>>({})

  useEffect(() => {
    if (!selectedPath) return

    const prevStatus = prevAgentStatusRef.current[selectedPath]
    const currentStatus = agentSession?.status
    prevAgentStatusRef.current[selectedPath] = currentStatus

    if (prevStatus === undefined) return

    const wasActive = prevStatus === 'running' || prevStatus === 'pending'
    const isNowCompleted = currentStatus === 'completed'

    if (wasActive && isNowCompleted) {
      triggerCommitMessageGeneration()
    }
  }, [selectedPath, agentSession?.status, triggerCommitMessageGeneration])

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-generate on Review Mode Entry
  // ─────────────────────────────────────────────────────────────────────────────

  const prevModeRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!selectedPath) return

    const prevMode = prevModeRef.current
    prevModeRef.current = mode

    // Skip on initial mount
    if (prevMode === undefined) return

    // Only trigger when transitioning TO review mode
    const isEnteringReview = prevMode !== 'review' && mode === 'review'

    if (isEnteringReview) {
      triggerCommitMessageGeneration()
    }
  }, [selectedPath, mode, triggerCommitMessageGeneration])

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-Run Phase Transitions
  // ─────────────────────────────────────────────────────────────────────────────

  const autoRunTriggeredRef = useRef<Record<string, string | undefined>>({})

  // Query task data to get autoRun flag
  const { data: taskDataForAutoRun } = trpc.tasks.get.useQuery(
    { path: selectedPath ?? '' },
    { enabled: !!selectedPath }
  )

  useEffect(() => {
    if (!selectedPath || !agentSession) return

    const prevStatus = prevAgentStatusRef.current[selectedPath]
    const currentStatus = agentSession.status

    // Check if autoRun is enabled for this task
    const taskContent = taskDataForAutoRun?.content
    if (!taskContent) return

    const autoRun = parseAutoRun(taskContent)
    if (!autoRun) return

    // Only trigger once per session
    const triggerKey = `${selectedPath}-${agentSession.id}`
    if (autoRunTriggeredRef.current[triggerKey]) return

    const wasActive = prevStatus === 'running' || prevStatus === 'pending'
    const isNowCompleted = currentStatus === 'completed'

    if (wasActive && isNowCompleted) {
      // Determine session type by checking prompt or title
      const sessionTitle = agentSession.title?.toLowerCase() || agentSession.prompt.toLowerCase()
      const isPlanningSession = sessionTitle.includes('plan:') || sessionTitle.includes('debug:')
      const isImplementationSession = sessionTitle.includes('implement') || sessionTitle.includes('execution')

      // Mark as triggered
      autoRunTriggeredRef.current[triggerKey] = currentStatus

      if (isPlanningSession) {
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
      } else if (isImplementationSession) {
        // Implementation completed → auto-trigger verification
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
    run.agentType,
    run.model,
    verify.agentType,
    verify.model,
    handleStartImplement,
    handleStartVerify,
  ])

  return {
    // Create modal
    openCreate,
    handleCloseCreate,
    handleCreate,

    // CRUD
    handleDelete,
    handleArchive,
    handleRestore,

    // Agent operations
    handleAssignToAgent,
    handleCloseImplementModal,
    handleStartImplement,
    handleCancelAgent,

    // Review/Verify
    handleReview,
    handleVerify,
    handleCloseDebatePanel,
    handleStartVerify,
    handleCloseVerifyModal,

    // Split
    handleOpenSplitModal,
    handleCloseSplitModal,
    handleSplitTask,

    // Commit/Archive
    handleOpenCommitArchiveModal,
    handleCloseCommitArchiveModal,
    handleCommitSuccess,
    handleArchiveSuccess,
    handleMergeSuccess,
    activeWorktreeBranch,
    handleMergeToMain,
    handleSetQAPass,
    handleSetQAFail,
    handleRevertMerge,

    // Debate
    handleDebateAccept,

    // Rewrite
    handleRewritePlan,

    // Orchestrator
    handleCloseOrchestratorModal,

    // Autosave
    debouncedSave,

    // Pending commit state
    pendingCommitMessage,
    pendingCommitGenerating,
  }
}
