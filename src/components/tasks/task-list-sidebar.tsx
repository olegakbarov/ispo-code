/**
 * Task List for Global Sidebar
 * Self-contained component that fetches its own data via tRPC
 */

import { useMemo, useState, useCallback, memo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Play, ChevronRight, ChevronDown, Layers, ArchiveRestore } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { match } from 'ts-pattern'
import { Input } from '@/components/ui/input'
import { trpc } from '@/lib/trpc-client'
import { encodeTaskPath, decodeTaskPath, stripModeSuffix } from '@/lib/utils/task-routing'
import { useSettingsStore } from '@/lib/stores/settings'
import { useTaskListPreferences } from '@/lib/stores/task-list-preferences'
import { getTaskListAction, getTaskListActionTitle } from '@/components/tasks/task-list-action'
import { TaskCommandPalette } from '@/components/tasks/task-command-palette'

interface TaskSummary {
  path: string
  title: string
  source: string
  archived: boolean
  archivedAt?: string
  progress: {
    total: number
    done: number
    inProgress: number
  }
  subtaskCount: number
  hasSubtasks: boolean
}

interface ActiveAgentSession {
  sessionId: string
  status: string
}

interface TaskItemProps {
  task: TaskSummary
  isActive: boolean
  agentSession?: ActiveAgentSession
  onSelect: (path: string) => void
  onRunImpl: (path: string) => void
  onRunVerify: (path: string) => void
  onNavigateReview: (path: string) => void
  onRestore?: (path: string) => void
  isRestoring?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
}

