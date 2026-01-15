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
  // Control state
  dirty: boolean
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

  // Handlers
  onSave: () => void
  onDelete: () => void
  onReview: () => void
  onVerify: () => void
  onAssignToAgent: () => void
  onRunAgentTypeChange: (agentType: AgentType) => void
  onRunModelChange: (model: string) => void
}

export function TaskSidebar({
  dirty,
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
  onSave,
  onDelete,
  onReview,
  onVerify,
  onAssignToAgent,
  onRunAgentTypeChange,
  onRunModelChange,
}: TaskSidebarProps) {
  return (
    <div className="w-full bg-panel overflow-y-auto">
      <div className="p-3 space-y-6">
        {/* Controls Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
            Controls
          </h3>

          {/* Save Button */}
          <button
            onClick={onSave}
            disabled={!dirty || isSaving}
            className="w-full px-3 py-2 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            title={dirty ? 'Save (Cmd/Ctrl+S)' : 'Saved'}
          >
            {isSaving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>

          {saveError && (
            <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
              {saveError}
            </div>
          )}

          {/* Review/Verify Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onReview}
              disabled={!!agentSession}
              className="flex-1 px-3 py-2 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Review spec quality (clarity, completeness, actionability)"
            >
              Review
            </button>

            <button
              onClick={onVerify}
              disabled={!!agentSession}
              className="flex-1 px-3 py-2 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
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

          {/* Run with Agent */}
          <div className="space-y-2">
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

            {supportsModelSelection(runAgentType) && (
              <Select
                value={runModel}
                onChange={(e) => onRunModelChange(e.target.value)}
                variant="sm"
                disabled={isAssigning || !!agentSession}
                className="w-full bg-background text-xs py-1.5"
              >
                {getModelsForAgentType(runAgentType).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}

            <button
              onClick={onAssignToAgent}
              disabled={isAssigning || !!agentSession || (availableTypes ? !availableTypes.includes(runAgentType) : false)}
              className="w-full px-3 py-2 rounded text-xs font-vcr border border-accent/50 text-accent cursor-pointer hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Assign this task to an AI agent"
            >
              {isAssigning ? 'Assigning...' : 'Run'}
            </button>
          </div>
        </div>

        {/* Task Sessions */}
        {taskSessions && (
          <div className="space-y-3">
            <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
              Related Sessions
            </h3>
            <TaskSessions
              planning={taskSessions.grouped.planning}
              review={taskSessions.grouped.review}
              verify={taskSessions.grouped.verify}
              execution={taskSessions.grouped.execution}
              rewrite={taskSessions.grouped.rewrite}
              comment={taskSessions.grouped.comment}
            />
          </div>
        )}

        {/* Delete Button */}
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
  )
}
