/**
 * Tasks Page - Shared component for tasks routes
 *
 * This is the actual tasks UI, used by:
 * - /tasks (no task selected)
 * - /tasks/$ (task selected via splat param)
 * - /tasks/new (create modal open)
 */

import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useDebouncedCallback } from '@/lib/utils/debounce'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import type { AgentType, SessionStatus } from '@/lib/agent/types'
import { TaskEditor } from '@/components/tasks/task-editor'
import { TaskFooter } from '@/components/tasks/task-footer'
import { TaskSidebar } from '@/components/tasks/task-sidebar'
import { CreateTaskModal, ALL_PLANNER_CANDIDATES } from '@/components/tasks/create-task-modal'
import { CreateTaskForm, CreateTaskActions } from '@/components/tasks/create-task-form'
import { ReviewModal } from '@/components/tasks/review-modal'
import { ImplementModal } from '@/components/tasks/implement-modal'
import { SplitTaskModal } from '@/components/tasks/split-task-modal'
import { CommitArchiveModal } from '@/components/tasks/commit-archive-modal'
import { DebatePanel } from '@/components/debate'
import { OrchestratorModal } from '@/components/tasks/orchestrator-modal'
import type { PlannerAgentType } from '@/lib/agent/config'
import type { AgentSession } from '@/components/tasks/agent-types'
import { trpc } from '@/lib/trpc-client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { tasksReducer, createInitialState } from '@/lib/stores/tasks-reducer'
import { useSynchronizeAgentType } from '@/lib/hooks/use-synchronize-agent-type'
import { useAudioNotification } from '@/lib/hooks/use-audio-notification'
import { isTerminalStatus } from '@/lib/agent/status'
import { useSettingsStore } from '@/lib/stores/settings'

type Mode = 'edit' | 'review' | 'debate'

interface TasksPageProps {
  /** Selected task path (decoded from URL) */
  selectedPath: string | null
  /** Current mode (edit or review) from URL */
  mode?: Mode
  /** Whether the create modal should be open */
  createModalOpen: boolean
  /** Archive filter from search params */
  archiveFilter: 'all' | 'active' | 'archived'
  /** Sort option from search params */
  sortBy?: 'updated' | 'title' | 'progress'
  /** Sort direction from search params */
  sortDir?: 'asc' | 'desc'
  /** Selected file in review mode (git-relative path) */
  reviewFile?: string
}