const TaskItem = memo(function TaskItem({
  task,
  isActive,
  agentSession,
  onSelect,
  onRunImpl,
  onRunVerify: _onRunVerify, // Keep in interface for potential context menu use
  onNavigateReview,
  onRestore,
  isRestoring,
  isExpanded,
  onToggleExpand,
}: TaskItemProps) {
  // Simplified rendering for archived tasks - title with unarchive button
  if (task.archived) {
    const handleRestore = (e: React.MouseEvent) => {
      e.stopPropagation()
      onRestore?.(task.path)
    }

    return (
      <div
        onClick={() => onSelect(task.path)}
        className={`w-full text-left px-2 py-3 cursor-pointer transition-colors border-t border-border flex items-center gap-2 ${
          isActive ? 'bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground/60'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-vcr truncate">{task.title}</div>
        </div>
        <div className="shrink-0">
          {isRestoring ? (
            <div className="p-1">
              <Spinner size="sm" className="text-accent" />
            </div>
          ) : (
            <button
              onClick={handleRestore}
              className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-accent transition-colors"
              title="Unarchive task"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  const hasActiveAgent = !!agentSession
  const { total, done } = task.progress
  const showProgress = total > 0
  const donePercent = total > 0 ? (done / total) * 100 : 0

  const action = getTaskListAction({ total, done })

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasActiveAgent) return

    if (action === 'review') {
      onNavigateReview(task.path)
    } else {
      onRunImpl(task.path)
    }
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand?.()
  }

  const actionTitle = getTaskListActionTitle(action)

  return (
    <div
      onClick={() => onSelect(task.path)}
      className={`w-full text-left px-2 py-3 cursor-pointer transition-colors border-t border-border flex items-center gap-2 ${
        isActive ? 'bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground'
      }`}
    >
      {/* Expand/collapse toggle for tasks with subtasks */}
      {task.hasSubtasks && (
        <button
          onClick={handleToggleExpand}
          className="shrink-0 -ml-1 p-0.5 rounded hover:bg-accent/20 text-muted-foreground hover:text-accent transition-colors"
          title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {/* Title and progress bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-xs font-vcr truncate">{task.title}</div>
          {/* Subtask count badge */}
          {task.hasSubtasks && (
            <div className="shrink-0 flex items-center gap-0.5 text-[9px] text-muted-foreground bg-border/30 px-1 py-0.5 rounded">
              <Layers className="w-2.5 h-2.5" />
              <span>{task.subtaskCount}</span>
            </div>
          )}
        </div>
        {showProgress && (
          <div className="mt-1.5 flex gap-0.5">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  i < done
                    ? donePercent < 50
                      ? 'bg-yellow-500'
                      : 'bg-accent'
                    : 'bg-border/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Single action button - shows spinner when agent running */}
      <div className="shrink-0">
        {hasActiveAgent ? (
          <div className="p-1">
            <Spinner size="sm" className="text-accent" />
          </div>
        ) : (
          <button
            onClick={handleAction}
            className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-accent transition-colors"
            title={actionTitle}
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
})

export function TaskListSidebar() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const [filter, setFilter] = useState('')

  // Extract selected task from URL path (new format: /tasks/<encoded-path>[/mode])
  const pathname = routerState.location.pathname
  const selectedPath = useMemo(() => {
    // Match /tasks/<something> but not /tasks/new
    const match = pathname.match(/^\/tasks\/(.+)$/)
    if (match && match[1] !== 'new') {
      // Strip mode suffix (/edit, /review, /debate) before decoding
      const withoutMode = stripModeSuffix(match[1])
      return decodeTaskPath(withoutMode)
    }
    return null
  }, [pathname])

  // Get filter/sort preferences from store
  const { archiveFilter, sortBy, sortDir, setArchiveFilter } = useTaskListPreferences()

  // Track expanded tasks for subtask visibility
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  // Fetch data
  const utils = trpc.useUtils()
  const { data: workingDir } = trpc.system.workingDir.useQuery()
  const { data: tasks = [], isLoading, error } = trpc.tasks.list.useQuery(undefined, {
    enabled: !!workingDir,
    refetchInterval: 5000,
  })
  const { data: activeAgentSessions = {} } = trpc.tasks.getActiveAgentSessions.useQuery(undefined, {
    enabled: !!workingDir,
    refetchInterval: 2000,
  })

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = tasks as TaskSummary[]

    // Apply archive filter
    if (archiveFilter === 'active') {
      result = result.filter((t) => !t.archived)
    } else if (archiveFilter === 'archived') {
      result = result.filter((t) => t.archived)
    }

    // Apply text search filter
    const q = filter.trim().toLowerCase()
    if (q) {
      result = result.filter((t) => {
        return (
          t.title.toLowerCase().includes(q) ||
          t.path.toLowerCase().includes(q) ||
          t.source.toLowerCase().includes(q)
        )
      })
    }

    // Sort tasks
    const sorted = [...result].sort((a, b) => {
      const cmp = match(sortBy)
        .with('updated', () => {
          // Tasks may have updatedAt from server - fall back to path comparison
          const aTime = (a as TaskSummary & { updatedAt?: string }).updatedAt ?? ''
          const bTime = (b as TaskSummary & { updatedAt?: string }).updatedAt ?? ''
          return bTime.localeCompare(aTime) // desc by default (newest first)
        })
        .with('title', () => a.title.localeCompare(b.title))
        .with('progress', () => {
          const aRatio = a.progress.total > 0 ? a.progress.done / a.progress.total : 0
          const bRatio = b.progress.total > 0 ? b.progress.done / b.progress.total : 0
          return bRatio - aRatio // desc by default (highest progress first)
        })
        .exhaustive()
      return sortDir === 'asc' ? -cmp : cmp
    })

    return sorted
  }, [filter, tasks, archiveFilter, sortBy, sortDir])

  const handleArchiveFilterChange = useCallback((newFilter: typeof archiveFilter) => {
    setArchiveFilter(newFilter)
  }, [setArchiveFilter])

  const handleTaskSelect = useCallback((path: string) => {
    // Navigate to /tasks/<encoded-path>
    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(path) },
    })
  }, [navigate])

  // Mutations for running implementation and verification with optimistic updates
  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [path]: {
          sessionId: `pending-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousSessions, path }
    },
    onSuccess: (data) => {
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [data.path]: {
          sessionId: data.sessionId,
          status: data.status,
        },
      }))
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
  })

  const verifyWithAgentMutation = trpc.tasks.verifyWithAgent.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [path]: {
          sessionId: `pending-verify-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousSessions, path }
    },
    onSuccess: (data) => {
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [data.path]: {
          sessionId: data.sessionId,
          status: data.status,
        },
      }))
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
  })

  const handleRunImpl = useCallback((path: string) => {
    assignToAgentMutation.mutate({ path })
  }, [assignToAgentMutation])

  // Get verification defaults from settings
  const { defaultVerifyAgentType, defaultVerifyModelId } = useSettingsStore()

  const handleRunVerify = useCallback((path: string) => {
    verifyWithAgentMutation.mutate({
      path,
      // Use settings defaults if available, otherwise let server use its defaults
      ...(defaultVerifyAgentType && { agentType: defaultVerifyAgentType }),
      ...(defaultVerifyModelId && { model: defaultVerifyModelId }),
    })
  }, [verifyWithAgentMutation, defaultVerifyAgentType, defaultVerifyModelId])

  const handleNavigateReview = useCallback((path: string) => {
    // Navigate to task review page for commit & archive
    navigate({
      to: `/tasks/${encodeTaskPath(path)}/review` as '/tasks/$',
    })
  }, [navigate])

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Archive and restore mutations
  const archiveMutation = trpc.tasks.archive.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate()
    },
  })

  const restoreMutation = trpc.tasks.restore.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate()
    },
  })

  const handleArchive = useCallback((path: string) => {
    archiveMutation.mutate({ path })
  }, [archiveMutation])

  const handleRestore = useCallback((path: string) => {
    restoreMutation.mutate({ path })
  }, [restoreMutation])

  if (!workingDir) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-3">
        Select a project
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Command palette trigger - full row */}
      <div className="px-3 py-2 border-b border-border">
        <TaskCommandPalette
          variant="inline"
          tasks={tasks}
          selectedPath={selectedPath}
          onRunImpl={handleRunImpl}
          onRunVerify={handleRunVerify}
          onNavigateReview={handleNavigateReview}
          onArchive={handleArchive}
          onRestore={handleRestore}
        />
      </div>

      {/* Filters row */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        {/* Archive filter tabs */}
        <div className="flex items-center gap-1 shrink-0" role="tablist" aria-label="Task filter">
          <button
            onClick={() => handleArchiveFilterChange('active')}
            role="tab"
            aria-selected={archiveFilter === 'active'}
            aria-label="Show active tasks"
            className={`px-2 py-1 rounded text-[10px] font-vcr transition-colors ${
              archiveFilter === 'active'
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => handleArchiveFilterChange('archived')}
            role="tab"
            aria-selected={archiveFilter === 'archived'}
            aria-label="Show archived tasks"
            className={`px-2 py-1 rounded text-[10px] font-vcr transition-colors ${
              archiveFilter === 'archived'
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            Archived
          </button>
        </div>

        {/* Filter input */}
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          variant="sm"
          className="bg-background border-t border-l border-border/60 flex-1"
          data-hotkey-target="task-filter"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading tasks...</div>
        ) : error ? (
          <div className="p-3 text-xs text-destructive">{error.message}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">No tasks found</div>
        ) : (
          <div>
            {filteredTasks.map((t) => (
              <TaskItem
                key={t.path}
                task={t}
                isActive={t.path === selectedPath}
                agentSession={(activeAgentSessions as Record<string, ActiveAgentSession>)?.[t.path]}
                onSelect={handleTaskSelect}
                onRunImpl={handleRunImpl}
                onRunVerify={handleRunVerify}
                onNavigateReview={handleNavigateReview}
                onRestore={handleRestore}
                isRestoring={restoreMutation.isPending && restoreMutation.variables?.path === t.path}
                isExpanded={expandedTasks.has(t.path)}
                onToggleExpand={() => handleToggleExpand(t.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
