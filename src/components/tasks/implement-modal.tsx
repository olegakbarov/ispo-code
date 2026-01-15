/**
 * Modal for configuring task implementation
 * Collects agent type, model, and optional instructions before spawning implementation session
 */

import { useState, useEffect } from 'react'
import { Play, Terminal, Cpu, Sparkles, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supportsModelSelection, getModelsForAgentType, getDefaultModelId } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'

interface ImplementModalProps {
  isOpen: boolean
  taskTitle: string
  agentType: AgentType
  model: string
  availableTypes: AgentType[] | undefined
  onClose: () => void
  onStart: (agentType: AgentType, model: string | undefined, instructions?: string) => Promise<void>
}

// Agent configuration with icons and descriptions
const AGENT_CONFIG: Record<AgentType, { icon: typeof Terminal; label: string; desc: string }> = {
  claude: { icon: Sparkles, label: 'Claude', desc: 'Anthropic CLI agent' },
  codex: { icon: Terminal, label: 'Codex', desc: 'OpenAI CLI agent' },
  cerebras: { icon: Cpu, label: 'Cerebras', desc: 'Fast inference SDK' },
  opencode: { icon: Terminal, label: 'OpenCode', desc: 'Open source agent' },
  gemini: { icon: Sparkles, label: 'Gemini', desc: 'Google AI agent' },
  mcporter: { icon: Terminal, label: 'MCPorter', desc: 'MCP testing agent' },
}

export function ImplementModal({
  isOpen,
  taskTitle,
  agentType: initialAgentType,
  model: initialModel,
  availableTypes,
  onClose,
  onStart,
}: ImplementModalProps) {
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>(initialAgentType)
  const [selectedModel, setSelectedModel] = useState(initialModel)
  const [customInstructions, setCustomInstructions] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgentType(initialAgentType)
      setSelectedModel(initialModel)
      setCustomInstructions('')
      setIsStarting(false)
      setShowModelDropdown(false)
    }
  }, [isOpen, initialAgentType, initialModel])

  // Reset model when agent type changes
  const handleAgentTypeChange = (newType: AgentType) => {
    setSelectedAgentType(newType)
    setSelectedModel(getDefaultModelId(newType))
  }

  const handleStart = async () => {
    setIsStarting(true)
    try {
      await onStart(selectedAgentType, selectedModel || undefined, customInstructions.trim() || undefined)
      onClose()
    } catch (err) {
      console.error('Failed to start implementation:', err)
    } finally {
      setIsStarting(false)
    }
  }

  if (!isOpen) return null

  const config = AGENT_CONFIG[selectedAgentType]
  const Icon = config?.icon ?? Terminal
  const isAgentAvailable = (type: AgentType) => availableTypes?.includes(type) ?? true
  const models = supportsModelSelection(selectedAgentType) ? getModelsForAgentType(selectedAgentType) : []
  const selectedModelLabel = models.find(m => m.value === selectedModel)?.label ?? selectedModel

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-lg bg-card border border-border/50 rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="implement-modal-title"
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            disabled={isStarting}
            className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 id="implement-modal-title" className="font-semibold text-foreground">
                Start Implementation
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-[280px] truncate">
                {taskTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-4">
          {/* Agent Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Agent
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['claude', 'codex', 'cerebras'] as AgentType[]).map((type) => {
                const cfg = AGENT_CONFIG[type]
                const AgentIcon = cfg.icon
                const available = isAgentAvailable(type)
                const selected = selectedAgentType === type

                return (
                  <button
                    key={type}
                    onClick={() => available && handleAgentTypeChange(type)}
                    disabled={!available || isStarting}
                    className={`
                      relative p-3 rounded-lg border text-left transition-all
                      ${selected
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                        : 'border-border/50 hover:border-border hover:bg-secondary/30'
                      }
                      ${!available ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      disabled:cursor-not-allowed
                    `}
                  >
                    <AgentIcon className={`w-4 h-4 mb-1.5 ${selected ? 'text-accent' : 'text-muted-foreground'}`} />
                    <div className={`text-xs font-medium ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {cfg.label}
                    </div>
                    {selected && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* More agents dropdown */}
            <Select
              value={selectedAgentType}
              onChange={(e) => handleAgentTypeChange(e.target.value as AgentType)}
              variant="sm"
              className="mt-2 bg-background text-xs"
              disabled={isStarting}
            >
              {(Object.keys(AGENT_CONFIG) as AgentType[]).map((type) => (
                <option key={type} value={type} disabled={!isAgentAvailable(type)}>
                  {AGENT_CONFIG[type].label} — {AGENT_CONFIG[type].desc}
                </option>
              ))}
            </Select>
          </div>

          {/* Model Selector */}
          {models.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Model
              </label>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                disabled={isStarting}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-background hover:border-border text-xs transition-colors disabled:opacity-50"
              >
                <span className="text-foreground">{selectedModelLabel}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showModelDropdown && (
                <div className="mt-1 p-1 rounded-lg border border-border/50 bg-card shadow-lg max-h-48 overflow-y-auto">
                  {models.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        setSelectedModel(m.value)
                        setShowModelDropdown(false)
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded text-xs transition-colors
                        ${selectedModel === m.value
                          ? 'bg-accent/10 text-accent'
                          : 'text-foreground hover:bg-secondary/50'
                        }
                      `}
                    >
                      <div className="font-medium">{m.label}</div>
                      {m.description && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{m.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom Instructions */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Instructions <span className="text-muted-foreground/50 font-normal">(optional)</span>
            </label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Add context or constraints for this implementation..."
              variant="sm"
              className="h-20 bg-background rounded-lg"
              spellCheck={false}
              disabled={isStarting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border/30 bg-secondary/20">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Icon className="w-3.5 h-3.5" />
            <span>{config?.desc ?? 'AI agent'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isStarting}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleStart}
              disabled={isStarting || !isAgentAvailable(selectedAgentType)}
              className="min-w-[100px]"
            >
              {isStarting ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  Implement
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
