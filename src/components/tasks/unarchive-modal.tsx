/**
 * Unarchive Modal Component
 * Modal for unarchiving a task with a user message and context gathering
 */

import { useState } from 'react'
import { X, PlayCircle } from 'lucide-react'
import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'

interface UnarchiveModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (message: string, agentType: AgentType, model: string) => void
  taskTitle: string
  availableAgentTypes: PlannerAgentType[]
  defaultAgentType: AgentType
  defaultModel: string
  isSubmitting?: boolean
}

export function UnarchiveModal({
  open,
  onClose,
  onSubmit,
  taskTitle,
  availableAgentTypes,
  defaultAgentType,
  defaultModel,
  isSubmitting = false,
}: UnarchiveModalProps) {
  const [message, setMessage] = useState('')
  const [agentType, setAgentType] = useState<AgentType>(defaultAgentType)
  const [model, setModel] = useState(defaultModel)

  const handleSubmit = () => {
    if (!message.trim()) return
    onSubmit(message.trim(), agentType, model)
  }

  const handleClose = () => {
    if (isSubmitting) return
    setMessage('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">Unarchive with Agent</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Resume work on: {taskTitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-accent/10 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Provide context or instructions for the agent
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                The agent will receive this message along with the task content and previous session outputs.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g., 'The previous fix didn't work. The issue is still happening when...' or 'Please investigate why the test is still failing...'"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
                rows={6}
                disabled={isSubmitting}
              />
            </div>

            {/* Agent Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Agent Type
                </label>
                <select
                  value={agentType}
                  onChange={(e) => {
                    const newAgentType = e.target.value as AgentType
                    setAgentType(newAgentType)
                    // TODO: Update model to default for new agent type
                  }}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                >
                  {availableAgentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle className="w-4 h-4" />
            {isSubmitting ? 'Unarchiving...' : 'Unarchive & Resume'}
          </button>
        </div>
      </div>
    </div>
  )
}
