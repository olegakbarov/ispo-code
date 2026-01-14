/**
 * Task list sidebar component
 */

import { Input } from '@/components/ui/input'

interface TaskSummary {
  path: string
  title: string
  source: string
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

interface TaskListProps {
  tasks: TaskSummary[]
  selectedPath: string | null
  filter: string
  isLoading: boolean
  error: string | null
  activeAgentSessions: Record<string, ActiveAgentSession> | undefined
  onFilterChange: (filter: string) => void
  onTaskSelect: (path: string) => void
}

export function TaskList({
  tasks,
  selectedPath,
  filter,
  isLoading,
  error,
  activeAgentSessions,
  onFilterChange,
  onTaskSelect,
}: TaskListProps) {
  return (
    <div className="w-80 shrink-0 min-h-0 flex flex-col bg-panel">
      <div className="p-2 border-b border-border">
        <Input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter tasks..."
          variant="sm"
          className="bg-background border-t border-l border-border/60"
        />
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
                    {showProgress && (
                      <div className="shrink-0 flex items-center gap-1 text-[10px] font-vcr">
                        <span className="text-accent">{done}/{total}</span>
                        {inProgress > 0 && (
                          <span className="text-warning">~ {inProgress}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
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

export type { TaskSummary, ActiveAgentSession, TaskListProps }
