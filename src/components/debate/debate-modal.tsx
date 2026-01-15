/**
 * Debate Modal Component
 * Multi-model adversarial spec review interface
 */

import { useState, useCallback } from 'react'
import { Select } from '@/components/ui/select'
import { RoundCard } from './round-card'
import type { DebateSession, DebateConfig, DebatePersona } from '@/lib/debate/types'
import { DEFAULT_DEBATE_CONFIG, PERSONA_LABELS, PERSONA_DESCRIPTIONS } from '@/lib/debate/types'
import { agentTypeLabel, getModelsForAgentType, getDefaultModelId, supportsModelSelection } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import { trpc } from '@/lib/trpc-client'

interface DebateModalProps {
  isOpen: boolean
  taskPath: string
  taskTitle: string
  availableTypes: AgentType[] | undefined
  onClose: () => void
  onAccept: () => void
}

type DebateStep = 'config' | 'running' | 'complete'

const ALL_PERSONAS: DebatePersona[] = ['security', 'oncall', 'pm', 'performance', 'qa']

export function DebateModal({
  isOpen,
  taskPath,
  taskTitle,
  availableTypes,
  onClose,
  onAccept,
}: DebateModalProps) {
  const [step, setStep] = useState<DebateStep>('config')
  const [debateId, setDebateId] = useState<string | null>(null)
  const [session, setSession] = useState<DebateSession | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Config state
  const [selectedPersonas, setSelectedPersonas] = useState<DebatePersona[]>(
    DEFAULT_DEBATE_CONFIG.agents.map(a => a.persona)
  )
  const [agentType, setAgentType] = useState<AgentType>(DEFAULT_DEBATE_CONFIG.agents[0].agentType)
  const [model, setModel] = useState(getDefaultModelId(agentType))
  const [maxRounds, setMaxRounds] = useState(DEFAULT_DEBATE_CONFIG.maxRounds)

  // tRPC mutations
  const startMutation = trpc.debate.start.useMutation()
  const nextRoundMutation = trpc.debate.nextRound.useMutation()
  const acceptSpecMutation = trpc.debate.acceptSpec.useMutation()
  const discardMutation = trpc.debate.discard.useMutation()

  const handleAgentTypeChange = useCallback((newType: AgentType) => {
    setAgentType(newType)
    setModel(getDefaultModelId(newType))
  }, [])

  const togglePersona = useCallback((persona: DebatePersona) => {
    setSelectedPersonas(prev => {
      if (prev.includes(persona)) {
        // Don't allow removing if only 1 left
        if (prev.length <= 1) return prev
        return prev.filter(p => p !== persona)
      }
      // Don't allow more than 5
      if (prev.length >= 5) return prev
      return [...prev, persona]
    })
  }, [])

  const startDebate = useCallback(async () => {
    setError(null)
    setIsRunning(true)

    try {
      const config: DebateConfig = {
        agents: selectedPersonas.map(persona => ({
          agentType,
          model,
          persona,
        })),
        maxRounds,
        consensusThreshold: DEFAULT_DEBATE_CONFIG.consensusThreshold,
        autoSynthesize: true,
        synthesisAgent: { agentType, model },
      }

      const result = await startMutation.mutateAsync({ path: taskPath, config })
      setDebateId(result.debateId)
      setSession(result.session)
      setStep('running')

      // Start running rounds
      await runAllRounds(result.debateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start debate')
      setIsRunning(false)
    }
  }, [taskPath, selectedPersonas, agentType, model, maxRounds, startMutation])

  const runAllRounds = useCallback(async (id: string) => {
    try {
      let continueRunning = true

      while (continueRunning) {
        const result = await nextRoundMutation.mutateAsync({ debateId: id })
        setSession(result.session)

        if (!result.round || result.session.consensusReached || result.session.rounds.length >= maxRounds) {
          continueRunning = false
        }
      }

      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error during debate')
    } finally {
      setIsRunning(false)
    }
  }, [nextRoundMutation, maxRounds])

  const handleAccept = useCallback(async () => {
    if (!debateId) return
    setError(null)

    try {
      await acceptSpecMutation.mutateAsync({ debateId })
      onAccept()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save spec')
    }
  }, [debateId, acceptSpecMutation, onAccept])

  const handleClose = useCallback(() => {
    // Discard if we have an active debate
    if (debateId) {
      discardMutation.mutate({ debateId })
    }

    // Reset state
    setStep('config')
    setDebateId(null)
    setSession(null)
    setError(null)
    setIsRunning(false)

    onClose()
  }, [debateId, discardMutation, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-panel border border-border rounded shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
          <div>
            <div className="font-vcr text-sm text-accent">Multi-Model Spec Review</div>
            <div className="text-[10px] text-text-muted mt-0.5">{taskTitle}</div>
          </div>
          <button
            onClick={handleClose}
            disabled={isRunning}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {step === 'config' && (
            <ConfigStep
              selectedPersonas={selectedPersonas}
              agentType={agentType}
              model={model}
              maxRounds={maxRounds}
              availableTypes={availableTypes}
              onTogglePersona={togglePersona}
              onAgentTypeChange={handleAgentTypeChange}
              onModelChange={setModel}
              onMaxRoundsChange={setMaxRounds}
            />
          )}

          {(step === 'running' || step === 'complete') && session && (
            <DebateProgress session={session} isRunning={isRunning} />
          )}

          {error && (
            <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded text-xs text-error">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-3 border-t border-border shrink-0">
          <div className="text-[10px] text-text-muted">
            {step === 'config' && `${selectedPersonas.length} personas selected`}
            {step === 'running' && `Round ${session?.rounds.length ?? 0}/${maxRounds}`}
            {step === 'complete' && (session?.consensusReached ? 'Consensus reached' : 'Max rounds reached')}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={isRunning}
              className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'complete' ? 'Discard' : 'Cancel'}
            </button>

            {step === 'config' && (
              <button
                onClick={startDebate}
                disabled={selectedPersonas.length === 0 || (availableTypes && !availableTypes.includes(agentType))}
                className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Debate
              </button>
            )}

            {step === 'complete' && (
              <button
                onClick={handleAccept}
                className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90"
              >
                Accept Refined Spec
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ConfigStepProps {
  selectedPersonas: DebatePersona[]
  agentType: AgentType
  model: string
  maxRounds: number
  availableTypes: AgentType[] | undefined
  onTogglePersona: (persona: DebatePersona) => void
  onAgentTypeChange: (type: AgentType) => void
  onModelChange: (model: string) => void
  onMaxRoundsChange: (rounds: number) => void
}

function ConfigStep({
  selectedPersonas,
  agentType,
  model,
  maxRounds,
  availableTypes,
  onTogglePersona,
  onAgentTypeChange,
  onModelChange,
  onMaxRoundsChange,
}: ConfigStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-xs text-text-secondary">
        Configure a multi-model debate to review your spec from multiple perspectives.
        Multiple agents will critique the spec in parallel, then synthesize feedback into an improved version.
      </div>

      {/* Persona Selection */}
      <div>
        <div className="font-vcr text-xs text-text-muted mb-3">Select Perspectives (1-5)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_PERSONAS.map(persona => (
            <button
              key={persona}
              onClick={() => onTogglePersona(persona)}
              className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                selectedPersonas.includes(persona)
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-border/80 hover:bg-panel-hover'
              }`}
            >
              <div className="font-vcr text-xs text-accent mb-1">{PERSONA_LABELS[persona]}</div>
              <div className="text-[10px] text-text-muted">{PERSONA_DESCRIPTIONS[persona]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-vcr text-xs text-text-muted mb-2">Agent Type</div>
          <Select
            value={agentType}
            onChange={(e) => onAgentTypeChange(e.target.value as AgentType)}
            variant="sm"
            className="bg-background"
          >
            {(Object.keys(agentTypeLabel) as AgentType[]).map((t) => (
              <option key={t} value={t} disabled={availableTypes ? !availableTypes.includes(t) : false}>
                {agentTypeLabel[t]}
              </option>
            ))}
          </Select>
        </div>

        {supportsModelSelection(agentType) && (
          <div>
            <div className="font-vcr text-xs text-text-muted mb-2">Model</div>
            <Select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              variant="sm"
              className="bg-background"
            >
              {getModelsForAgentType(agentType).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Max Rounds */}
      <div>
        <div className="font-vcr text-xs text-text-muted mb-2">Max Rounds</div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onMaxRoundsChange(n)}
              className={`w-8 h-8 rounded border text-xs font-vcr cursor-pointer transition-colors ${
                maxRounds === n
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border hover:border-accent/50 text-text-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-text-muted mt-1">
          Debate continues until consensus or max rounds reached
        </div>
      </div>
    </div>
  )
}

interface DebateProgressProps {
  session: DebateSession
  isRunning: boolean
}

function DebateProgress({ session, isRunning }: DebateProgressProps) {
  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {isRunning && (
        <div className="p-3 bg-accent/10 border border-accent/30 rounded flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-accent font-vcr">
            Running round {session.rounds.length + 1}...
          </span>
        </div>
      )}

      {/* Rounds */}
      <div className="space-y-3">
        {session.rounds.map((round, i) => (
          <RoundCard
            key={round.roundNumber}
            round={round}
            isLatest={i === session.rounds.length - 1}
          />
        ))}
      </div>

      {/* Final Status */}
      {session.status === 'completed' && (
        <div className={`p-3 rounded border ${
          session.consensusReached
            ? 'bg-success/10 border-success/30 text-success'
            : 'bg-warning/10 border-warning/30 text-warning'
        }`}>
          <div className="font-vcr text-xs mb-1">
            {session.consensusReached ? 'Consensus Reached' : 'Max Rounds Reached'}
          </div>
          <div className="text-xs opacity-80">
            {session.consensusReached
              ? 'All reviewers approve the refined specification.'
              : 'Consider reviewing remaining issues before accepting.'}
          </div>
        </div>
      )}
    </div>
  )
}
