/**
 * Modal for creating new tasks
 */

import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType, type PlannerAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import type { DebugAgentSelection } from '@/lib/stores/tasks-reducer'

export type TaskType = 'bug' | 'feature'

/** All planner agent type candidates (shown in UI, some may be unavailable) */
export const ALL_PLANNER_CANDIDATES: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'mcporter']

interface CreateTaskModalProps {
  isOpen: boolean
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
  onClose: () => void
  onCreate: () => void
  onTitleChange: (title: string) => void
  onTaskTypeChange: (taskType: TaskType) => void
  onUseAgentChange: (useAgent: boolean) => void
  onAgentTypeChange: (agentType: PlannerAgentType) => void
  onModelChange: (model: string) => void
  onToggleDebugAgent: (agentType: PlannerAgentType) => void
  onDebugAgentModelChange: (agentType: PlannerAgentType, model: string) => void
}

export function CreateTaskModal({
  isOpen,
  isCreating,
  newTitle,
  taskType,
  useAgent,
  createAgentType,
  createModel,
  availableTypes,
  availablePlannerTypes,
  debugAgents,
  onClose,
  onCreate,
  onTitleChange,
  onTaskTypeChange,
  onUseAgentChange,
  onAgentTypeChange,
  onModelChange,
  onToggleDebugAgent,
  onDebugAgentModelChange,
}: CreateTaskModalProps) {
  if (!isOpen) return null
  const canUseAgent = availablePlannerTypes.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md bg-panel border border-border rounded shadow-lg">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="font-vcr text-sm text-accent">New Task</div>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="font-vcr text-xs text-text-muted mb-2">What do you want to accomplish?</div>
            <Input
              value={newTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g. Add dark mode toggle to settings"
              variant="sm"
              className="bg-background"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) onCreate()
                if (e.key === 'Escape') onClose()
              }}
            />
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

        <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={
              isCreating ||
              !newTitle.trim() ||
              (useAgent && !canUseAgent) ||
              (useAgent && taskType === 'bug' && !debugAgents.some((da) => da.selected))
            }
            className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
