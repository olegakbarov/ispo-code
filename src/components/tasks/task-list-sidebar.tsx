/**
 * Task List for Global Sidebar
 * Self-contained component that fetches its own data via tRPC
 */

import { useMemo, useState, useCallback, memo } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { trpc } from '@/lib/trpc-client'
import { encodeTaskPath, decodeTaskPath } from '@/lib/utils/task-routing'

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
}

interface ActiveAgentSession {
  sessionId: string
  status: string
}

type ArchiveFilter = 'all' | 'active' | 'archived'
type SortOption = 'updated' | 'title' | 'progress'
type SortDirection = 'asc' | 'desc'

interface TaskItemProps {
  task: TaskSummary
  isActive: boolean
  agentSession?: ActiveAgentSession
  onSelect: (path: string) => void
  onRunImpl: (path: string) => void
  onRunVerify: (path: string) => void
  onNavigateReview: (path: string) => void
}

const TaskItem = memo(function TaskItem({ task, isActive, agentSession, onSelect, onRunImpl, onRunVerify, onNavigateReview }: TaskItemProps) {
  // Simplified rendering for archived tasks - just title with muted styling
  if (task.archived) {
    return (
      <div
        onClick={() => onSelect(task.path)}
        className={`w-full text-left px-3 py-3 cursor-pointer transition-colors border-t border-border/40 ${
          isActive ? 'bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground/60'
        }`}
      >
        <div className="text-xs font-vcr truncate">{task.title}</div>
      </div>
    )
  }

  const hasActiveAgent = !!agentSession
  const { total, done } = task.progress
  const showProgress = total > 0
  const donePercent = total > 0 ? (done / total) * 100 : 0

  // Determine task state for action button
  // - plan ready: done === 0 → run impl
  // - impl done: 0 < done < total → run verify
  // - all done: done === total → navigate to review
  const isComplete = total > 0 && done === total
  const needsVerify = done > 0 && done < total

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasActiveAgent) return

    if (isComplete) {
      onNavigateReview(task.path)
    } else if (needsVerify) {
      onRunVerify(task.path)
    } else {
      onRunImpl(task.path)
    }
  }

  // Determine action title based on state
  let actionTitle = "Run implementation"
  if (isComplete) {
    actionTitle = "Review & commit"
  } else if (needsVerify) {
    actionTitle = "Run verification"
  }

  return (
    <div
      onClick={() => onSelect(task.path)}
      className={`w-full text-left px-3 py-3 cursor-pointer transition-colors border-t border-border/40 flex items-center gap-2 ${
        isActive ? 'bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground'
      }`}
    >
      {/* Title and progress bar */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-vcr truncate">{task.title}</div>
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
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
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

  // Extract selected task from URL path (new format: /tasks/<encoded-path>)
  const pathname = routerState.location.pathname
  const selectedPath = useMemo(() => {
    // Match /tasks/<something> but not /tasks/new
    const match = pathname.match(/^\/tasks\/(.+)$/)
    if (match && match[1] !== 'new') {
      return decodeTaskPath(match[1])
    }
    return null
  }, [pathname])

  // Get search params for filter/sort state
  const searchParams = routerState.location.search as {
    archiveFilter?: ArchiveFilter
    sortBy?: SortOption
    sortDir?: SortDirection
  }
  const archiveFilter = searchParams.archiveFilter ?? 'active'
  const sortBy = searchParams.sortBy ?? 'updated'
  const sortDir = searchParams.sortDir ?? 'desc'

  // Fetch data
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
      let cmp = 0
      switch (sortBy) {
        case 'updated':
          // Tasks may have updatedAt from server - fall back to path comparison
          const aTime = (a as TaskSummary & { updatedAt?: string }).updatedAt ?? ''
          const bTime = (b as TaskSummary & { updatedAt?: string }).updatedAt ?? ''
          cmp = bTime.localeCompare(aTime) // desc by default (newest first)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'progress':
          const aRatio = a.progress.total > 0 ? a.progress.done / a.progress.total : 0
          const bRatio = b.progress.total > 0 ? b.progress.done / b.progress.total : 0
          cmp = bRatio - aRatio // desc by default (highest progress first)
          break
      }
      return sortDir === 'asc' ? -cmp : cmp
    })

    return sorted
  }, [filter, tasks, archiveFilter, sortBy, sortDir])

  const handleArchiveFilterChange = useCallback((newFilter: ArchiveFilter) => {
    // Navigate to the same task (if any) but with new filter
    if (selectedPath) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(selectedPath) },
        search: { archiveFilter: newFilter, sortBy, sortDir },
      })
    } else {
      navigate({
        to: '/tasks',
        search: { archiveFilter: newFilter, sortBy, sortDir },
      })
    }
  }, [navigate, selectedPath, sortBy, sortDir])

  const handleTaskSelect = useCallback((path: string) => {
    // Navigate to /tasks/<encoded-path> with search params
    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(path) },
      search: { archiveFilter, sortBy, sortDir },
    })
  }, [navigate, archiveFilter, sortBy, sortDir])

  // Mutations for running implementation and verification
  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation()
  const verifyWithAgentMutation = trpc.tasks.verifyWithAgent.useMutation()

  const handleRunImpl = useCallback((path: string) => {
    assignToAgentMutation.mutate({ path })
  }, [assignToAgentMutation])

  const handleRunVerify = useCallback((path: string) => {
    verifyWithAgentMutation.mutate({ path })
  }, [verifyWithAgentMutation])

  const handleNavigateReview = useCallback((path: string) => {
    // Navigate to task review page for commit & archive
    navigate({
      to: `/tasks/${encodeTaskPath(path)}/review` as '/tasks/$',
      search: { archiveFilter, sortBy, sortDir },
    })
  }, [navigate, archiveFilter, sortBy, sortDir])

  if (!workingDir) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-3">
        Select a project
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        {/* Archive filter tabs */}
        <div className="flex items-center gap-1 shrink-0" role="tablist" aria-label="Task filter">
          <button
            onClick={() => handleArchiveFilterChange('all')}
            role="tab"
            aria-selected={archiveFilter === 'all'}
            aria-label="Show all tasks"
            className={`px-2 py-1 rounded text-[10px] font-vcr transition-colors ${
              archiveFilter === 'all'
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            All
          </button>
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
