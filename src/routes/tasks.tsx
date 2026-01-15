/**
 * Tasks Page - Markdown-backed task plans
 * Uses tRPC for all task operations (file-system backed)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { AgentType } from '@/lib/agent/types'
import { TaskEditor } from '@/components/tasks/task-editor'
import { TaskFooter } from '@/components/tasks/task-footer'
import { TaskSidebar } from '@/components/tasks/task-sidebar'
import { CreateTaskModal, type TaskType } from '@/components/tasks/create-task-modal'
import { ReviewModal } from '@/components/tasks/review-modal'
import type { PlannerAgentType } from '@/components/tasks/agent-config'
import { getDefaultModelId } from '@/lib/agent/config'
import type { AgentSession } from '@/components/tasks/agent-types'
import { trpc } from '@/lib/trpc-client'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export const Route = createFileRoute('/tasks')({
  validateSearch: z
    .object({
      path: z.string().optional(),
      create: z.string().optional(),
      archiveFilter: z.enum(['all', 'active', 'archived']).optional().default('active'),
    })
    .parse,
  component: TasksPage,
})

type Mode = 'edit' | 'preview' | 'review'

function TasksPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const selectedPath = search.path ?? null
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

  const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
    const candidates: PlannerAgentType[] = ['cerebras', 'opencode', 'claude', 'codex']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  // Local state
  const [mode, setMode] = useState<Mode>('edit')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const lastLoadedPathRef = useRef<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('feature')
  const [useAgent, setUseAgent] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Agent type for "Create task with agent" (planning only)
  const [createAgentType, setCreateAgentType] = useState<PlannerAgentType>('cerebras')
  const [createModel, setCreateModel] = useState(() => getDefaultModelId('cerebras'))

  // Agent type for "Run with Agent"
  const [runAgentType, setRunAgentType] = useState<AgentType>('claude')
  const [runModel, setRunModel] = useState(() => getDefaultModelId('claude'))

  // Review/Verify modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewMode, setReviewMode] = useState<'review' | 'verify'>('review')

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

  // Mutations
  const saveMutation = trpc.tasks.save.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate()
      utils.tasks.get.invalidate({ path: selectedPath ?? '' })
    },
  })

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      navigate({
        to: '/tasks',
        search: { path: data.path, archiveFilter: 'active' },
      })
    },
  })

  const createWithAgentMutation = trpc.tasks.createWithAgent.useMutation({
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      // Navigate to agent session to watch planning in real-time
      navigate({
        to: '/agents/$sessionId',
        params: { sessionId: data.sessionId },
        search: { taskPath: data.path },
      })
    },
  })

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate()
      navigate({ to: '/tasks', search: { archiveFilter: 'active' } })
    },
  })

  const archiveMutation = trpc.tasks.archive.useMutation({
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      navigate({ to: '/tasks', search: { path: data.path, archiveFilter: 'active' } })
    },
  })

  const restoreMutation = trpc.tasks.restore.useMutation({
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      navigate({ to: '/tasks', search: { path: data.path, archiveFilter: 'active' } })
    },
  })

  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation({
    onSuccess: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
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

  const reviewWithAgentMutation = trpc.tasks.reviewWithAgent.useMutation({
    onSuccess: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
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

  const handleSave = useCallback(async () => {
    if (!selectedPath) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await saveMutation.mutateAsync({ path: selectedPath, content: draft })
      setDirty(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [selectedPath, draft, saveMutation])

  // Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'
      if (!isSave) return
      e.preventDefault()
      handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const openCreate = useCallback(() => {
    setNewTitle('')
    setCreateOpen(true)
  }, [])

  useEffect(() => {
    if (search.create !== '1') return
    if (!workingDir) return

    openCreate()
    navigate({
      to: '/tasks',
      search: { path: search.path, archiveFilter: search.archiveFilter ?? 'active' },
      replace: true,
    })
  }, [search.create, search.path, search.archiveFilter, workingDir, openCreate, navigate])

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
    setReviewMode('review')
    setReviewModalOpen(true)
  }, [])

  const handleVerify = useCallback(() => {
    setReviewMode('verify')
    setReviewModalOpen(true)
  }, [])

  const handleStartReview = useCallback(async (agentType: AgentType, model: string | undefined, instructions?: string) => {
    if (!selectedPath) return

    try {
      setSaveError(null)
      await (reviewMode === 'review'
        ? reviewWithAgentMutation.mutateAsync({
            path: selectedPath,
            agentType,
            model,
            instructions,
          })
        : verifyWithAgentMutation.mutateAsync({
            path: selectedPath,
            agentType,
            model,
            instructions,
          }))

      // Agent progress banner will automatically show review/verify status
      // User stays on task page to maintain context
    } catch (err) {
      console.error('Failed to start review:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to start review')
      throw err // Re-throw so modal can handle it
    }
  }, [selectedPath, reviewMode, reviewWithAgentMutation, verifyWithAgentMutation])

  const handleCloseReviewModal = useCallback(() => {
    setReviewModalOpen(false)
  }, [])

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
  const progress = selectedSummary?.progress ?? null

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
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <TaskEditor
                  title={editorTitle}
                  path={selectedPath}
                  mode={mode}
                  draft={draft}
                  progress={progress}
                  agentSession={agentSession}
                  taskDescription={draft}
                  isArchived={selectedSummary?.archived ?? false}
                  isArchiving={archiveMutation.isPending}
                  isRestoring={restoreMutation.isPending}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onModeChange={setMode}
                  onDraftChange={(newDraft) => {
                    setDraft(newDraft)
                    setDirty(true)
                  }}
                  onCancelAgent={handleCancelAgent}
                />
              </div>

              {/* Footer with rewrite controls - only show in edit/preview mode */}
              {mode !== 'review' && (
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

        {/* Right: Task Controls Panel */}
        {selectedPath && (
          <div className="w-80 shrink-0 border-l border-border overflow-hidden">
            <TaskSidebar
              dirty={dirty}
              isSaving={isSaving}
              isDeleting={deleteMutation.isPending}
              isAssigning={assignToAgentMutation.isPending}
              saveError={saveError}
              runAgentType={runAgentType}
              runModel={runModel}
              availableTypes={availableTypes}
              agentSession={agentSession}
              taskSessions={taskSessions}
              onSave={handleSave}
              onDelete={handleDelete}
              onReview={handleReview}
              onVerify={handleVerify}
              onAssignToAgent={handleAssignToAgent}
              onRunAgentTypeChange={handleRunAgentTypeChange}
              onRunModelChange={setRunModel}
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
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        onTitleChange={setNewTitle}
        onTaskTypeChange={setTaskType}
        onUseAgentChange={setUseAgent}
        onAgentTypeChange={handleCreateAgentTypeChange}
        onModelChange={setCreateModel}
      />

      <ReviewModal
        isOpen={reviewModalOpen}
        mode={reviewMode}
        taskTitle={editorTitle}
        agentType={runAgentType}
        model={runModel}
        availableTypes={availableTypes}
        onClose={handleCloseReviewModal}
        onStart={handleStartReview}
      />

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
