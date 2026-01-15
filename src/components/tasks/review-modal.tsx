/**
 * Modal for configuring task review/verification
 * Collects agent type, model, and optional instructions before spawning a new session
 */

import { useState, useEffect } from 'react'
import { Select } from '@/components/ui/select'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType, getDefaultModelId } from './agent-config'
import type { AgentType } from '@/lib/agent/types'

type ReviewMode = 'review' | 'verify'

interface ReviewModalProps {
  isOpen: boolean
  mode: ReviewMode
  taskTitle: string
  agentType: AgentType
  model: string
  availableTypes: AgentType[] | undefined
  onClose: () => void
  onStart: (agentType: AgentType, model: string | undefined, instructions?: string) => Promise<void>
}

export function ReviewModal({
  isOpen,
  mode,
  taskTitle,
  agentType: initialAgentType,
  model: initialModel,
  availableTypes,
  onClose,
  onStart,
}: ReviewModalProps) {
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>(initialAgentType)
  const [selectedModel, setSelectedModel] = useState(initialModel)
  const [customInstructions, setCustomInstructions] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgentType(initialAgentType)
      setSelectedModel(initialModel)
      setCustomInstructions('')
      setIsStarting(false)
    }
  }, [isOpen, initialAgentType, initialModel])

  // Reset model when agent type changes
  const handleAgentTypeChange = (newType: AgentType) => {
    setSelectedAgentType(newType)
    setSelectedModel(getDefaultModelId(newType))
  }

  const title = mode === 'review' ? 'Review Task Spec' : 'Verify Task Completion'
  const description = mode === 'review'
    ? 'Review the quality of this task specification (clarity, completeness, actionability)'
    : 'Verify that completed items are actually done by checking the codebase'

  const handleStart = async () => {
    setIsStarting(true)
    try {
      await onStart(selectedAgentType, selectedModel || undefined, customInstructions.trim() || undefined)
      onClose()
    } catch (err) {
      console.error('Failed to start review/verify:', err)
    } finally {
      setIsStarting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl bg-panel border border-border rounded shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
          <div>
            <div className="font-vcr text-sm text-accent">{title}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{taskTitle}</div>
          </div>
          <button
            onClick={onClose}
            disabled={isStarting}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="text-xs text-text-secondary">{description}</div>

          <div>
            <div className="font-vcr text-xs text-text-muted mb-2">Agent Type</div>
            <Select
              value={selectedAgentType}
              onChange={(e) => handleAgentTypeChange(e.target.value as AgentType)}
              variant="sm"
              className="bg-background"
              disabled={isStarting}
            >
              {(Object.keys(agentTypeLabel) as AgentType[]).map((t) => (
                <option key={t} value={t} disabled={availableTypes ? !availableTypes.includes(t) : false}>
                  {agentTypeLabel[t]}
                </option>
              ))}
            </Select>
          </div>

          {supportsModelSelection(selectedAgentType) && (
            <div>
              <div className="font-vcr text-xs text-text-muted mb-2">Model</div>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                variant="sm"
                className="bg-background"
                disabled={isStarting}
              >
                {getModelsForAgentType(selectedAgentType).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}{m.description ? ` - ${m.description}` : ''}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <div className="font-vcr text-xs text-text-muted mb-2">
              Custom Instructions <span className="text-text-muted/50">(optional)</span>
            </div>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Pay special attention to error handling..."
              className="w-full h-24 p-2 bg-background text-xs text-text-primary font-mono border border-border rounded outline-none resize-none focus:border-accent/50 transition-colors"
              spellCheck={false}
              disabled={isStarting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-border shrink-0">
          <button
            onClick={onClose}
            disabled={isStarting}
            className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={isStarting || (availableTypes ? !availableTypes.includes(selectedAgentType) : false)}
            className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? 'Starting...' : `Start ${mode === 'review' ? 'Review' : 'Verification'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
