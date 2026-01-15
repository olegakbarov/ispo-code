/**
 * Debate Engine Types
 * Core interfaces for multi-model adversarial spec review
 */

import type { AgentType } from '../agent/types'

/**
 * Persona types for debate participants
 * Each persona reviews specs from a specific perspective
 */
export type DebatePersona =
  | 'security'    // Security vulnerabilities, auth, data exposure
  | 'oncall'      // Operability, monitoring, failure modes
  | 'pm'          // Requirements clarity, scope, user value
  | 'performance' // Efficiency, scalability, resource usage
  | 'qa'          // Testability, edge cases, acceptance criteria

/**
 * Severity levels for critique issues
 */
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion'

/**
 * Individual issue raised by a persona
 */
export interface CritiqueIssue {
  severity: IssueSeverity
  title: string
  description: string
  /** Specific section of spec this applies to (optional) */
  section?: string
  /** Suggested resolution */
  suggestion?: string
}

/**
 * Single agent's critique of the spec
 */
export interface Critique {
  agentType: AgentType
  model?: string
  persona: DebatePersona
  /** Overall assessment: approve, needs-changes, reject */
  verdict: 'approve' | 'needs-changes' | 'reject'
  /** Summary of review */
  summary: string
  /** List of issues found */
  issues: CritiqueIssue[]
  /** Raw response for debugging */
  rawResponse?: string
  /** Timestamp when critique was generated */
  timestamp: string
  /** Duration in milliseconds */
  durationMs?: number
}

/**
 * Single round of debate
 * Each round has multiple agents reviewing in parallel
 */
export interface DebateRound {
  roundNumber: number
  /** Spec version being reviewed this round */
  specVersion: string
  /** Critiques from all participating agents */
  critiques: Critique[]
  /** Whether consensus was reached */
  consensusReached: boolean
  /** Synthesized spec for next round (if no consensus) */
  refinedSpec?: string
  /** Summary of changes made this round */
  changesSummary?: string
  /** Timestamp when round started */
  startedAt: string
  /** Timestamp when round completed */
  completedAt?: string
}

/**
 * Configuration for a debate session
 */
export interface DebateConfig {
  /** Agents to use for critique (parallel per round) */
  agents: Array<{
    agentType: AgentType
    model?: string
    persona: DebatePersona
  }>
  /** Maximum rounds before stopping */
  maxRounds: number
  /** Consensus threshold (fraction of 'approve' verdicts needed) */
  consensusThreshold: number
  /** Whether to auto-synthesize refined spec between rounds */
  autoSynthesize: boolean
  /** Agent to use for synthesis (if different from critics) */
  synthesisAgent?: {
    agentType: AgentType
    model?: string
  }
}

/**
 * Overall debate session state
 */
export interface DebateSession {
  id: string
  /** Path to task file being reviewed */
  taskPath: string
  /** Original spec content */
  originalSpec: string
  /** Current refined spec */
  currentSpec: string
  /** Configuration for this debate */
  config: DebateConfig
  /** All rounds completed so far */
  rounds: DebateRound[]
  /** Current status */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  /** Final consensus reached? */
  consensusReached: boolean
  /** Error message if failed */
  error?: string
  /** When debate started */
  startedAt: string
  /** When debate completed/stopped */
  completedAt?: string
}

/**
 * Default debate configuration
 */
export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  agents: [
    { agentType: 'gemini', model: 'gemini-2.0-flash', persona: 'security' },
    { agentType: 'gemini', model: 'gemini-2.0-flash', persona: 'qa' },
    { agentType: 'cerebras', model: 'llama-4-scout-17b-16e-instruct', persona: 'performance' },
  ],
  maxRounds: 3,
  consensusThreshold: 0.67, // 2/3 must approve
  autoSynthesize: true,
  synthesisAgent: { agentType: 'gemini', model: 'gemini-2.0-flash' },
}

/**
 * Persona display labels
 */
export const PERSONA_LABELS: Record<DebatePersona, string> = {
  security: 'Security',
  oncall: 'On-Call/Ops',
  pm: 'Product',
  performance: 'Performance',
  qa: 'QA',
}

/**
 * Persona descriptions for UI
 */
export const PERSONA_DESCRIPTIONS: Record<DebatePersona, string> = {
  security: 'Reviews for vulnerabilities, auth issues, data exposure',
  oncall: 'Checks operability, monitoring, failure modes',
  pm: 'Evaluates requirements clarity, scope, user value',
  performance: 'Analyzes efficiency, scalability, resource usage',
  qa: 'Assesses testability, edge cases, acceptance criteria',
}

/**
 * Severity display colors (tailwind classes)
 */
export const SEVERITY_COLORS: Record<IssueSeverity, string> = {
  critical: 'text-error bg-error/10 border-error/30',
  major: 'text-warning bg-warning/10 border-warning/30',
  minor: 'text-accent bg-accent/10 border-accent/30',
  suggestion: 'text-text-muted bg-panel border-border',
}
