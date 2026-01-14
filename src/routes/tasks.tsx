/**
 * Tasks Page - Markdown-backed task plans
 * Uses tRPC for all task operations (file-system backed)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { AgentType } from '@/lib/agent/types'
import { TaskList, type TaskSummary } from './tasks/-task-list'
import { TaskEditor } from './tasks/-task-editor'
import { CreateTaskModal } from './tasks/-create-task-modal'
import type { PlannerAgentType } from './tasks/-agent-config'
import type { AgentSession } from './tasks/-agent-types'
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
    const candidates: PlannerAgentType[] = ['claude', 'codex', 'opencode']
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
  const [createAgentType, setCreateAgentType] = useState<PlannerAgentType>('claude')

  // Agent type for "Run with Agent"
  const [runAgentType, setRunAgentType] = useState<AgentType>('cerebras')

  // Track active agent session for progress display (from polling)
  const agentSession: AgentSession | null = useMemo(() => {
    if (!selectedPath || !activeAgentSessions[selectedPath]) return null
    const { sessionId, status } = activeAgentSessions[selectedPath]
    return {
      id: sessionId,
      status: status as AgentSession['status'],
      prompt: `Executing task: ${selectedPath}`,
      output: [],
    }
  }, [selectedPath, activeAgentSessions])

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
      setMode('edit')

      navigate({
        to: '/tasks',
        search: (prev) => ({ ...prev, path }),
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
      await assignToAgentMutation.mutateAsync({
        path: selectedPath,
        agentType: runAgentType,
      })
    } catch (err) {
      console.error('Failed to assign to agent:', err)
    }
  }, [selectedPath, dirty, draft, runAgentType, saveMutation, assignToAgentMutation])

  const handleCancelAgent = useCallback(() => {
    // TODO: Implement agent cancellation via tRPC
    console.log('Agent cancellation not yet implemented')
  }, [])

  const handleReview = useCallback(() => {
    // TODO: Implement review modal with reviewWithAgent mutation
    globalThis.alert('Review feature coming soon!')
  }, [])

  const editorTitle = selectedSummary?.title ?? (selectedPath ? selectedPath : 'Tasks')
  const progress = selectedSummary?.progress ?? null

  // Show message if no working directory set
  if (!workingDir) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
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
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <h1 className="font-vcr text-sm text-accent">Tasks</h1>
        <button
          onClick={openCreate}
          className="px-2 py-1 rounded text-[10px] font-vcr bg-accent text-background cursor-pointer hover:opacity-90"
        >
          + New Task
        </button>
      </div>

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
    </div>
  )
}
