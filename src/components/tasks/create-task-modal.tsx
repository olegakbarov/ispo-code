/**
 * Modal for creating new tasks - cmdk-style command palette aesthetic
 */

import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'
import type { DebugAgentSelection } from '@/lib/stores/tasks-reducer'
import { CreateTaskForm, type TaskType } from './create-task-form'
import { Spinner } from '@/components/ui/spinner'

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
  /** Include clarifying questions in AI planning */
  includeQuestions: boolean
  /** Implementation agent type (for !useAgent create) */
  runAgentType: AgentType
  /** Implementation model (for !useAgent create) */
  runModel: string
  onClose: () => void
  onCreate: () => void
  onTitleChange: (title: string) => void
  onTaskTypeChange: (taskType: TaskType) => void
  onUseAgentChange: (useAgent: boolean) => void
  onAgentTypeChange: (agentType: PlannerAgentType) => void
  onModelChange: (model: string) => void
  onAutoRunChange: (autoRun: boolean) => void
  onIncludeQuestionsChange: (includeQuestions: boolean) => void
  onToggleDebugAgent: (agentType: PlannerAgentType) => void
  onDebugAgentModelChange: (agentType: PlannerAgentType, model: string) => void
  onRunAgentTypeChange: (agentType: AgentType) => void
  onRunModelChange: (model: string) => void
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
  includeQuestions,
  runAgentType,
  runModel,
  onClose,
  onCreate,
  onTitleChange,
  onTaskTypeChange,
  onUseAgentChange,
  onAgentTypeChange,
  onModelChange,
  onAutoRunChange,
  onIncludeQuestionsChange,
  onToggleDebugAgent,
  onDebugAgentModelChange,
  onRunAgentTypeChange,
  onRunModelChange,
}: CreateTaskModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isCreating, onClose])

  if (!isOpen) return null

  const canCreate =
    newTitle.trim().length > 0 &&
    (!useAgent || availablePlannerTypes.length > 0) &&
    (!useAgent || taskType !== 'bug' || debugAgents.some((da) => da.selected))

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isCreating && onClose()}
      />

      {/* Floating container - positioned at top like cmdk */}
      <div className="fixed left-1/2 top-[12%] -translate-x-1/2 w-full max-w-[768px] px-6">
        <div className="relative z-50 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden">
          {/* Header - cmdk style with icon */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-border/50">
            <Plus className="w-6 h-6 text-accent shrink-0" />
            <span className="flex-1 text-base font-vcr text-foreground">New Task</span>
            <kbd className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-border/30 rounded font-vcr text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Form content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
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
              includeQuestions={includeQuestions}
              runAgentType={runAgentType}
              runModel={runModel}
              onCreate={onCreate}
              onTitleChange={onTitleChange}
              onTaskTypeChange={onTaskTypeChange}
              onUseAgentChange={onUseAgentChange}
              onAgentTypeChange={onAgentTypeChange}
              onModelChange={onModelChange}
              onAutoRunChange={onAutoRunChange}
              onIncludeQuestionsChange={onIncludeQuestionsChange}
              onToggleDebugAgent={onToggleDebugAgent}
              onDebugAgentModelChange={onDebugAgentModelChange}
              onRunAgentTypeChange={onRunAgentTypeChange}
              onRunModelChange={onRunModelChange}
              onCancel={onClose}
              autoFocus={true}
            />
          </div>

          {/* Footer - integrated action bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-background/30">
            <div className="flex items-center gap-3 text-xs text-muted-foreground/60 font-vcr">
              <kbd className="px-2 py-1 bg-border/30 rounded">⌘↵</kbd>
              <span>to create</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isCreating}
                className="px-4 py-2 rounded text-sm font-vcr text-muted-foreground hover:text-foreground hover:bg-accent/10 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                disabled={isCreating || !canCreate}
                className="flex items-center gap-3 px-4 py-2 rounded text-sm font-vcr bg-accent text-accent-foreground cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isCreating && <Spinner size="sm" />}
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
