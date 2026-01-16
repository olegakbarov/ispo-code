/**
 * Shared form content for creating new tasks
 * Used by both CreateTaskModal and inline form on tasks index
 */

import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType, type PlannerAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import type { DebugAgentSelection } from '@/lib/stores/tasks-reducer'

export type TaskType = 'bug' | 'feature'

/** All planner agent type candidates (shown in UI, some may be unavailable) */
export const ALL_PLANNER_CANDIDATES: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'mcporter']

export interface CreateTaskFormProps {
  isCreating: boolean
  newTitle: string
  taskType: TaskType
  useAgent: boolean
  createAgentType: PlannerAgentType
  createModel: string
  availableTypes: AgentType[] | undefined
  availablePlannerTypes: PlannerAgentType[]
  /** Debug agent selections for multi-agent debugging (bug type only) */
  debugAgents: DebugAgentSelection[]
  /** Auto-run phases: planning→impl→verify */
  autoRun: boolean
  onCreate: () => void
  onTitleChange: (title: string) => void
  onTaskTypeChange: (taskType: TaskType) => void
  onUseAgentChange: (useAgent: boolean) => void
  onAgentTypeChange: (agentType: PlannerAgentType) => void
  onModelChange: (model: string) => void
  onAutoRunChange: (autoRun: boolean) => void
  onToggleDebugAgent: (agentType: PlannerAgentType) => void
  onDebugAgentModelChange: (agentType: PlannerAgentType, model: string) => void
  /** Optional: called on Escape key (only used in modal context) */
  onCancel?: () => void
  /** Whether to auto-focus the title input */
  autoFocus?: boolean
}

export function CreateTaskForm({
  isCreating,
  newTitle,
  taskType,
  useAgent,
  createAgentType,
  createModel,
  availablePlannerTypes,
  debugAgents,
  autoRun,
  onCreate,
  onTitleChange,
  onTaskTypeChange,
  onUseAgentChange,
  onAgentTypeChange,
  onModelChange,
  onAutoRunChange,
  onToggleDebugAgent,
  onDebugAgentModelChange,
  onCancel,
  autoFocus = true,
}: CreateTaskFormProps) {
  const canUseAgent = availablePlannerTypes.length > 0

  return (
    <div className="space-y-4">
      <div>
        <div className="font-vcr text-xs text-text-muted mb-2">What do you want to accomplish?</div>
        <Textarea
          value={newTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Add dark mode toggle to settings"
          variant="sm"
          className="bg-background"
          rows={3}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter to submit, plain Enter for newline
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onCreate()
            }
            if (e.key === 'Escape' && onCancel) onCancel()
          }}
        />
        <div className="text-[10px] text-text-muted/60 mt-1">Press Cmd+Enter to create</div>
      </div>

      <div>
        <div className="font-vcr text-xs text-text-muted mb-2">Task Type</div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="taskType"
              value="feature"
              checked={taskType === 'feature'}
              onChange={() => onTaskTypeChange('feature')}
              disabled={isCreating}
              className="w-3 h-3 text-accent cursor-pointer"
            />
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              Feature
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="taskType"
              value="bug"
              checked={taskType === 'bug'}
              onChange={() => onTaskTypeChange('bug')}
              disabled={isCreating}
              className="w-3 h-3 text-accent cursor-pointer"
            />
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              Bug
            </span>
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer group">
        <Checkbox
          checked={useAgent}
          onChange={() => onUseAgentChange(!useAgent)}
          disabled={isCreating || (!canUseAgent && !useAgent)}
        />
        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
          {taskType === 'bug' ? 'Debug with AI' : 'Plan with AI'}
        </span>
      </label>

      {useAgent && canUseAgent && (
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={autoRun}
            onChange={() => onAutoRunChange(!autoRun)}
            disabled={isCreating}
          />
          <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
            Auto-run phases
          </span>
          <span className="text-[10px] text-text-muted/60">
            (planning→impl→verify)
          </span>
        </label>
      )}

      {useAgent && canUseAgent && taskType === 'bug' && (
        /* Multi-agent selection for bug debugging */
        <div>
          <div className="font-vcr text-xs text-text-muted mb-2">
            Debug Agents
            <span className="text-text-muted/60 ml-1">(select 1+)</span>
          </div>
          <div className="space-y-2">
            {debugAgents.map((da) => {
              const isAvailable = availablePlannerTypes.includes(da.agentType)
              return (
                <div key={da.agentType} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer group min-w-[120px]">
                    <Checkbox
                      checked={da.selected}
                      onChange={() => onToggleDebugAgent(da.agentType)}
                      disabled={isCreating || !isAvailable}
                    />
                    <span className={`text-xs transition-colors ${
                      isAvailable
                        ? 'text-text-secondary group-hover:text-text-primary'
                        : 'text-text-muted/50'
                    }`}>
                      {agentTypeLabel[da.agentType]}
                      {!isAvailable && ' (N/A)'}
                    </span>
                  </label>
                  {da.selected && supportsModelSelection(da.agentType) && (
                    <Select
                      value={da.model}
                      onChange={(e) => onDebugAgentModelChange(da.agentType, e.target.value)}
                      variant="sm"
                      disabled={isCreating}
                      className="bg-background flex-1 text-xs"
                    >
                      {getModelsForAgentType(da.agentType).map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {useAgent && canUseAgent && taskType === 'feature' && (
        /* Single agent selection for feature planning */
        <>
          <div>
            <div className="font-vcr text-xs text-text-muted mb-2">Agent Type</div>
            <Select
              value={createAgentType}
              onChange={(e) => onAgentTypeChange(e.target.value as PlannerAgentType)}
              variant="sm"
              disabled={isCreating}
              className="bg-background"
            >
              {ALL_PLANNER_CANDIDATES.map((t) => {
                const isAvailable = availablePlannerTypes.includes(t)
                return (
                  <option key={t} value={t} disabled={!isAvailable}>
                    {agentTypeLabel[t]}{!isAvailable ? ' (Not available)' : ''}
                  </option>
                )
              })}
            </Select>
          </div>

          {supportsModelSelection(createAgentType) && (
            <div>
              <div className="font-vcr text-xs text-text-muted mb-2">Model</div>
              <Select
                value={createModel}
                onChange={(e) => onModelChange(e.target.value)}
                variant="sm"
                disabled={isCreating}
                className="bg-background"
              >
                {getModelsForAgentType(createAgentType).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}{m.description ? ` - ${m.description}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export interface CreateTaskActionsProps {
  isCreating: boolean
  canCreate: boolean
  onCreate: () => void
  onCancel?: () => void
}

export function CreateTaskActions({
  isCreating,
  canCreate,
  onCreate,
  onCancel,
}: CreateTaskActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={isCreating}
          className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      )}
      <button
        onClick={onCreate}
        disabled={isCreating || !canCreate}
        className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? 'Creating...' : 'Create'}
      </button>
    </div>
  )
}
