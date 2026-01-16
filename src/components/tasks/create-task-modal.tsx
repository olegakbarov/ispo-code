/**
 * Modal for creating new tasks
 */

import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'
import type { DebugAgentSelection } from '@/lib/stores/tasks-reducer'
import { CreateTaskForm, CreateTaskActions, type TaskType } from './create-task-form'

// Re-export for backward compatibility
export { ALL_PLANNER_CANDIDATES, type TaskType } from './create-task-form'

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
  /** Auto-run phases: planning→impl→verify */
  autoRun: boolean
  onClose: () => void
  onCreate: () => void
  onTitleChange: (title: string) => void
  onTaskTypeChange: (taskType: TaskType) => void
  onUseAgentChange: (useAgent: boolean) => void
  onAgentTypeChange: (agentType: PlannerAgentType) => void
  onModelChange: (model: string) => void
  onAutoRunChange: (autoRun: boolean) => void
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
  autoRun,
  onClose,
  onCreate,
  onTitleChange,
  onTaskTypeChange,
  onUseAgentChange,
  onAgentTypeChange,
  onModelChange,
  onAutoRunChange,
  onToggleDebugAgent,
  onDebugAgentModelChange,
}: CreateTaskModalProps) {
  if (!isOpen) return null

  const canCreate =
    newTitle.trim().length > 0 &&
    (!useAgent || availablePlannerTypes.length > 0) &&
    (!useAgent || taskType !== 'bug' || debugAgents.some((da) => da.selected))

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

        <div className="p-4">
          <CreateTaskForm
            isCreating={isCreating}
            newTitle={newTitle}
            taskType={taskType}
            useAgent={useAgent}
            createAgentType={createAgentType}
            createModel={createModel}
            availableTypes={availableTypes}
            availablePlannerTypes={availablePlannerTypes}
            debugAgents={debugAgents}
            autoRun={autoRun}
            onCreate={onCreate}
            onTitleChange={onTitleChange}
            onTaskTypeChange={onTaskTypeChange}
            onUseAgentChange={onUseAgentChange}
            onAgentTypeChange={onAgentTypeChange}
            onModelChange={onModelChange}
            onAutoRunChange={onAutoRunChange}
            onToggleDebugAgent={onToggleDebugAgent}
            onDebugAgentModelChange={onDebugAgentModelChange}
            onCancel={onClose}
            autoFocus={true}
          />
        </div>

        <div className="p-3 border-t border-border">
          <CreateTaskActions
            isCreating={isCreating}
            canCreate={canCreate}
            onCreate={onCreate}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
