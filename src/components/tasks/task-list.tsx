/**
 * Task list sidebar component
 */

import { Input } from '@/components/ui/input'

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

interface TaskListProps {
  tasks: TaskSummary[]
  selectedPath: string | null
  filter: string
  archiveFilter: ArchiveFilter
  isLoading: boolean
  error: string | null
  activeAgentSessions: Record<string, ActiveAgentSession> | undefined
  onFilterChange: (filter: string) => void
  onArchiveFilterChange: (filter: ArchiveFilter) => void
  onTaskSelect: (path: string) => void
}

export function TaskList({
  tasks,
  selectedPath,
  filter,
  archiveFilter,
  isLoading,
  error,
  activeAgentSessions,
  onFilterChange,
  onArchiveFilterChange,
  onTaskSelect,
}: TaskListProps) {
  return (
    <div className="w-80 shrink-0 min-h-0 flex flex-col bg-panel">
      <div className="px-3 border-b border-border">
        <div className="h-12 flex items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter tasks..."
            variant="sm"
            className="bg-background border-t border-l border-border/60 flex-1"
          />
        </div>

        {/* Archive filter toggle */}
        <div className="pb-2 flex items-center gap-1">
          <button
            onClick={() => onArchiveFilterChange('all')}
            className={`px-2 py-1 rounded text-[10px] font-vcr transition-colors ${
              archiveFilter === 'all'
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onArchiveFilterChange('active')}
            className={`px-2 py-1 rounded text-[10px] font-vcr transition-colors ${
              archiveFilter === 'active'
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => onArchiveFilterChange('archived')}
            className={`px-2 py-1 rounded text-[10px] font-vcr transition-colors ${
              archiveFilter === 'archived'
                ? 'bg-accent/20 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 text-xs text-text-muted">Loading tasks...</div>
        ) : error ? (
          <div className="p-3 text-xs text-error">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="p-3 text-xs text-text-muted">No tasks found</div>
        ) : (
          <div>
            {tasks.map((t) => {
              const isActive = t.path === selectedPath
              const total = t.progress.total
              const done = t.progress.done
              const inProgress = t.progress.inProgress
              const showProgress = total > 0
              const agentSession = activeAgentSessions?.[t.path]
              const hasActiveAgent = !!agentSession

              // Calculate percentages for progress bar
              const donePercent = total > 0 ? (done / total) * 100 : 0
              const inProgressPercent = total > 0 ? (inProgress / total) * 100 : 0

              return (
                <button
                  key={t.path}
                  onClick={() => onTaskSelect(t.path)}
                  className={`w-full text-left px-3 py-2 cursor-pointer transition-colors border-t border-border/40 ${
                    isActive ? 'bg-accent/10 text-accent' : 'hover:bg-panel-hover text-text-secondary'
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
                        <span className="text-text-muted">
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
                    <div className="text-[10px] text-text-muted truncate min-w-0">{t.path}</div>
                    <div className="shrink-0 flex items-center gap-1">
                      {hasActiveAgent && (
                        <span className="text-[10px] font-vcr text-accent">
                          {agentSession.status === 'working' ? 'working' : agentSession.status}
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted">{t.source}</span>
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

export type { TaskSummary, ActiveAgentSession, TaskListProps, ArchiveFilter }
