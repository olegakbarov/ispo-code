/**
 * Task Sidebar Component
 * Contains all task controls, rewrite panel, commit panel, and sessions list
 */

import { Select } from '@/components/ui/select'
import { TaskSessions } from './task-sessions'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import { Scissors, ExternalLink } from 'lucide-react'

interface TaskSidebarProps {
  // Mode - hide sessions/controls in review/debate mode
  mode: 'edit' | 'review' | 'debate'

  // Control state
  isSaving: boolean
  isDeleting: boolean
  isAssigning: boolean
  saveError: string | null

  // Run controls
  runAgentType: AgentType
  runModel: string
  availableTypes: AgentType[] | undefined
  agentSession: any | null

  // Sessions list
  taskSessions?: {
    grouped: {
      planning: any[]
      review: any[]
      verify: any[]
      execution: any[]
      rewrite: any[]
      comment: any[]
    }
  }

  // Split task
  canSplit?: boolean
  splitFrom?: string
  onSplit?: () => void
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
  onRunAgentTypeChange: (agentType: AgentType) => void
  onRunModelChange: (model: string) => void
  onCancelAgent?: () => void
}

export function TaskSidebar({
  mode,
  isSaving,
  isDeleting,
  isAssigning,
  saveError,
  runAgentType,
  runModel,
  availableTypes,
  agentSession,
  taskSessions,
  canSplit,
  splitFrom,
  onSplit,
  onNavigateToSplitFrom,
  hasActiveDebate,
  onDelete,
  onReview,
  onVerify,
  onAssignToAgent,
  onRunAgentTypeChange,
  onRunModelChange,
  onCancelAgent,
}: TaskSidebarProps) {
  // Hide sessions and controls in review mode
  if (mode === 'review') {
    return null
  }

  return (
    <div className="w-full bg-panel overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Sessions Section - Most Prominent */}
        <div className="space-y-2">
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
              onCancelSession={onCancelAgent ? () => onCancelAgent() : undefined}
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

        {/* Controls Section */}
        <div className="space-y-3 pt-2 border-t border-border/50">
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

            {/* Implement with Agent */}
            <Select
              value={runAgentType}
              onChange={(e) => onRunAgentTypeChange(e.target.value as AgentType)}
              variant="sm"
              disabled={isAssigning || !!agentSession}
              className="w-full bg-background text-xs py-1.5"
            >
              {(Object.keys(agentTypeLabel) as AgentType[]).map((t) => (
                <option key={t} value={t} disabled={availableTypes ? !availableTypes.includes(t) : false}>
                  {agentTypeLabel[t]}
                </option>
              ))}
            </Select>

            <button
              onClick={onAssignToAgent}
              disabled={isAssigning || !!agentSession || (availableTypes ? !availableTypes.includes(runAgentType) : false)}
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

          {/* Split Task Button */}
          {canSplit && onSplit && (
            <button
              onClick={onSplit}
              disabled={!!agentSession}
              className="w-full px-3 py-2 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-2"
              title="Split this task into multiple subtasks"
            >
              <Scissors className="w-3 h-3" />
              Split Task
            </button>
          )}

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

        {/* Delete Button - at bottom */}
        <div className="pt-2 border-t border-border/50">
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
