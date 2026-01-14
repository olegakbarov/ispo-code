/**
 * Modal for creating new tasks
 */

import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { agentTypeLabel, type PlannerAgentType } from './agent-config'
import type { AgentType } from '@/lib/agent/types'

interface CreateTaskModalProps {
  isOpen: boolean
  isCreating: boolean
  newTitle: string
  useAgent: boolean
  createAgentType: PlannerAgentType
  availableTypes: AgentType[] | undefined
  availablePlannerTypes: PlannerAgentType[]
  onClose: () => void
  onCreate: () => void
  onTitleChange: (title: string) => void
  onUseAgentChange: (useAgent: boolean) => void
  onAgentTypeChange: (agentType: PlannerAgentType) => void
}

export function CreateTaskModal({
  isOpen,
  isCreating,
  newTitle,
  useAgent,
  createAgentType,
  availableTypes,
  availablePlannerTypes,
  onClose,
  onCreate,
  onTitleChange,
  onUseAgentChange,
  onAgentTypeChange,
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

          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              checked={useAgent}
              onChange={() => onUseAgentChange(!useAgent)}
              disabled={isCreating || (!canUseAgent && !useAgent)}
            />
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              Use AI to create detailed task plan
            </span>
          </label>

          {useAgent && canUseAgent && (
            <div>
              <div className="font-vcr text-xs text-text-muted mb-2">Agent Type</div>
              <Select
                value={createAgentType}
                onChange={(e) => onAgentTypeChange(e.target.value as PlannerAgentType)}
                variant="sm"
                disabled={isCreating}
                className="bg-background"
              >
                {availablePlannerTypes.map((t) => (
                  <option key={t} value={t} disabled={availableTypes ? !availableTypes.includes(t) : false}>
                    {agentTypeLabel[t]}
                  </option>
                ))}
              </Select>
            </div>
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
            disabled={isCreating || !newTitle.trim() || (useAgent && !canUseAgent)}
            className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