export function TasksPage({
  selectedPath,
  mode = 'edit',
  createModalOpen: initialCreateOpen,
  archiveFilter,
  sortBy,
  sortDir,
  reviewFile,
}: TasksPageProps) {
  const navigate = useNavigate()
  const { data: workingDir } = trpc.system.workingDir.useQuery()
  const utils = trpc.useUtils()

  // Task list from server
  const { data: tasks = [] } = trpc.tasks.list.useQuery(undefined, {
    enabled: !!workingDir,
    refetchInterval: 5000, // Refresh every 5s for progress updates
  })

  // Available agent types
  const { data: availableTypes = [] } = trpc.agent.availableTypes.useQuery()

  // Active agent sessions for tasks
  const { data: activeAgentSessions = {} } = trpc.tasks.getActiveAgentSessions.useQuery(undefined, {
    enabled: !!workingDir,
    refetchInterval: 2000, // Poll for agent status updates
  })

  // Sessions for selected task
  const { data: taskSessions } = trpc.tasks.getSessionsForTask.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
      refetchInterval: 5000, // Refresh session list periodically
    }
  )

  // Get sections for split modal
  const { data: sectionsData } = trpc.tasks.getSections.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
    }
  )

  // Get full task data (for splitFrom field)
  const { data: taskData } = trpc.tasks.get.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
    }
  )

  // Get latest active merge for QA workflow
  const { data: latestActiveMerge } = trpc.tasks.getLatestActiveMerge.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
    }
  )

  // Get active debate for current task (if any)
  // Query always when task is selected - needed to show "Resume Review" in sidebar
  const { data: activeDebate } = trpc.debate.getForTask.useQuery(
    { path: selectedPath ?? '' },
    {
      enabled: !!selectedPath && !!workingDir,
      refetchInterval: mode === 'debate' ? 2000 : false, // Poll faster while in debate mode
    }
  )

  const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
    const candidates: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'mcporter']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  // Consolidated state via reducer
  const [state, dispatch] = useReducer(tasksReducer, initialCreateOpen, createInitialState)
  const lastLoadedPathRef = useRef<string | null>(null)

  // Destructure for convenience
  const { editor, create, run, verify, rewrite, save, modals, pendingCommit, confirmDialog, orchestrator } = state

  // Draft persistence for create task title (global, persists across refreshes)
  const [createTitleDraft, setCreateTitleDraft, clearCreateTitleDraft] = useTextareaDraft(
    'create-task-title',
    ''
  )

  // Sync create title draft with reducer state (bidirectional)
  useEffect(() => {
    if (createTitleDraft !== create.title) {
      dispatch({ type: 'SET_CREATE_TITLE', payload: createTitleDraft })
    }
  }, [createTitleDraft, create.title])

  // Draft persistence for rewrite comment (per-task)
  const [rewriteDraft, setRewriteDraft, clearRewriteDraft] = useTextareaDraft(
    selectedPath ? `task-rewrite:${selectedPath}` : '',
    '',
    { skipRestore: !selectedPath }
  )

  // Sync rewrite draft with reducer state (bidirectional)
  useEffect(() => {
    if (rewriteDraft !== rewrite.comment) {
      dispatch({ type: 'SET_REWRITE_COMMENT', payload: rewriteDraft })
    }
  }, [rewriteDraft, rewrite.comment])

  // Track active agent session for progress display (from polling)
  const activeSessionInfo = selectedPath ? activeAgentSessions[selectedPath] : undefined
  const activeSessionId = activeSessionInfo?.sessionId
  const pendingCommitForSelected = selectedPath ? pendingCommit[selectedPath] : undefined
  const pendingCommitMessage = pendingCommitForSelected?.message ?? null
  const pendingCommitGenerating = pendingCommitForSelected?.isGenerating ?? false


  const { data: liveSession } = trpc.agent.get.useQuery(
    { id: activeSessionId ?? '' },
    {
      enabled: !!activeSessionId,
      refetchInterval: 1000,
    }
  )

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

  useAudioNotification({
    status: audioSessionSnapshot?.status,
    sessionId: audioSessionSnapshot?.id,
  })

  // Check if active session is a planning session
  const isActivePlanningSession = useMemo(() => {
    if (!agentSession?.id || !taskSessions?.grouped.planning) return false
    return taskSessions.grouped.planning.some(
      (s) => s.sessionId === agentSession.id && ['pending', 'running', 'working'].includes(s.status)
    )
  }, [agentSession?.id, taskSessions?.grouped.planning])

  // Handler for create agent type change
  const handleCreateAgentTypeChange = useCallback((newType: PlannerAgentType) => {
    dispatch({ type: 'SET_CREATE_AGENT_TYPE', payload: newType })
  }, [])

  // Handler for run agent type change
  const handleRunAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_RUN_AGENT_TYPE', payload: newType })
  }, [])

  // Handler for rewrite agent type change
  const handleRewriteAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_REWRITE_AGENT_TYPE', payload: newType })
  }, [])

  // Handler for verify agent type change
  const handleVerifyAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_VERIFY_AGENT_TYPE', payload: newType })
  }, [])

  // Synchronize agent type selections when availability changes
  const plannerPreferredOrder: PlannerAgentType[] = useMemo(
    () => ['claude', 'codex', 'cerebras', 'opencode', 'mcporter'],
    []
  )
  const agentPreferredOrder: AgentType[] = useMemo(
    () => ['claude', 'codex', 'cerebras', 'opencode', 'gemini'],
    []
  )

  useSynchronizeAgentType({
    currentType: create.agentType,
    availableTypes: availablePlannerTypes,
    preferredOrder: plannerPreferredOrder,
    onTypeChange: handleCreateAgentTypeChange,
  })

  useSynchronizeAgentType({
    currentType: run.agentType,
    availableTypes,
    preferredOrder: agentPreferredOrder,
    onTypeChange: handleRunAgentTypeChange,
  })

  useSynchronizeAgentType({
    currentType: rewrite.agentType,
    availableTypes,
    preferredOrder: agentPreferredOrder,
    onTypeChange: handleRewriteAgentTypeChange,
  })

  // Verification prefers codex
  const verifyPreferredOrder: AgentType[] = useMemo(
    () => ['codex', 'claude', 'cerebras', 'opencode', 'gemini'],
    []
  )

  useSynchronizeAgentType({
    currentType: verify.agentType,
    availableTypes,
    preferredOrder: verifyPreferredOrder,
    onTypeChange: handleVerifyAgentTypeChange,
  })

  // Initialize debug agents with ALL candidates (not just available ones)
  // This ensures unavailable agents show as disabled with "(N/A)" indicator
  useEffect(() => {
    if (create.debugAgents.length === 0) {
      dispatch({ type: 'INIT_DEBUG_AGENTS', payload: ALL_PLANNER_CANDIDATES })
    }
  }, [create.debugAgents.length])

  // Apply settings defaults on mount
  const {
    defaultPlanningAgentType,
    defaultVerifyAgentType,
    defaultVerifyModelId,
  } = useSettingsStore()

  const hasAppliedSettingsRef = useRef(false)
  useEffect(() => {
    if (hasAppliedSettingsRef.current) return
    hasAppliedSettingsRef.current = true

    // Apply default planning agent from settings
    if (defaultPlanningAgentType && availablePlannerTypes.includes(defaultPlanningAgentType)) {
      dispatch({ type: 'SET_CREATE_AGENT_TYPE', payload: defaultPlanningAgentType })
    }

    // Apply default verify agent and model from settings
    if (defaultVerifyAgentType && availableTypes.includes(defaultVerifyAgentType)) {
      dispatch({ type: 'SET_VERIFY_AGENT_TYPE', payload: defaultVerifyAgentType })
      if (defaultVerifyModelId) {
        dispatch({ type: 'SET_VERIFY_MODEL', payload: defaultVerifyModelId })
      }
    }
  }, [
    defaultPlanningAgentType,
    defaultVerifyAgentType,
    defaultVerifyModelId,
    availablePlannerTypes,
    availableTypes,
  ])

  // Build search params for navigation (preserves filter/sort and reviewFile in review mode)
  const buildSearchParams = useCallback((overrideReviewFile?: string | null) => {
    const params: {
      archiveFilter: typeof archiveFilter
      sortBy?: typeof sortBy
      sortDir?: typeof sortDir
      reviewFile?: string
    } = { archiveFilter, sortBy, sortDir }

    // Include reviewFile if provided or if we're in review mode with an existing value
    const fileToUse = overrideReviewFile !== undefined ? overrideReviewFile : reviewFile
    if (fileToUse) {
      params.reviewFile = fileToUse
    }
    return params
  }, [archiveFilter, sortBy, sortDir, reviewFile])

  // Navigate to change mode (edit/review) via URL
  const handleModeChange = useCallback((newMode: Mode) => {
    if (!selectedPath) return
    // Clear reviewFile when leaving review mode
    const searchParams = newMode === 'review' ? buildSearchParams() : buildSearchParams(null)
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/${newMode}` },
      search: searchParams,
    })
  }, [selectedPath, navigate, buildSearchParams])

  // Update reviewFile in URL when a file is selected in review panel
  const handleReviewFileChange = useCallback((file: string | null) => {
    if (!selectedPath || mode !== 'review') return
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/review` },
      search: buildSearchParams(file),
      replace: true, // Replace history entry to avoid polluting back button
    })
  }, [selectedPath, mode, navigate, buildSearchParams])

  // Mutations
  const saveMutation = trpc.tasks.save.useMutation({
    onMutate: async ({ path, content }) => {
      // 1. Cancel outgoing refetches
      await utils.tasks.get.cancel({ path })

      // 2. Snapshot current state for rollback
      const previousTask = utils.tasks.get.getData({ path })
      const previousDirty = editor.dirty

      // 3. Optimistically mark as clean (content already in draft)
      dispatch({ type: 'SET_DIRTY', payload: false })
      dispatch({ type: 'SET_SAVE_ERROR', payload: null })

      // 4. Optimistically update cache with new content
      if (previousTask) {
        utils.tasks.get.setData({ path }, {
          ...previousTask,
          content,
        })
      }

      return { previousTask, previousDirty, path }
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousTask) {
        utils.tasks.get.setData({ path: context.path }, context.previousTask)
      }
      if (context?.previousDirty !== undefined) {
        dispatch({ type: 'SET_DIRTY', payload: context.previousDirty })
      }
      dispatch({ type: 'SET_SAVE_ERROR', payload: err instanceof Error ? err.message : 'Failed to save' })
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency
      utils.tasks.list.invalidate()
      utils.tasks.get.invalidate({ path: variables.path })
    },
  })

  const createMutation = trpc.tasks.create.useMutation({
    onMutate: async ({ title }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Generate temp path for optimistic entry
      const tempPath = `tasks/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-temp.md`

      // Optimistically add to list with default progress
      const now = new Date().toISOString()
      if (previousList) {
        utils.tasks.list.setData(undefined, [
          {
            path: tempPath,
            title,
            archived: false,
            createdAt: now,
            updatedAt: now,
            source: 'tasks-dir' as const,
            progress: { total: 0, done: 0, inProgress: 0 },
            subtaskCount: 0,
            hasSubtasks: false,
          },
          ...previousList,
        ])
      }

      return { previousList, tempPath }
    },
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      // Navigate to the new task using route segment
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(data.path) },
        search: buildSearchParams(),
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  const createWithAgentMutation = trpc.tasks.createWithAgent.useMutation({
    onMutate: async ({ title }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Generate temp path for optimistic entry
      const tempPath = `tasks/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-temp.md`

      // Optimistically add to list with default progress
      const now = new Date().toISOString()
      if (previousList) {
        utils.tasks.list.setData(undefined, [
          {
            path: tempPath,
            title,
            archived: false,
            createdAt: now,
            updatedAt: now,
            source: 'tasks-dir' as const,
            progress: { total: 0, done: 0, inProgress: 0 },
            subtaskCount: 0,
            hasSubtasks: false,
          },
          ...previousList,
        ])
      }

      return { previousList, tempPath }
    },
    onSuccess: (data, _variables, context) => {
      // Remove temp entry
      if (context?.tempPath && context.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      utils.tasks.list.invalidate()
      // Navigate to agent session to watch planning in real-time
      navigate({
        to: '/agents/$sessionId',
        params: { sessionId: data.sessionId },
        search: { taskPath: data.path },
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  const debugWithAgentsMutation = trpc.tasks.debugWithAgents.useMutation({
    onMutate: async ({ title }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Generate temp path for optimistic entry
      const tempPath = `tasks/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-temp.md`

      // Optimistically add to list with default progress
      const now = new Date().toISOString()
      if (previousList) {
        utils.tasks.list.setData(undefined, [
          {
            path: tempPath,
            title,
            archived: false,
            createdAt: now,
            updatedAt: now,
            source: 'tasks-dir' as const,
            progress: { total: 0, done: 0, inProgress: 0 },
            subtaskCount: 0,
            hasSubtasks: false,
          },
          ...previousList,
        ])
      }

      return { previousList, tempPath }
    },
    onSuccess: (data, _variables, context) => {
      // Remove temp entry
      if (context?.tempPath && context.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      utils.tasks.list.invalidate()

      // Track this debug run for orchestrator triggering
      if (data.debugRunId) {
        dispatch({ type: 'SET_ORCHESTRATOR_TRIGGERED', payload: data.debugRunId })
      }

      // Navigate to first agent session to watch debugging
      navigate({
        to: '/agents/$sessionId',
        params: { sessionId: data.sessionIds[0] },
        search: { taskPath: data.path },
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  const deleteMutation = trpc.tasks.delete.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Optimistically remove task from list
      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.filter((task) => task.path !== path))
      }

      return { previousList, path }
    },
    onSuccess: () => {
      utils.tasks.list.invalidate()
      // Navigate to tasks list (no selection)
      navigate({ to: '/tasks', search: buildSearchParams() })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  const archiveMutation = trpc.tasks.archive.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Optimistically mark task as archived in the list
      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === path
            ? { ...task, archived: true, archivedAt: new Date().toISOString() }
            : task
        ))
      }

      return { previousList, path }
    },
    onSuccess: (_data, _variables, context) => {
      utils.tasks.list.invalidate()
      // Navigate to topmost non-archived task, or tasks list if none
      const currentList = context?.previousList ?? tasks
      const topmostTask = currentList.find(
        (t) => !t.archived && t.path !== context?.path
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
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  const restoreMutation = trpc.tasks.restore.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Optimistically mark task as not archived
      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === path
            ? { ...task, archived: false, archivedAt: undefined }
            : task
        ))
      }

      return { previousList, path }
    },
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      // Navigate to the restored task
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(data.path) },
        search: buildSearchParams(),
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.getActiveAgentSessions.cancel()

      // Snapshot for rollback (may be undefined if query hasn't resolved)
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      // Optimistically add placeholder session with 'pending' status
      // Always set data, even if previousSessions is undefined (empty cache)
      utils.tasks.getActiveAgentSessions.setData(undefined, {
        ...(previousSessions ?? {}),
        [path]: {
          sessionId: `pending-${Date.now()}`,
          status: 'pending',
        },
      })

      return { previousSessions, path }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        // Cache was empty before, remove the optimistic entry
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  const cancelAgentMutation = trpc.agent.cancel.useMutation({
    onMutate: async ({ id }) => {
      // Cancel outgoing refetches
      await utils.tasks.getActiveAgentSessions.cancel()

      // Snapshot for rollback (may be undefined if query hasn't resolved)
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      // Optimistically remove session from active sessions
      if (previousSessions !== undefined) {
        const updatedSessions = { ...previousSessions }
        // Find and remove the session by sessionId
        for (const [taskPath, session] of Object.entries(previousSessions)) {
          if (session.sessionId === id) {
            delete updatedSessions[taskPath]
            break
          }
        }
        utils.tasks.getActiveAgentSessions.setData(undefined, updatedSessions)
      }

      return { previousSessions }
    },
    onSuccess: (data) => {
      console.log('[cancelAgentMutation] Success:', data)
      if (selectedPath) {
        utils.tasks.get.invalidate({ path: selectedPath })
      }
      utils.tasks.list.invalidate()
    },
    onError: (error, _variables, context) => {
      console.error('[cancelAgentMutation] Error:', error)
      // Rollback on error
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  const verifyWithAgentMutation = trpc.tasks.verifyWithAgent.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.getActiveAgentSessions.cancel()

      // Snapshot for rollback (may be undefined if query hasn't resolved)
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      // Optimistically add placeholder session with 'pending' status
      // Always set data, even if previousSessions is undefined (empty cache)
      utils.tasks.getActiveAgentSessions.setData(undefined, {
        ...(previousSessions ?? {}),
        [path]: {
          sessionId: `pending-verify-${Date.now()}`,
          status: 'pending',
        },
      })

      return { previousSessions, path }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        // Cache was empty before, remove the optimistic entry
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  const rewriteWithAgentMutation = trpc.tasks.rewriteWithAgent.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.getActiveAgentSessions.cancel()

      // Snapshot for rollback (may be undefined if query hasn't resolved)
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      // Optimistically add placeholder session with 'pending' status
      // Always set data, even if previousSessions is undefined (empty cache)
      utils.tasks.getActiveAgentSessions.setData(undefined, {
        ...(previousSessions ?? {}),
        [path]: {
          sessionId: `pending-rewrite-${Date.now()}`,
          status: 'pending',
        },
      })

      return { previousSessions, path }
    },
    onSuccess: (data) => {
      // Navigate to agent session to watch rewriting in real-time
      navigate({
        to: '/agents/$sessionId',
        params: { sessionId: data.sessionId },
        search: { taskPath: data.path },
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        // Cache was empty before, remove the optimistic entry
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  const splitTaskMutation = trpc.tasks.splitTask.useMutation({
    onMutate: async ({ sourcePath, archiveOriginal }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Optimistically mark original as archived if requested
      if (archiveOriginal && previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === sourcePath
            ? { ...task, archived: true, archivedAt: new Date().toISOString() }
            : task
        ))
      }

      return { previousList, sourcePath }
    },
    onSuccess: (data) => {
      // Invalidate task list cache
      utils.tasks.list.invalidate()

      // Close the modal
      dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: false })

      // Navigate to first new task using route segment
      if (data.newPaths.length > 0) {
        navigate({
          to: '/tasks/$',
          params: { _splat: encodeTaskPath(data.newPaths[0]) },
          search: buildSearchParams(),
        })
      }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  // === QA Workflow Mutations ===

  const mergeBranchMutation = trpc.git.mergeBranch.useMutation({
    onError: (err) => {
      dispatch({ type: 'SET_SAVE_ERROR', payload: `Merge failed: ${err.message}` })
    },
  })

  const recordMergeMutation = trpc.tasks.recordMerge.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
    },
    onError: (err) => {
      console.error('Failed to record merge:', err.message)
    },
  })

  const setQAStatusMutation = trpc.tasks.setQAStatus.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
    },
    onError: (err) => {
      dispatch({ type: 'SET_SAVE_ERROR', payload: `Failed to set QA status: ${err.message}` })
    },
  })

  const revertMergeMutation = trpc.git.revertMerge.useMutation({
    onError: (err) => {
      dispatch({ type: 'SET_SAVE_ERROR', payload: `Revert failed: ${err.message}` })
    },
  })

  const recordRevertMutation = trpc.tasks.recordRevert.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
    },
    onError: (err) => {
      console.error('Failed to record revert:', err.message)
    },
  })

  // Load content when task changes
  useEffect(() => {
    if (!selectedPath || !workingDir) return
    if (lastLoadedPathRef.current === selectedPath) return

    // Fetch content from server
    utils.client.tasks.get.query({ path: selectedPath }).then((task) => {
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
      lastLoadedPathRef.current = selectedPath
    }).catch((err) => {
      console.error('Failed to load task:', err)
      dispatch({ type: 'SET_DRAFT', payload: `# Error\n\nFailed to load task content.` })
      lastLoadedPathRef.current = selectedPath
    })
  }, [selectedPath, workingDir, utils.client.tasks.get])

  // Live-refresh task content while an agent is active (unless the user has local edits).
  useEffect(() => {
    if (!selectedPath || !workingDir) return
    if (!activeSessionId) return
    if (editor.dirty) return

    const interval = globalThis.setInterval(() => {
      utils.client.tasks.get.query({ path: selectedPath }).then((task) => {
        dispatch({ type: 'SET_DRAFT', payload: task.content })
        dispatch({ type: 'SET_DIRTY', payload: false })
      }).catch((err) => {
        console.error('Failed to refresh task:', err)
      })
    }, 2000)

    return () => globalThis.clearInterval(interval)
  }, [selectedPath, workingDir, activeSessionId, editor.dirty, utils.client.tasks.get])

  // One last refresh when an active agent finishes.
  const prevActiveSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedPath || !workingDir) return

    const prev = prevActiveSessionIdRef.current
    const current = activeSessionId ?? null
    prevActiveSessionIdRef.current = current

    if (!prev || current) return
    if (editor.dirty) return

    utils.client.tasks.get.query({ path: selectedPath }).then((task) => {
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
    }).catch((err) => {
      console.error('Failed to refresh task after agent completion:', err)
    })
  }, [selectedPath, workingDir, activeSessionId, editor.dirty, utils.client.tasks.get])

  const selectedSummary = useMemo(() => {
    if (!selectedPath) return null
    return tasks.find((t) => t.path === selectedPath) ?? null
  }, [selectedPath, tasks])

  // Pre-generate commit message when agent completes
  // (Pattern from use-audio-notification.ts - detect status transition)
  const prevAgentStatusRef = useRef<Record<string, string | undefined>>({})
  useEffect(() => {
    if (!selectedPath) return

    const prevStatus = prevAgentStatusRef.current[selectedPath]
    const currentStatus = agentSession?.status
    prevAgentStatusRef.current[selectedPath] = currentStatus

    // Skip if no path, already generating, or message already exists
    if (pendingCommitGenerating || pendingCommitMessage) return

    // Skip initial mount (no previous status)
    if (prevStatus === undefined) return

    // Check for transition to 'completed' from an active state
    const wasActive = prevStatus === 'running' || prevStatus === 'pending'
    const isNowCompleted = currentStatus === 'completed'

    if (wasActive && isNowCompleted) {
      // Start generating commit message in background
      dispatch({
        type: 'SET_PENDING_COMMIT_GENERATING',
        payload: { path: selectedPath, isGenerating: true },
      })

      // Get changed files and generate message
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
    }
  }, [
    selectedPath,
    agentSession?.status,
    pendingCommitGenerating,
    pendingCommitMessage,
    selectedSummary?.title,
    editor.draft,
    utils.client.tasks.getChangedFilesForTask,
    utils.client.git.generateCommitMessage,
  ])

  // Debounced autosave - triggers 500ms after user stops typing
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

  // Orchestrator mutation
  const orchestrateMutation = trpc.tasks.orchestrateDebugRun.useMutation({
    onSuccess: (data) => {
      // Open the orchestrator modal with the session
      dispatch({
        type: 'SET_ORCHESTRATOR',
        payload: {
          debugRunId: orchestrator.debugRunId!,
          sessionId: data.sessionId,
        },
      })
    },
    onError: (err) => {
      console.error('Failed to start orchestrator:', err)
    },
  })

  // Query debug run status when we have a tracked debugRunId
  const { data: debugRunStatus } = trpc.tasks.getDebugRunStatus.useQuery(
    { debugRunId: orchestrator.debugRunId ?? '' },
    {
      enabled: !!orchestrator.debugRunId && orchestrator.triggered && !orchestrator.sessionId,
      refetchInterval: 2000, // Poll every 2s while waiting for completion
    }
  )

  // Trigger orchestrator when all debug sessions complete
  const orchestratorTriggeredRef = useRef<string | null>(null)
  useEffect(() => {
    // Skip if no debug run being tracked
    if (!orchestrator.debugRunId || !orchestrator.triggered) return

    // Skip if orchestrator already started for this run
    if (orchestrator.sessionId) return
    if (orchestratorTriggeredRef.current === orchestrator.debugRunId) return

    // Skip if debug run status not yet loaded
    if (!debugRunStatus) return

    // Check if all sessions are terminal
    if (!debugRunStatus.allTerminal) return

    // All sessions complete - trigger orchestrator
    orchestratorTriggeredRef.current = orchestrator.debugRunId

    // Find the task path from sessions (they all share the same taskPath)
    const sessionWithPath = taskSessions?.all.find((s) => s.sessionId && debugRunStatus.sessions.some(ds => ds.sessionId === s.sessionId))
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

  // Handler to close orchestrator modal
  const handleCloseOrchestratorModal = useCallback(() => {
    dispatch({ type: 'RESET_ORCHESTRATOR' })
  }, [])

  const openCreate = useCallback(() => {
    dispatch({ type: 'OPEN_CREATE_MODAL' })
  }, [])

  // Sync create modal state with props
  useEffect(() => {
    if (initialCreateOpen && !create.open) {
      openCreate()
    }
  }, [initialCreateOpen, create.open, openCreate])

  const handleCloseCreate = useCallback(() => {
    dispatch({ type: 'CLOSE_CREATE_MODAL' })
    // Navigate away from /tasks/new if we're there
    if (selectedPath) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(selectedPath) },
        search: buildSearchParams(),
      })
    } else {
      navigate({ to: '/tasks', search: buildSearchParams() })
    }
  }, [navigate, selectedPath, buildSearchParams])

  const handleCreate = async () => {
    const title = create.title.trim()
    if (!title) return

    try {
      if (create.useAgent) {
        if (create.taskType === 'bug') {
          // Multi-agent debug for bug tasks
          const selectedAgents = create.debugAgents
            .filter((da) => da.selected)
            .map((da) => ({ agentType: da.agentType, model: da.model || undefined }))

          if (selectedAgents.length > 0) {
            await debugWithAgentsMutation.mutateAsync({
              title,
              agents: selectedAgents,
            })
          }
        } else {
          // Single agent planning for feature tasks
          await createWithAgentMutation.mutateAsync({
            title,
            taskType: create.taskType,
            agentType: create.agentType,
            model: create.model || undefined,
          })
        }
      } else {
        await createMutation.mutateAsync({ title })
      }
      dispatch({ type: 'RESET_CREATE_MODAL' })
      clearCreateTitleDraft() // Clear persisted draft after successful creation
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

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
  }, [selectedPath, deleteMutation])

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
  }, [selectedPath, archiveMutation])

  const handleRestore = useCallback(async () => {
    if (!selectedPath) return
    try {
      await restoreMutation.mutateAsync({ path: selectedPath })
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }, [selectedPath, restoreMutation])

  const handleAssignToAgent = useCallback(() => {
    if (!selectedPath) return
    dispatch({ type: 'SET_IMPLEMENT_MODAL_OPEN', payload: true })
  }, [selectedPath])

  const handleCloseImplementModal = useCallback(() => {
    dispatch({ type: 'SET_IMPLEMENT_MODAL_OPEN', payload: false })
  }, [])

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
      throw err // Re-throw so modal can handle it
    }
  }, [selectedPath, editor.dirty, editor.draft, saveMutation, assignToAgentMutation])

  const handleCancelAgent = useCallback((sessionId: string) => {
    console.log('[handleCancelAgent] Cancelling session:', sessionId)
    cancelAgentMutation.mutate({ id: sessionId })
  }, [cancelAgentMutation])

  const handleReview = useCallback(() => {
    // Navigate to debate mode instead of opening modal
    if (!selectedPath) return
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/debate` },
      search: buildSearchParams(),
    })
  }, [selectedPath, navigate, buildSearchParams])

  const handleVerify = useCallback(() => {
    dispatch({ type: 'SET_VERIFY_MODAL_OPEN', payload: true })
  }, [])

  const handleCloseDebatePanel = useCallback(() => {
    // Navigate back to edit mode from debate mode
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

      // Agent progress banner will automatically show verify status
      // User stays on task page to maintain context
    } catch (err) {
      console.error('Failed to start verify:', err)
      dispatch({ type: 'SET_SAVE_ERROR', payload: err instanceof Error ? err.message : 'Failed to start verify' })
      throw err // Re-throw so modal can handle it
    }
  }, [selectedPath, verifyWithAgentMutation])

  const handleCloseVerifyModal = useCallback(() => {
    dispatch({ type: 'SET_VERIFY_MODAL_OPEN', payload: false })
  }, [])

  const handleOpenSplitModal = useCallback(() => {
    dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: true })
  }, [])

  const handleOpenCommitArchiveModal = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: true })
  }, [])

  const handleCloseCommitArchiveModal = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: false })
    if (selectedPath) {
      dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
    }
  }, [selectedPath])

  const handleCommitSuccess = useCallback(() => {
    // Close modal immediately after commit (archive runs in bg)
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: false })
    if (selectedPath) {
      dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
    }
  }, [selectedPath])

  const handleArchiveSuccess = useCallback(() => {
    // Navigate to topmost non-archived task (archive completed in background)
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

  const handleMergeSuccess = useCallback(() => {
    // Invalidate caches after merge
    utils.tasks.get.invalidate()
    utils.tasks.getLatestActiveMerge.invalidate()
  }, [utils])

  // === QA Workflow Handlers ===

  // Derive worktree branch from active session
  const activeWorktreeBranch = activeSessionId ? `agentz/session-${activeSessionId}` : undefined

  const handleMergeToMain = useCallback(async () => {
    if (!selectedPath || !activeSessionId || !activeWorktreeBranch) return

    dispatch({ type: 'SET_SAVE_ERROR', payload: null })
    try {
      const mergeResult = await mergeBranchMutation.mutateAsync({
        targetBranch: 'main',
        sourceBranch: activeWorktreeBranch,
      })

      if (mergeResult.success && mergeResult.mergeCommitHash) {
        // Record the merge in task metadata (sets QA to pending)
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
  }, [selectedPath, activeSessionId, activeWorktreeBranch, mergeBranchMutation, recordMergeMutation])

  const handleSetQAPass = useCallback(async () => {
    if (!selectedPath) return

    try {
      await setQAStatusMutation.mutateAsync({
        path: selectedPath,
        status: 'pass',
      })
      // After QA passes, user can archive manually if they want
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
        // Record the revert in task metadata
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
  }, [selectedPath, latestActiveMerge, revertMergeMutation, recordRevertMutation])

  const handleCloseSplitModal = useCallback(() => {
    dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: false })
  }, [])

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

  const handleNavigateToSplitFrom = useCallback(() => {
    if (!taskData?.splitFrom) return

    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(taskData.splitFrom) },
      search: { archiveFilter: 'all', sortBy, sortDir },
    })
  }, [taskData?.splitFrom, navigate, sortBy, sortDir])

  const handleDebateAccept = useCallback(async () => {
    // Refresh the task content after accepting the refined spec
    if (!selectedPath || !workingDir) return

    // Invalidate list cache for sidebar updates
    utils.tasks.list.invalidate()

    // Fetch and display updated content (following pattern from agent completion refresh)
    try {
      const task = await utils.client.tasks.get.query({ path: selectedPath })
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
    } catch (err) {
      console.error('Failed to refresh task after debate accept:', err)
    }
  }, [selectedPath, workingDir, utils])

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
      dispatch({ type: 'RESET_REWRITE' }) // Clear comment after submitting
      clearRewriteDraft() // Clear persisted draft
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rewrite plan'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Failed to rewrite plan:', err)
    }
  }, [selectedPath, rewrite.comment, rewrite.agentType, rewrite.model, rewriteWithAgentMutation, clearRewriteDraft])

  const editorTitle = selectedSummary?.title ?? (selectedPath ? selectedPath : 'Tasks')

  // Show message if no working directory set
  if (!workingDir) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 px-3 border-b border-border flex items-center justify-between">
          <h1 className="font-vcr text-sm text-accent">Tasks</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-2">No project selected</p>
            <p className="text-muted-foreground text-xs">
              Select a project directory using the folder selector in the sidebar.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Editor */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-background overflow-hidden">
          {!selectedPath ? (
            /* Inline create form centered in content area */
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-panel border border-border rounded shadow-lg">
                <div className="p-3 border-b border-border">
                  <div className="font-vcr text-sm text-accent">New Task</div>
                </div>
                <div className="p-4">
                  <CreateTaskForm
                    isCreating={createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending}
                    newTitle={create.title}
                    taskType={create.taskType}
                    useAgent={create.useAgent}
                    createAgentType={create.agentType}
                    createModel={create.model}
                    availableTypes={availableTypes}
                    availablePlannerTypes={availablePlannerTypes}
                    debugAgents={create.debugAgents}
                    onCreate={handleCreate}
                    onTitleChange={(title) => setCreateTitleDraft(title)}
                    onTaskTypeChange={(taskType) => dispatch({ type: 'SET_CREATE_TASK_TYPE', payload: taskType })}
                    onUseAgentChange={(useAgent) => dispatch({ type: 'SET_CREATE_USE_AGENT', payload: useAgent })}
                    onAgentTypeChange={handleCreateAgentTypeChange}
                    onModelChange={(model) => dispatch({ type: 'SET_CREATE_MODEL', payload: model })}
                    onToggleDebugAgent={(agentType) => dispatch({ type: 'TOGGLE_DEBUG_AGENT', payload: agentType })}
                    onDebugAgentModelChange={(agentType, model) => dispatch({ type: 'SET_DEBUG_AGENT_MODEL', payload: { agentType, model } })}
                    autoFocus={true}
                  />
                </div>
                <div className="p-3 border-t border-border">
                  <CreateTaskActions
                    isCreating={createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending}
                    canCreate={
                      create.title.trim().length > 0 &&
                      (!create.useAgent || availablePlannerTypes.length > 0) &&
                      (!create.useAgent || create.taskType !== 'bug' || create.debugAgents.some((da) => da.selected))
                    }
                    onCreate={handleCreate}
                  />
                </div>
              </div>
            </div>
          ) : mode === 'debate' ? (
            // Debate mode - show inline debate panel
            <DebatePanel
              taskPath={selectedPath}
              taskTitle={editorTitle}
              availableTypes={availableTypes}
              existingDebate={activeDebate}
              onBack={handleCloseDebatePanel}
              onClose={handleCloseDebatePanel}
              onAccept={handleDebateAccept}
            />
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <TaskEditor
                  title={editorTitle}
                  path={selectedPath}
                  mode={mode}
                  draft={editor.draft}
                  taskDescription={editor.draft}
                  createdAt={taskData?.createdAt ?? selectedSummary?.createdAt}
                  updatedAt={taskData?.updatedAt ?? selectedSummary?.updatedAt}
                  subtasks={taskData?.subtasks ?? []}
                  taskVersion={taskData?.version ?? 1}
                  onSubtasksChange={() => utils.tasks.get.invalidate({ path: selectedPath })}
                  isArchived={selectedSummary?.archived ?? false}
                  isArchiving={archiveMutation.isPending}
                  isRestoring={restoreMutation.isPending}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onCommitAndArchive={handleOpenCommitArchiveModal}
                  activePlanningOutput={isActivePlanningSession ? agentSession?.output : undefined}
                  isPlanningActive={isActivePlanningSession}
                  reviewFile={reviewFile}
                  onReviewFileChange={handleReviewFileChange}
                  onModeChange={handleModeChange}
                  onDraftChange={(newDraft) => {
                    dispatch({ type: 'SET_DRAFT', payload: newDraft })
                    dispatch({ type: 'SET_DIRTY', payload: true })
                    // Trigger autosave after 500ms of inactivity
                    if (selectedPath) {
                      debouncedSave(selectedPath, newDraft)
                    }
                  }}
                />
              </div>

              {/* Footer with rewrite controls - only show in edit mode */}
              {mode === 'edit' && (
                <TaskFooter
                  rewriteComment={rewrite.comment}
                  rewriteAgentType={rewrite.agentType}
                  rewriteModel={rewrite.model}
                  isRewriting={rewriteWithAgentMutation.isPending}
                  availableTypes={availableTypes}
                  agentSession={agentSession}
                  canSplit={sectionsData?.canSplit}
                  onSplit={handleOpenSplitModal}
                  onRewriteCommentChange={(comment) => {
                    setRewriteDraft(comment)
                    dispatch({ type: 'SET_REWRITE_COMMENT', payload: comment })
                  }}
                  onRewriteAgentTypeChange={handleRewriteAgentTypeChange}
                  onRewriteModelChange={(model) => dispatch({ type: 'SET_REWRITE_MODEL', payload: model })}
                  onRewritePlan={handleRewritePlan}
                />
              )}
            </>
          )}
        </div>

        {/* Right: Task Controls Panel - hidden in review/debate mode */}
        {selectedPath && mode === 'edit' && (
          <div className="w-80 shrink-0 border-l border-border overflow-hidden">
            <TaskSidebar
              mode={mode}
              isSaving={save.saving}
              isDeleting={deleteMutation.isPending}
              isAssigning={assignToAgentMutation.isPending}
              saveError={save.error}
              agentSession={agentSession}
              taskSessions={taskSessions}
              splitFrom={taskData?.splitFrom}
              onNavigateToSplitFrom={handleNavigateToSplitFrom}
              hasActiveDebate={!!activeDebate}
              // QA workflow props
              qaStatus={taskData?.qaStatus}
              latestActiveMerge={latestActiveMerge}
              worktreeBranch={activeWorktreeBranch}
              isMerging={mergeBranchMutation.isPending}
              isReverting={revertMergeMutation.isPending}
              isSettingQA={setQAStatusMutation.isPending}
              onMergeToMain={handleMergeToMain}
              onSetQAPass={handleSetQAPass}
              onSetQAFail={handleSetQAFail}
              onRevertMerge={handleRevertMerge}
              // Action handlers
              onDelete={handleDelete}
              onReview={handleReview}
              onVerify={handleVerify}
              onAssignToAgent={handleAssignToAgent}
              onCancelAgent={handleCancelAgent}
            />
          </div>
        )}
      </div>

      {/* Only render modal when a task is selected - otherwise the inline form is shown */}
      {selectedPath && (
        <CreateTaskModal
          isOpen={create.open}
          isCreating={createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending}
          newTitle={create.title}
          taskType={create.taskType}
          useAgent={create.useAgent}
          createAgentType={create.agentType}
          createModel={create.model}
          availableTypes={availableTypes}
          availablePlannerTypes={availablePlannerTypes}
          debugAgents={create.debugAgents}
          onClose={handleCloseCreate}
          onCreate={handleCreate}
          onTitleChange={(title) => setCreateTitleDraft(title)}
          onTaskTypeChange={(taskType) => dispatch({ type: 'SET_CREATE_TASK_TYPE', payload: taskType })}
          onUseAgentChange={(useAgent) => dispatch({ type: 'SET_CREATE_USE_AGENT', payload: useAgent })}
          onAgentTypeChange={handleCreateAgentTypeChange}
          onModelChange={(model) => dispatch({ type: 'SET_CREATE_MODEL', payload: model })}
          onToggleDebugAgent={(agentType) => dispatch({ type: 'TOGGLE_DEBUG_AGENT', payload: agentType })}
          onDebugAgentModelChange={(agentType, model) => dispatch({ type: 'SET_DEBUG_AGENT_MODEL', payload: { agentType, model } })}
        />
      )}

      {/* Verify uses ReviewModal (single agent) - defaults to codex */}
      <ReviewModal
        isOpen={modals.verifyOpen}
        mode="verify"
        taskTitle={editorTitle}
        agentType={verify.agentType}
        model={verify.model}
        availableTypes={availableTypes}
        onClose={handleCloseVerifyModal}
        onStart={handleStartVerify}
      />

      {/* Implement Modal - agent/model selection before implementation */}
      <ImplementModal
        isOpen={modals.implementOpen}
        taskTitle={editorTitle}
        agentType={run.agentType}
        model={run.model}
        availableTypes={availableTypes}
        onClose={handleCloseImplementModal}
        onStart={handleStartImplement}
      />

      {/* Split Task Modal */}
      <SplitTaskModal
        isOpen={modals.splitOpen}
        isSplitting={splitTaskMutation.isPending}
        taskTitle={editorTitle}
        sections={sectionsData?.sections ?? []}
        currentSubtaskCount={taskData?.subtaskCount ?? 0}
        maxSubtasks={20}
        onClose={handleCloseSplitModal}
        onSplit={handleSplitTask}
      />

      {/* Commit and Archive Modal */}
      {selectedPath && (
        <CommitArchiveModal
          isOpen={modals.commitArchiveOpen}
          taskPath={selectedPath}
          taskTitle={editorTitle}
          taskContent={editor.draft}
          initialMessage={pendingCommitMessage}
          isGeneratingInitial={pendingCommitGenerating}
          sessionId={activeSessionId}
          worktreeBranch={activeWorktreeBranch}
          onClose={handleCloseCommitArchiveModal}
          onCommitSuccess={handleCommitSuccess}
          onArchiveSuccess={handleArchiveSuccess}
          onMergeSuccess={handleMergeSuccess}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'CLOSE_CONFIRM_DIALOG' })
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />

      {/* Orchestrator Modal - Shows live codex synthesis of debug outputs */}
      <OrchestratorModal
        isOpen={modals.orchestratorOpen}
        sessionId={orchestrator.sessionId}
        taskPath={selectedPath}
        onClose={handleCloseOrchestratorModal}
      />

    </div>
  )
}
