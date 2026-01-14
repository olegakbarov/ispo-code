/**
 * Tasks Page - Markdown-backed task plans
 * Uses tRPC for all task operations (file-system backed)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { AgentType } from '@/lib/agent/types'
import { TaskList, type TaskSummary } from '@/components/tasks/task-list'
import { TaskEditor } from '@/components/tasks/task-editor'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { ReviewModal } from '@/components/tasks/review-modal'
import type { PlannerAgentType } from '@/components/tasks/agent-config'
import type { AgentSession } from '@/components/tasks/agent-types'
import { trpc } from '@/lib/trpc-client'

export const Route = createFileRoute('/tasks')({
  validateSearch: z
    .object({
      path: z.string().optional(),
    })
    .parse,
  component: TasksPage,
})

type Mode = 'edit' | 'preview'

function TasksPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const selectedPath = search.path ?? null
  const { data: workingDir } = trpc.system.workingDir.useQuery()
  const utils = trpc.useUtils()

  // Task list from server
  const { data: tasks = [], isLoading: isLoadingList, error: listError } = trpc.tasks.list.useQuery(undefined, {
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

  const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
    const candidates: PlannerAgentType[] = ['cerebras', 'opencode', 'claude', 'codex']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  // Local state
  const [mode, setMode] = useState<Mode>('edit')
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const lastLoadedPathRef = useRef<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [useAgent, setUseAgent] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Agent type for "Create task with agent" (planning only)
  const [createAgentType, setCreateAgentType] = useState<PlannerAgentType>('cerebras')

  // Agent type for "Run with Agent"
  const [runAgentType, setRunAgentType] = useState<AgentType>('claude')

  // Review/Verify modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewMode, setReviewMode] = useState<'review' | 'verify'>('review')

  // Track active agent session for progress display (from polling)
  const activeSessionInfo = selectedPath ? activeAgentSessions[selectedPath] : undefined
  const activeSessionId = activeSessionInfo?.sessionId

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
      setCreateAgentType(availablePlannerTypes[0])
    }
  }, [availablePlannerTypes, createAgentType])

  // Keep run-with-agent setting valid as available types change.
  useEffect(() => {
    if (availableTypes.length === 0) return
    if (availableTypes.includes(runAgentType)) return

    const preferred: AgentType[] = ['claude', 'codex', 'cerebras', 'opencode']
    const next = preferred.find((t) => availableTypes.includes(t)) ?? availableTypes[0]
    setRunAgentType(next)
  }, [availableTypes, runAgentType])

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
        search: { path: data.path },
      })
    },
  })

  const createWithAgentMutation = trpc.tasks.createWithAgent.useMutation({
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      navigate({
        to: '/tasks',
        search: { path: data.path },
      })
    },
  })

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate()
      navigate({ to: '/tasks', search: {} })
    },
  })

  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation({
    onSuccess: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  const cancelAgentMutation = trpc.agent.cancel.useMutation({
    onSuccess: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
      if (selectedPath) {
        utils.tasks.get.invalidate({ path: selectedPath })
      }
      utils.tasks.list.invalidate()
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

  const filteredTasks = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter((t: TaskSummary) => {
      return (
        t.title.toLowerCase().includes(q) ||
        t.path.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q)
      )
    })
  }, [filter, tasks])

  const selectedSummary = useMemo(() => {
    if (!selectedPath) return null
    return tasks.find((t: TaskSummary) => t.path === selectedPath) ?? null
  }, [selectedPath, tasks])

  const selectTask = useCallback(
    (path: string) => {
      if (path === selectedPath) return
      if (dirty && !globalThis.confirm('You have unsaved changes. Discard them?')) return

      lastLoadedPathRef.current = null
      prevActiveSessionIdRef.current = null
      setMode('edit')

      navigate({
        to: '/tasks',
        search: (prev: { path?: string }) => ({ ...prev, path }),
      })
    },
    [dirty, navigate, selectedPath]
  )

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

  const openCreate = () => {
    setNewTitle('')
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    const title = newTitle.trim()
    if (!title) return

    try {
      if (useAgent) {
        await createWithAgentMutation.mutateAsync({
          title,
          agentType: createAgentType,
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
    if (!globalThis.confirm('Are you sure you want to delete this task?')) return
    try {
      await deleteMutation.mutateAsync({ path: selectedPath })
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }, [selectedPath, deleteMutation])

  const handleAssignToAgent = useCallback(async () => {
    if (!selectedPath) return
    if (dirty && !globalThis.confirm('You have unsaved changes. Save before assigning to agent?')) {
      return
    }

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
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to assign to agent'
      setSaveError(msg)
      console.error('Failed to assign to agent:', err)
    }
  }, [selectedPath, dirty, draft, runAgentType, saveMutation, assignToAgentMutation])

  const handleCancelAgent = useCallback(() => {
    if (!activeSessionId) return
    cancelAgentMutation.mutate({ id: activeSessionId })
  }, [activeSessionId, cancelAgentMutation])

  const handleReview = useCallback(() => {
    setReviewMode('review')
    setReviewModalOpen(true)
  }, [])

  const handleVerify = useCallback(() => {
    setReviewMode('verify')
    setReviewModalOpen(true)
  }, [])

  const handleStartReview = useCallback(async (agentType: AgentType, instructions?: string) => {
    if (!selectedPath) return

    try {
      setSaveError(null)
      const result = await (reviewMode === 'review'
        ? reviewWithAgentMutation.mutateAsync({
            path: selectedPath,
            agentType,
            instructions,
          })
        : verifyWithAgentMutation.mutateAsync({
            path: selectedPath,
            agentType,
            instructions,
          }))

      // Optimistically set the session in cache before navigating
      // This prevents "Session not found" while daemon initializes
      const taskTitle = selectedSummary?.title ?? selectedPath
      utils.agent.get.setData({ id: result.sessionId }, {
        id: result.sessionId,
        prompt: `${reviewMode === 'review' ? 'Review' : 'Verify'}: ${taskTitle}`,
        title: `${reviewMode === 'review' ? 'Review' : 'Verify'}: ${taskTitle}`,
        status: 'pending',
        startedAt: new Date().toISOString(),
        workingDir: workingDir ?? '',
        output: [],
        agentType,
        taskPath: selectedPath,
        resumable: true,
      })

      // Navigate to the new agent session
      navigate({ to: '/agents/$sessionId', params: { sessionId: result.sessionId } })
    } catch (err) {
      console.error('Failed to start review:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to start review')
      throw err // Re-throw so modal can handle it
    }
  }, [selectedPath, reviewMode, reviewWithAgentMutation, verifyWithAgentMutation, navigate, utils, selectedSummary, workingDir])

  const handleCloseReviewModal = useCallback(() => {
    setReviewModalOpen(false)
  }, [])

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
        {/* Left: Task List */}
        <TaskList
          tasks={filteredTasks}
          selectedPath={selectedPath}
          filter={filter}
          isLoading={isLoadingList}
          error={listError?.message ?? null}
          activeAgentSessions={activeAgentSessions}
          onFilterChange={setFilter}
          onTaskSelect={selectTask}
          onCreateClick={openCreate}
        />

        {/* Right: Editor/Preview */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-background overflow-hidden border-l border-border">
          {!selectedPath ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
              Select a task to view/edit
            </div>
          ) : (
            <TaskEditor
              title={editorTitle}
              path={selectedPath}
              mode={mode}
              draft={draft}
              dirty={dirty}
              progress={progress}
              agentSession={agentSession}
              runAgentType={runAgentType}
              availableTypes={availableTypes}
              isSaving={isSaving}
              isDeleting={deleteMutation.isPending}
              isAssigning={assignToAgentMutation.isPending}
              saveError={saveError}
              onModeChange={setMode}
              onDraftChange={(newDraft) => {
                setDraft(newDraft)
                setDirty(true)
              }}
              onSave={handleSave}
              onDelete={handleDelete}
              onReview={handleReview}
              onVerify={handleVerify}
              onAssignToAgent={handleAssignToAgent}
              onRunAgentTypeChange={setRunAgentType}
              onCancelAgent={handleCancelAgent}
            />
          )}
        </div>
      </div>

      <CreateTaskModal
        isOpen={createOpen}
        isCreating={createMutation.isPending || createWithAgentMutation.isPending}
        newTitle={newTitle}
        useAgent={useAgent}
        createAgentType={createAgentType}
        availableTypes={availableTypes}
        availablePlannerTypes={availablePlannerTypes}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        onTitleChange={setNewTitle}
        onUseAgentChange={setUseAgent}
        onAgentTypeChange={setCreateAgentType}
      />

      <ReviewModal
        isOpen={reviewModalOpen}
        mode={reviewMode}
        taskTitle={editorTitle}
        agentType={runAgentType}
        availableTypes={availableTypes}
        onClose={handleCloseReviewModal}
        onStart={handleStartReview}
      />

    </div>
  )
}
