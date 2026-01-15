/**
 * Tasks Page - Shared component for tasks routes
 *
 * This is the actual tasks UI, used by:
 * - /tasks (no task selected)
 * - /tasks/$ (task selected via splat param)
 * - /tasks/new (create modal open)
 */

import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedCallback } from '@/lib/utils/debounce'
import type { AgentType } from '@/lib/agent/types'
import { TaskEditor } from '@/components/tasks/task-editor'
import { TaskFooter } from '@/components/tasks/task-footer'
import { TaskSidebar } from '@/components/tasks/task-sidebar'
import { CreateTaskModal, type TaskType } from '@/components/tasks/create-task-modal'
import { ReviewModal } from '@/components/tasks/review-modal'
import { SplitTaskModal } from '@/components/tasks/split-task-modal'
import { CommitArchiveModal } from '@/components/tasks/commit-archive-modal'
import { DebatePanel } from '@/components/debate'
import { getDefaultModelId, type PlannerAgentType } from '@/lib/agent/config'
import type { AgentSession } from '@/components/tasks/agent-types'
import { trpc } from '@/lib/trpc-client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { encodeTaskPath } from '@/lib/utils/task-routing'

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
}

export function TasksPage({
  selectedPath,
  mode = 'edit',
  createModalOpen: initialCreateOpen,
  archiveFilter,
  sortBy,
  sortDir,
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
    const candidates: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  // Local state
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const lastLoadedPathRef = useRef<string | null>(null)

  const [createOpen, setCreateOpen] = useState(initialCreateOpen)
  const [newTitle, setNewTitle] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('feature')
  const [useAgent, setUseAgent] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Agent type for "Create task with agent" (planning only)
  const [createAgentType, setCreateAgentType] = useState<PlannerAgentType>('claude')
  const [createModel, setCreateModel] = useState(() => getDefaultModelId('claude'))

  // Agent type for "Run with Agent"
  const [runAgentType, setRunAgentType] = useState<AgentType>('claude')
  const [runModel, setRunModel] = useState(() => getDefaultModelId('claude'))

  // Verify modal state (Verify uses ReviewModal, Review uses inline DebatePanel)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)

  // Split modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false)

  // Commit and archive modal state
  const [commitArchiveOpen, setCommitArchiveOpen] = useState(false)

  // Rewrite state
  const [rewriteComment, setRewriteComment] = useState('')
  const [rewriteAgentType, setRewriteAgentType] = useState<AgentType>('claude')
  const [rewriteModel, setRewriteModel] = useState(() => getDefaultModelId('claude'))

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    confirmText?: string
    variant?: 'default' | 'danger'
    onConfirm: () => void
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // Track active agent session for progress display (from polling)
  const activeSessionInfo = selectedPath ? activeAgentSessions[selectedPath] : undefined
  const activeSessionId = activeSessionInfo?.sessionId

  // Store sessionId in ref so cancel handler always has access, even if query state changes
  const activeSessionIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (activeSessionId) {
      activeSessionIdRef.current = activeSessionId
    }
  }, [activeSessionId])

  const { data: liveSession } = trpc.agent.get.useQuery(
    { id: activeSessionId ?? '' },
    {
      enabled: !!activeSessionId,
      refetchInterval: 1000,
    }
  )

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

  // Keep create-with-agent settings valid as available types change.
  useEffect(() => {
    if (availablePlannerTypes.length === 0) return
    if (!availablePlannerTypes.includes(createAgentType)) {
      const newType = availablePlannerTypes[0]
      setCreateAgentType(newType)
      setCreateModel(getDefaultModelId(newType))
    }
  }, [availablePlannerTypes, createAgentType])

  // Keep run-with-agent setting valid as available types change.
  useEffect(() => {
    if (availableTypes.length === 0) return
    if (availableTypes.includes(runAgentType)) return

    const preferred: AgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'gemini']
    const next = preferred.find((t) => availableTypes.includes(t)) ?? availableTypes[0]
    setRunAgentType(next)
    setRunModel(getDefaultModelId(next))
  }, [availableTypes, runAgentType])

  // Handler for create agent type change
  const handleCreateAgentTypeChange = useCallback((newType: PlannerAgentType) => {
    setCreateAgentType(newType)
    setCreateModel(getDefaultModelId(newType))
  }, [])

  // Handler for run agent type change
  const handleRunAgentTypeChange = useCallback((newType: AgentType) => {
    setRunAgentType(newType)
    setRunModel(getDefaultModelId(newType))
  }, [])

  // Handler for rewrite agent type change
  const handleRewriteAgentTypeChange = useCallback((newType: AgentType) => {
    setRewriteAgentType(newType)
    setRewriteModel(getDefaultModelId(newType))
  }, [])

  // Build search params for navigation (preserves filter/sort)
  const buildSearchParams = useCallback(() => {
    return { archiveFilter, sortBy, sortDir }
  }, [archiveFilter, sortBy, sortDir])

  // Navigate to change mode (edit/review) via URL
  const handleModeChange = useCallback((newMode: Mode) => {
    if (!selectedPath) return
    navigate({
      to: '/tasks/$',
      params: { _splat: `${encodeTaskPath(selectedPath)}/${newMode}` },
      search: buildSearchParams(),
    })
  }, [selectedPath, navigate, buildSearchParams])

  // Mutations
  const saveMutation = trpc.tasks.save.useMutation({
    onMutate: async ({ path, content }) => {
      // 1. Cancel outgoing refetches
      await utils.tasks.get.cancel({ path })

      // 2. Snapshot current state for rollback
      const previousTask = utils.tasks.get.getData({ path })
      const previousDirty = dirty

      // 3. Optimistically mark as clean (content already in draft)
      setDirty(false)
      setSaveError(null)

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
        setDirty(context.previousDirty)
      }
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
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
      if (previousList) {
        utils.tasks.list.setData(undefined, [
          {
            path: tempPath,
            title,
            archived: false,
            updatedAt: new Date().toISOString(),
            source: 'tasks-dir' as const,
            progress: { total: 0, done: 0, inProgress: 0 },
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
      if (previousList) {
        utils.tasks.list.setData(undefined, [
          {
            path: tempPath,
            title,
            archived: false,
            updatedAt: new Date().toISOString(),
            source: 'tasks-dir' as const,
            progress: { total: 0, done: 0, inProgress: 0 },
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

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate()
      // Navigate to tasks list (no selection)
      navigate({ to: '/tasks', search: buildSearchParams() })
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

      // Snapshot for rollback
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      // Optimistically add placeholder session with 'pending' status
      if (previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, {
          ...previousSessions,
          [path]: {
            sessionId: `pending-${Date.now()}`,
            status: 'pending',
          },
        })
      }

      return { previousSessions, path }
    },
    onSuccess: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      }
    },
  })

  const cancelAgentMutation = trpc.agent.cancel.useMutation({
    onSuccess: (data) => {
      console.log('[cancelAgentMutation] Success:', data)
      utils.tasks.getActiveAgentSessions.invalidate()
      if (selectedPath) {
        utils.tasks.get.invalidate({ path: selectedPath })
      }
      utils.tasks.list.invalidate()
    },
    onError: (error) => {
      console.error('[cancelAgentMutation] Error:', error)
    },
  })

  const verifyWithAgentMutation = trpc.tasks.verifyWithAgent.useMutation({
    onSuccess: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  const rewriteWithAgentMutation = trpc.tasks.rewriteWithAgent.useMutation({
    onSuccess: (data) => {
      utils.tasks.getActiveAgentSessions.invalidate()
      // Navigate to agent session to watch rewriting in real-time
      navigate({
        to: '/agents/$sessionId',
        params: { sessionId: data.sessionId },
        search: { taskPath: data.path },
      })
    },
  })

  const splitTaskMutation = trpc.tasks.splitTask.useMutation({
    onSuccess: (data) => {
      // Invalidate task list cache
      utils.tasks.list.invalidate()

      // Close the modal
      setSplitModalOpen(false)

      // Navigate to first new task using route segment
      if (data.newPaths.length > 0) {
        navigate({
          to: '/tasks/$',
          params: { _splat: encodeTaskPath(data.newPaths[0]) },
          search: buildSearchParams(),
        })
      }
    },
  })

  // Load content when task changes
  useEffect(() => {
    if (!selectedPath || !workingDir) return
    if (lastLoadedPathRef.current === selectedPath) return

    // Fetch content from server
    utils.client.tasks.get.query({ path: selectedPath }).then((task) => {
      setDraft(task.content)
      setDirty(false)
      lastLoadedPathRef.current = selectedPath
    }).catch((err) => {
      console.error('Failed to load task:', err)
      setDraft(`# Error\n\nFailed to load task content.`)
      lastLoadedPathRef.current = selectedPath
    })
  }, [selectedPath, workingDir, utils.client.tasks.get])

  // Live-refresh task content while an agent is active (unless the user has local edits).
  useEffect(() => {
    if (!selectedPath || !workingDir) return
    if (!activeSessionId) return
    if (dirty) return

    const interval = globalThis.setInterval(() => {
      utils.client.tasks.get.query({ path: selectedPath }).then((task) => {
        setDraft(task.content)
        setDirty(false)
      }).catch((err) => {
        console.error('Failed to refresh task:', err)
      })
    }, 2000)

    return () => globalThis.clearInterval(interval)
  }, [selectedPath, workingDir, activeSessionId, dirty, utils.client.tasks.get])

  // One last refresh when an active agent finishes.
  const prevActiveSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedPath || !workingDir) return

    const prev = prevActiveSessionIdRef.current
    const current = activeSessionId ?? null
    prevActiveSessionIdRef.current = current

    if (!prev || current) return
    if (dirty) return

    utils.client.tasks.get.query({ path: selectedPath }).then((task) => {
      setDraft(task.content)
      setDirty(false)
    }).catch((err) => {
      console.error('Failed to refresh task after agent completion:', err)
    })
  }, [selectedPath, workingDir, activeSessionId, dirty, utils.client.tasks.get])

  const selectedSummary = useMemo(() => {
    if (!selectedPath) return null
    return tasks.find((t) => t.path === selectedPath) ?? null
  }, [selectedPath, tasks])

  // Debounced autosave - triggers 500ms after user stops typing
  const debouncedSave = useDebouncedCallback(
    async (path: string, content: string) => {
      setIsSaving(true)
      try {
        await saveMutation.mutateAsync({ path, content })
      } catch {
        // Error handled in onError callback
      } finally {
        setIsSaving(false)
      }
    },
    500
  )

  const openCreate = useCallback(() => {
    setNewTitle('')
    setCreateOpen(true)
  }, [])

  // Sync create modal state with props
  useEffect(() => {
    if (initialCreateOpen && !createOpen) {
      openCreate()
    }
  }, [initialCreateOpen, createOpen, openCreate])

  const handleCloseCreate = useCallback(() => {
    setCreateOpen(false)
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
    const title = newTitle.trim()
    if (!title) return

    try {
      if (useAgent) {
        await createWithAgentMutation.mutateAsync({
          title,
          taskType,
          agentType: createAgentType,
          model: createModel || undefined,
        })
      } else {
        await createMutation.mutateAsync({ title })
      }
      setCreateOpen(false)
      setNewTitle('')
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!selectedPath) return

    setConfirmDialog({
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
    })
  }, [selectedPath, deleteMutation])

  const handleArchive = useCallback(async () => {
    if (!selectedPath) return

    setConfirmDialog({
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

  const handleAssignToAgent = useCallback(async () => {
    if (!selectedPath) return

    const assignToAgent = async () => {
      // Save first if dirty
      if (dirty) {
        await saveMutation.mutateAsync({ path: selectedPath, content: draft })
        setDirty(false)
      }

      try {
        setSaveError(null)
        await assignToAgentMutation.mutateAsync({
          path: selectedPath,
          agentType: runAgentType,
          model: runModel || undefined,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to assign to agent'
        setSaveError(msg)
        console.error('Failed to assign to agent:', err)
      }
    }

    if (dirty) {
      setConfirmDialog({
        open: true,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Save before assigning to agent?',
        confirmText: 'Save & Assign',
        variant: 'default',
        onConfirm: assignToAgent,
      })
      return
    }

    await assignToAgent()
  }, [selectedPath, dirty, draft, runAgentType, runModel, saveMutation, assignToAgentMutation])

  const handleCancelAgent = useCallback(() => {
    // Use ref to get sessionId - more stable than state which can become undefined during transitions
    const sessionIdToCancel = activeSessionIdRef.current
    console.log('[handleCancelAgent] Called with:', {
      selectedPath,
      activeSessionId,
      sessionIdToCancel,
      activeSessionInfo,
      activeAgentSessions,
    })
    if (!sessionIdToCancel) {
      console.warn('[handleCancelAgent] No sessionId in ref, cannot cancel')
      return
    }
    console.log('[handleCancelAgent] Calling cancelMutation with id:', sessionIdToCancel)
    cancelAgentMutation.mutate({ id: sessionIdToCancel })
  }, [cancelAgentMutation, selectedPath, activeSessionId, activeSessionInfo, activeAgentSessions])

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
    setVerifyModalOpen(true)
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
      setSaveError(null)
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
      setSaveError(err instanceof Error ? err.message : 'Failed to start verify')
      throw err // Re-throw so modal can handle it
    }
  }, [selectedPath, verifyWithAgentMutation])

  const handleCloseVerifyModal = useCallback(() => {
    setVerifyModalOpen(false)
  }, [])

  const handleOpenSplitModal = useCallback(() => {
    setSplitModalOpen(true)
  }, [])

  const handleOpenCommitArchiveModal = useCallback(() => {
    setCommitArchiveOpen(true)
  }, [])

  const handleCloseCommitArchiveModal = useCallback(() => {
    setCommitArchiveOpen(false)
  }, [])

  const handleCommitArchiveSuccess = useCallback(() => {
    setCommitArchiveOpen(false)
    // Navigate to topmost non-archived task
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

  const handleCloseSplitModal = useCallback(() => {
    setSplitModalOpen(false)
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
      setDraft(task.content)
      setDirty(false)
    } catch (err) {
      console.error('Failed to refresh task after debate accept:', err)
    }
  }, [selectedPath, workingDir, utils])

  const handleRewritePlan = useCallback(async () => {
    if (!selectedPath || !rewriteComment.trim()) return

    try {
      setSaveError(null)
      await rewriteWithAgentMutation.mutateAsync({
        path: selectedPath,
        agentType: rewriteAgentType, // Use the rewrite-specific agent type
        model: rewriteModel || undefined,
        userComment: rewriteComment,
      })
      setRewriteComment('') // Clear comment after submitting
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to rewrite plan'
      setSaveError(msg)
      console.error('Failed to rewrite plan:', err)
    }
  }, [selectedPath, rewriteComment, rewriteAgentType, rewriteModel, rewriteWithAgentMutation])

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
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a task from the sidebar
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
                  draft={draft}
                  taskDescription={draft}
                  isArchived={selectedSummary?.archived ?? false}
                  isArchiving={archiveMutation.isPending}
                  isRestoring={restoreMutation.isPending}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onCommitAndArchive={handleOpenCommitArchiveModal}
                  onModeChange={handleModeChange}
                  onDraftChange={(newDraft) => {
                    setDraft(newDraft)
                    setDirty(true)
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
                  rewriteComment={rewriteComment}
                  rewriteAgentType={rewriteAgentType}
                  rewriteModel={rewriteModel}
                  isRewriting={rewriteWithAgentMutation.isPending}
                  availableTypes={availableTypes}
                  agentSession={agentSession}
                  onRewriteCommentChange={setRewriteComment}
                  onRewriteAgentTypeChange={handleRewriteAgentTypeChange}
                  onRewriteModelChange={setRewriteModel}
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
              isSaving={isSaving}
              isDeleting={deleteMutation.isPending}
              isAssigning={assignToAgentMutation.isPending}
              saveError={saveError}
              runAgentType={runAgentType}
              runModel={runModel}
              availableTypes={availableTypes}
              agentSession={agentSession}
              taskSessions={taskSessions}
              canSplit={sectionsData?.canSplit}
              splitFrom={taskData?.splitFrom}
              onSplit={handleOpenSplitModal}
              onNavigateToSplitFrom={handleNavigateToSplitFrom}
              hasActiveDebate={!!activeDebate}
              onDelete={handleDelete}
              onReview={handleReview}
              onVerify={handleVerify}
              onAssignToAgent={handleAssignToAgent}
              onRunAgentTypeChange={handleRunAgentTypeChange}
              onRunModelChange={setRunModel}
              onCancelAgent={handleCancelAgent}
            />
          </div>
        )}
      </div>

      <CreateTaskModal
        isOpen={createOpen}
        isCreating={createMutation.isPending || createWithAgentMutation.isPending}
        newTitle={newTitle}
        taskType={taskType}
        useAgent={useAgent}
        createAgentType={createAgentType}
        createModel={createModel}
        availableTypes={availableTypes}
        availablePlannerTypes={availablePlannerTypes}
        onClose={handleCloseCreate}
        onCreate={handleCreate}
        onTitleChange={setNewTitle}
        onTaskTypeChange={setTaskType}
        onUseAgentChange={setUseAgent}
        onAgentTypeChange={handleCreateAgentTypeChange}
        onModelChange={setCreateModel}
      />

      {/* Verify uses ReviewModal (single agent) */}
      <ReviewModal
        isOpen={verifyModalOpen}
        mode="verify"
        taskTitle={editorTitle}
        agentType={runAgentType}
        model={runModel}
        availableTypes={availableTypes}
        onClose={handleCloseVerifyModal}
        onStart={handleStartVerify}
      />

      {/* Split Task Modal */}
      <SplitTaskModal
        isOpen={splitModalOpen}
        isSplitting={splitTaskMutation.isPending}
        taskTitle={editorTitle}
        sections={sectionsData?.sections ?? []}
        onClose={handleCloseSplitModal}
        onSplit={handleSplitTask}
      />

      {/* Commit and Archive Modal */}
      {selectedPath && (
        <CommitArchiveModal
          isOpen={commitArchiveOpen}
          taskPath={selectedPath}
          taskTitle={editorTitle}
          taskContent={draft}
          onClose={handleCloseCommitArchiveModal}
          onSuccess={handleCommitArchiveSuccess}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />

    </div>
  )
}
