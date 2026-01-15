/**
 * Debate Orchestrator
 * Coordinates multi-model adversarial spec review
 */

import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import Cerebras from "@cerebras/cerebras_cloud_sdk"
import type { AgentType } from '../agent/types'
import type {
  DebateConfig,
  DebateSession,
  DebateRound,
  Critique,
  DebatePersona,
} from './types'
import { DEFAULT_DEBATE_CONFIG } from './types'
import { generateCritiquePrompt, parseCritiqueResponse, getPersonaSystemPrompt } from './personas'
import { generateSynthesisPrompt, checkConsensus, parseSynthesisResponse, generateChangesSummary } from './synthesis'

/**
 * Event types emitted by the orchestrator
 */
export interface DebateEvents {
  roundStart: (roundNumber: number) => void
  critiqueStart: (agentType: AgentType, persona: DebatePersona) => void
  critiqueComplete: (critique: Critique) => void
  roundComplete: (round: DebateRound) => void
  synthesisStart: () => void
  synthesisComplete: (refinedSpec: string) => void
  debateComplete: (session: DebateSession) => void
  error: (error: string) => void
}

/**
 * Query a single agent for a critique
 */
async function querySingleAgent(
  agentType: AgentType,
  model: string | undefined,
  persona: DebatePersona,
  spec: string
): Promise<Critique> {
  const startTime = Date.now()
  const systemPrompt = getPersonaSystemPrompt(persona)
  const userPrompt = generateCritiquePrompt(spec, persona)

  let rawResponse = ''

  try {
    if (agentType === 'gemini') {
      const googleModel = google(model ?? 'gemini-2.0-flash')
      const result = await generateText({
        model: googleModel,
        system: systemPrompt,
        prompt: userPrompt,
        maxRetries: 2,
      })
      rawResponse = result.text
    } else if (agentType === 'cerebras') {
      const apiKey = process.env.CEREBRAS_API_KEY
      if (!apiKey) {
        throw new Error('CEREBRAS_API_KEY not set')
      }
      const client = new Cerebras({ apiKey, maxRetries: 2 })
      const response = await client.chat.completions.create({
        model: model ?? 'llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 4096,
        temperature: 0.3, // Lower for more consistent critique format
      })
      const choices = response.choices as Array<{ message: { content: string | null } }>
      rawResponse = choices[0]?.message?.content ?? ''
    } else {
      throw new Error(`Agent type ${agentType} not supported for debate critique`)
    }

    const parsed = parseCritiqueResponse(rawResponse, persona)
    const durationMs = Date.now() - startTime

    return {
      agentType,
      model,
      persona,
      verdict: parsed.verdict ?? 'needs-changes',
      summary: parsed.summary ?? 'No summary',
      issues: parsed.issues ?? [],
      rawResponse,
      timestamp: new Date().toISOString(),
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    return {
      agentType,
      model,
      persona,
      verdict: 'needs-changes',
      summary: `Error: ${errorMsg}`,
      issues: [{
        severity: 'critical',
        title: 'Agent Error',
        description: `Failed to get critique from ${agentType}: ${errorMsg}`,
      }],
      rawResponse: errorMsg,
      timestamp: new Date().toISOString(),
      durationMs,
    }
  }
}

/**
 * Synthesize a refined spec from critiques
 */
async function synthesizeSpec(
  originalSpec: string,
  critiques: Critique[],
  agentType: AgentType,
  model?: string
): Promise<string> {
  const prompt = generateSynthesisPrompt(originalSpec, critiques)

  try {
    if (agentType === 'gemini') {
      const googleModel = google(model ?? 'gemini-2.0-flash')
      const result = await generateText({
        model: googleModel,
        system: 'You are a technical writer refining specifications based on expert feedback.',
        prompt,
        maxRetries: 2,
      })
      return parseSynthesisResponse(result.text)
    } else if (agentType === 'cerebras') {
      const apiKey = process.env.CEREBRAS_API_KEY
      if (!apiKey) {
        throw new Error('CEREBRAS_API_KEY not set')
      }
      const client = new Cerebras({ apiKey, maxRetries: 2 })
      const response = await client.chat.completions.create({
        model: model ?? 'llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: 'You are a technical writer refining specifications based on expert feedback.' },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 8192,
        temperature: 0.4,
      })
      const choices = response.choices as Array<{ message: { content: string | null } }>
      return parseSynthesisResponse(choices[0]?.message?.content ?? originalSpec)
    } else {
      throw new Error(`Agent type ${agentType} not supported for synthesis`)
    }
  } catch (err) {
    console.error('[synthesizeSpec] Error:', err)
    // Fall back to original spec on error
    return originalSpec
  }
}

/**
 * Generate a unique debate session ID
 */
function generateDebateId(): string {
  return `debate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * DebateOrchestrator Class
 * Manages the lifecycle of a multi-model debate session
 */
export class DebateOrchestrator {
  private session: DebateSession
  private eventHandlers: Map<keyof DebateEvents, Array<(...args: unknown[]) => void>> = new Map()
  private aborted = false

  constructor(
    taskPath: string,
    originalSpec: string,
    config: Partial<DebateConfig> = {}
  ) {
    const fullConfig: DebateConfig = { ...DEFAULT_DEBATE_CONFIG, ...config }

    this.session = {
      id: generateDebateId(),
      taskPath,
      originalSpec,
      currentSpec: originalSpec,
      config: fullConfig,
      rounds: [],
      status: 'idle',
      consensusReached: false,
      startedAt: new Date().toISOString(),
    }
  }

  /**
   * Register an event handler
   */
  on<K extends keyof DebateEvents>(event: K, handler: DebateEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler as (...args: unknown[]) => void)
  }

  /**
   * Emit an event
   */
  private emit<K extends keyof DebateEvents>(event: K, ...args: Parameters<DebateEvents[K]>): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args)
        } catch (err) {
          console.error(`[DebateOrchestrator] Error in ${event} handler:`, err)
        }
      }
    }
  }

  /**
   * Get current session state
   */
  getSession(): DebateSession {
    return { ...this.session }
  }

  /**
   * Run a single round of debate
   */
  async runRound(): Promise<DebateRound | null> {
    if (this.aborted) {
      return null
    }

    const roundNumber = this.session.rounds.length + 1
    this.emit('roundStart', roundNumber)

    const round: DebateRound = {
      roundNumber,
      specVersion: this.session.currentSpec,
      critiques: [],
      consensusReached: false,
      startedAt: new Date().toISOString(),
    }

    // Query all agents in parallel
    const critiquePromises = this.session.config.agents.map(async (agent) => {
      if (this.aborted) return null

      this.emit('critiqueStart', agent.agentType, agent.persona)

      const critique = await querySingleAgent(
        agent.agentType,
        agent.model,
        agent.persona,
        this.session.currentSpec
      )

      this.emit('critiqueComplete', critique)
      return critique
    })

    const critiques = await Promise.all(critiquePromises)
    round.critiques = critiques.filter((c): c is Critique => c !== null)

    // Check for consensus
    round.consensusReached = checkConsensus(
      round.critiques,
      this.session.config.consensusThreshold
    )

    // If no consensus and auto-synthesis is enabled, generate refined spec
    if (!round.consensusReached && this.session.config.autoSynthesize && !this.aborted) {
      this.emit('synthesisStart')

      const synthesisAgent = this.session.config.synthesisAgent ?? { agentType: 'gemini' as AgentType }
      const refinedSpec = await synthesizeSpec(
        this.session.currentSpec,
        round.critiques,
        synthesisAgent.agentType,
        synthesisAgent.model
      )

      round.refinedSpec = refinedSpec
      round.changesSummary = generateChangesSummary(round.critiques)
      this.session.currentSpec = refinedSpec

      this.emit('synthesisComplete', refinedSpec)
    }

    round.completedAt = new Date().toISOString()
    this.session.rounds.push(round)

    this.emit('roundComplete', round)
    return round
  }

  /**
   * Run the full debate until consensus or max rounds
   */
  async runDebate(): Promise<DebateSession> {
    this.session.status = 'running'
    this.aborted = false

    try {
      while (
        !this.aborted &&
        this.session.rounds.length < this.session.config.maxRounds
      ) {
        const round = await this.runRound()

        if (!round) {
          break
        }

        if (round.consensusReached) {
          this.session.consensusReached = true
          break
        }
      }

      this.session.status = this.aborted ? 'paused' : 'completed'
      this.session.completedAt = new Date().toISOString()

      this.emit('debateComplete', this.session)
      return this.session
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.session.status = 'failed'
      this.session.error = errorMsg
      this.session.completedAt = new Date().toISOString()

      this.emit('error', errorMsg)
      return this.session
    }
  }

  /**
   * Abort the debate
   */
  abort(): void {
    this.aborted = true
    this.session.status = 'paused'
  }

  /**
   * Resume a paused debate
   */
  async resume(): Promise<DebateSession> {
    if (this.session.status !== 'paused') {
      return this.session
    }

    this.aborted = false
    return this.runDebate()
  }

  /**
   * Accept the current spec and mark debate as complete
   */
  acceptSpec(): DebateSession {
    this.session.status = 'completed'
    this.session.completedAt = new Date().toISOString()
    return this.session
  }
}

/**
 * Factory function for creating debate orchestrators
 */
export function createDebateOrchestrator(
  taskPath: string,
  originalSpec: string,
  config?: Partial<DebateConfig>
): DebateOrchestrator {
  return new DebateOrchestrator(taskPath, originalSpec, config)
}
