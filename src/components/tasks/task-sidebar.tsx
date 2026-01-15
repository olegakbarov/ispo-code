/**
 * Task Sidebar Component
 * Contains all task controls, rewrite panel, commit panel, and sessions list
 */

import { TaskSessions, type TaskSessionsGrouped } from './task-sessions'
import type { AgentSession } from './agent-types'
import { ExternalLink } from 'lucide-react'

interface TaskSidebarProps {
  // Mode - hide sessions/controls in review/debate mode
  mode: 'edit' | 'review' | 'debate'

  // Control state
  isSaving: boolean
  isDeleting: boolean
  isAssigning: boolean
  saveError: string | null

  // Agent session
  agentSession: AgentSession | null

  // Sessions list
  taskSessions?: {
    grouped: TaskSessionsGrouped
  }

  // Split from badge
  splitFrom?: string
  onNavigateToSplitFrom?: () => void

  // Commit and archive
  hasUncommittedChanges?: boolean
  onCommitAndArchive?: () => void

  // Debate state
  hasActiveDebate?: boolean

  // Handlers
  onDelete: () => void
  onReview: () => void
  onVerify: () => void
  onAssignToAgent: () => void
  onCancelAgent?: (sessionId: string) => void
}

export function TaskSidebar({
  mode,
  isSaving,
  isDeleting,
  isAssigning,
  saveError,
  agentSession,
  taskSessions,
  splitFrom,
  onNavigateToSplitFrom,
  hasActiveDebate,
  onDelete,
  onReview,
  onVerify,
  onAssignToAgent,
  onCancelAgent,
}: TaskSidebarProps) {
  // Hide sessions and controls in review mode
  if (mode === 'review') {
    return null
  }

  return (
    <div className="w-full h-full bg-panel overflow-y-auto flex flex-col">
      <div className="p-3 flex-1 flex flex-col">
        {/* Controls Section */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
              Controls
            </h3>
            {/* Autosave status indicator */}
            {isSaving && (
              <span className="text-[10px] text-text-muted animate-pulse">
                Saving...
              </span>
            )}
          </div>

          {saveError && (
            <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
              {saveError}
            </div>
          )}

          {/* Main action buttons - REVIEW, IMPLEMENT, VERIFY */}
          <div className="space-y-2">
            <button
              onClick={onReview}
              disabled={!!agentSession}
              className={`w-full px-3 py-2 rounded text-xs font-vcr border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                hasActiveDebate
                  ? 'border-accent/50 text-accent hover:bg-accent/10'
                  : 'border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover'
              }`}
              title={hasActiveDebate ? "Resume active spec review" : "Review spec quality (clarity, completeness, actionability)"}
            >
              {hasActiveDebate ? 'Resume Review' : 'Review'}
            </button>

            <button
              onClick={onAssignToAgent}
              disabled={isAssigning || !!agentSession}
              className="w-full px-3 py-2 rounded text-xs font-vcr border border-accent/50 text-accent cursor-pointer hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Assign this task to an AI agent for implementation"
            >
              {isAssigning ? 'Implementing...' : 'Implement'}
            </button>

            <button
              onClick={onVerify}
              disabled={!!agentSession}
              className="w-full px-3 py-2 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Verify completed items against codebase"
            >
              Verify
            </button>
          </div>

          {/* Split From Badge */}
          {splitFrom && onNavigateToSplitFrom && (
            <button
              onClick={onNavigateToSplitFrom}
              className="w-full px-3 py-2 rounded text-xs bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 cursor-pointer transition-colors flex items-center gap-2"
              title={`Split from: ${splitFrom}`}
            >
              <ExternalLink className="w-3 h-3" />
              <span className="truncate">Split from: {splitFrom.replace('tasks/', '')}</span>
            </button>
          )}
        </div>

        {/* Sessions Section */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
            Sessions
          </h3>
          {taskSessions ? (
            <TaskSessions
              planning={taskSessions.grouped.planning}
              review={taskSessions.grouped.review}
              verify={taskSessions.grouped.verify}
              execution={taskSessions.grouped.execution}
              rewrite={taskSessions.grouped.rewrite}
              comment={taskSessions.grouped.comment}
              onCancelSession={onCancelAgent}
            />
          ) : (
            <div className="p-4 border border-border/40 rounded text-center">
              <p className="text-xs text-text-muted">No sessions yet</p>
              <p className="text-[10px] text-text-muted mt-1">
                Sessions will appear here when you run an agent
              </p>
            </div>
          )}
        </div>

        {/* Delete Button - pushed to bottom */}
        <div className="mt-auto pt-4 border-t border-border/50">
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="w-full px-3 py-2 rounded text-xs font-vcr border border-error/50 text-error cursor-pointer hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete this task"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
