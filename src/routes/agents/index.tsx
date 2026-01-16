/**
 * Agents Index Route - Start a new agent session
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import type { AgentType } from '@/lib/agent/types'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { getModelsForAgentType, supportsModelSelection, getDefaultModelId } from '@/lib/agent/config'
import { trpc } from '@/lib/trpc-client'
import { useWorkingDirStore } from '@/lib/stores/working-dir'

export const Route = createFileRoute('/agents/')({
  component: NewAgentPage,
})

const agentLabels: Record<AgentType, { name: string; description: string }> = {
  claude: {
    name: 'Claude CLI',
    description: 'Anthropic Claude Code CLI',
  },
  codex: {
    name: 'Codex CLI',
    description: 'OpenAI Codex agent',
  },
  opencode: {
    name: 'OpenCode',
    description: 'Multi-provider agent',
  },
  cerebras: {
    name: 'Cerebras GLM',
    description: 'GLM 4.7 - 20x faster',
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Gemini 2.0 - 1M context',
  },
  mcporter: {
    name: 'QA Agent',
    description: 'MCP-powered QA tools',
  },
}

function NewAgentPage() {
  const [prompt, setPrompt, clearPromptDraft] = useTextareaDraft('new-agent-prompt')
  const [agentType, setAgentType] = useState<AgentType>('cerebras')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { selectedRepo } = useWorkingDirStore()

  // Fetch available agent types from server
  const { data: availableTypes = [] } = trpc.agent.availableTypes.useQuery()

  // Get models for current agent type
  const models = getModelsForAgentType(agentType)
  const hasModelSelection = supportsModelSelection(agentType)

  // Reset model when agent type changes
  useEffect(() => {
    setModel(getDefaultModelId(agentType))
  }, [agentType])

  // Spawn mutation
  const spawnMutation = trpc.agent.spawn.useMutation({
    onSuccess: (data) => {
      clearPromptDraft() // Clear draft after successful spawn
      navigate({ to: '/agents/$sessionId', params: { sessionId: data.sessionId } })
    },
    onError: (err) => {
      setError(err.message || 'Failed to spawn agent')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    if (!isAvailable(agentType)) return

    setError(null)
    spawnMutation.mutate({
      prompt: prompt.trim(),
      agentType,
      model: model || undefined,
      githubRepo: selectedRepo || undefined,
    })
  }

  const isAvailable = (type: AgentType) => availableTypes?.includes(type) ?? false
  const isSpawning = spawnMutation.isPending
  const canSubmit = prompt.trim().length > 0 && isAvailable(agentType) && !isSpawning

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="font-vcr text-lg text-accent">New Agent</h1>
        <p className="text-xs text-text-muted mt-1">Start a new coding agent session</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-4">
        {/* Agent Type Selection */}
        <div>
          <label className="block font-vcr text-xs text-text-muted mb-2">
            Agent Type
          </label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(agentLabels) as AgentType[]).map((type) => {
              const available = isAvailable(type)
              const selected = agentType === type
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!available}
                  onClick={() => setAgentType(type)}
                  className={`flex-1 min-w-[140px] p-3 rounded border cursor-pointer transition-colors ${
                    selected
                      ? 'border-accent bg-accent/10 text-accent'
                      : available
                        ? 'border-border bg-panel text-text-secondary hover:border-text-muted'
                        : 'border-border bg-panel/50 text-text-muted cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="font-vcr text-sm">{agentLabels[type].name}</div>
                  <div className="text-xs mt-1 opacity-70">{agentLabels[type].description}</div>
                  {!available && (
                    <div className="text-xs mt-1 text-error">
                      Not available
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Model Selection - shown for all agents with multiple models */}
        {hasModelSelection && (
          <div>
            <label className="block font-vcr text-xs text-text-muted mb-2">
              Model
            </label>
            <Select
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}{m.description ? ` - ${m.description}` : ''}
                </option>
              ))}
            </Select>
            {/* Custom model input for opencode */}
            {agentType === 'opencode' && (
              <>
                <p className="text-xs text-text-muted mt-1">
                  Or enter custom: provider/model (e.g., openai/gpt-4-turbo)
                </p>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Custom model (optional)"
                  className="mt-2"
                />
              </>
            )}
          </div>
        )}

        {/* Prompt Input */}
        <div className="flex-1 flex flex-col">
          <label className="block font-vcr text-xs text-text-muted mb-2">
            Prompt
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want the agent to do..."
            className="flex-1 min-h-32"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded text-sm text-error">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-accent text-background font-vcr text-sm rounded cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSpawning ? 'Starting...' : 'Start Agent'}
          </button>
        </div>
      </form>
    </div>
  )
}
