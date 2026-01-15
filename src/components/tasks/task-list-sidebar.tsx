/**
 * Task List for Global Sidebar
 * Self-contained component that fetches its own data via tRPC
 */

import { useMemo, useState, useCallback } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowUp, ArrowDown } from 'lucide-react'
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

  const handleSortChange = useCallback((newSortBy: SortOption) => {
    // If same sort option clicked, toggle direction; otherwise use desc default
    const newDir = newSortBy === sortBy ? (sortDir === 'desc' ? 'asc' : 'desc') : 'desc'
    if (selectedPath) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(selectedPath) },
        search: { archiveFilter, sortBy: newSortBy, sortDir: newDir },
      })
    } else {
      navigate({
        to: '/tasks',
        search: { archiveFilter, sortBy: newSortBy, sortDir: newDir },
      })
    }
  }, [navigate, selectedPath, archiveFilter, sortBy, sortDir])

  const handleTaskSelect = useCallback((path: string) => {
    // Navigate to /tasks/<encoded-path> with search params
    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(path) },
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
      <div className="px-3 border-b border-border">
        {/* Archive filter tabs */}
        <div className="pt-2 pb-1 flex items-center gap-1" role="tablist" aria-label="Task filter">
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

        {/* Filter input + Sort buttons */}
        <div className="pb-2 flex items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tasks..."
            variant="sm"
            className="bg-background border-t border-l border-border/60 flex-1"
          />

          {/* Sort buttons */}
          <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Sort options">
            {(['updated', 'title', 'progress'] as const).map((option) => {
              const isActive = sortBy === option
              const labels: Record<SortOption, string> = {
                updated: 'Date',
                title: 'Name',
                progress: '%',
              }
              const ariaLabels: Record<SortOption, string> = {
                updated: 'Sort by date',
                title: 'Sort by name',
                progress: 'Sort by progress',
              }
              return (
                <button
                  key={option}
                  onClick={() => handleSortChange(option)}
                  aria-label={`${ariaLabels[option]}${isActive ? `, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                  aria-pressed={isActive}
                  className={`px-1.5 py-1 rounded text-[10px] font-vcr transition-colors flex items-center gap-0.5 ${
                    isActive
                      ? 'bg-accent/20 text-accent'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  title={`Sort by ${option}${isActive ? ` (${sortDir === 'asc' ? 'ascending' : 'descending'})` : ''}`}
                >
                  {labels[option]}
                  {isActive && (
                    sortDir === 'asc'
                      ? <ArrowUp className="w-2.5 h-2.5" aria-hidden="true" />
                      : <ArrowDown className="w-2.5 h-2.5" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
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
            {filteredTasks.map((t) => {
              const isActive = t.path === selectedPath
              const total = t.progress.total
              const done = t.progress.done
              const inProgress = t.progress.inProgress
              const showProgress = total > 0
              const agentSession = (activeAgentSessions as Record<string, ActiveAgentSession>)?.[t.path]
              const hasActiveAgent = !!agentSession

              // Calculate percentages for progress bar
              const donePercent = total > 0 ? (done / total) * 100 : 0
              const inProgressPercent = total > 0 ? (inProgress / total) * 100 : 0

              return (
                <button
                  key={t.path}
                  onClick={() => handleTaskSelect(t.path)}
                  className={`w-full text-left px-3 py-2 cursor-pointer transition-colors border-t border-border/40 ${
                    isActive ? 'bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Agent status indicator */}
                    {hasActiveAgent && (
                      <div
                        className="w-2 h-2 rounded-full bg-accent shrink-0 animate-pulse"
                        title={`Agent ${agentSession.status}`}
                      />
                    )}
                    <div className="text-xs font-vcr truncate flex-1">{t.title}</div>
                    {t.archived && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-vcr">
                        ARCHIVED
                      </span>
                    )}
                    {showProgress && (
                      <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-vcr">
                        <span className="text-accent">{done}/{total}</span>
                        <span className="text-muted-foreground">
                          {Math.round(donePercent)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {showProgress && (
                    <div className="mt-1.5 h-1 bg-border/50 rounded-full overflow-hidden flex">
                      {donePercent > 0 && (
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${donePercent}%` }}
                        />
                      )}
                      {inProgressPercent > 0 && (
                        <div
                          className="h-full bg-warning transition-all duration-300"
                          style={{ width: `${inProgressPercent}%` }}
                        />
                      )}
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-muted-foreground truncate min-w-0">{t.path}</div>
                    <div className="shrink-0 flex items-center gap-1">
                      {hasActiveAgent && (
                        <span className="text-[10px] font-vcr text-accent">
                          {agentSession.status === 'working' ? 'working' : agentSession.status}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{t.source}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
