/**
 * Agent configuration - types, models, and constants
 *
 * Model definitions are now centralized in model-registry.ts
 * This file re-exports model options for backward compatibility
 */

import type { AgentType } from './types'
import {
  getModelOptions,
  getDefaultModelId,
  getContextLimit,
  supportsModelSelection,
  type ModelOption,
  type ModelDefinition,
} from './model-registry'

// Core planner type excludes some agents
export type CorePlannerAgentType = Exclude<AgentType, 'cerebras' | 'gemini'>

// Task UI allows all agent types for planning
export type PlannerAgentType = AgentType

// Legacy alias for backward compatibility
export type { CorePlannerAgentType as RestrictedPlannerAgentType }

/**
 * Agent types that support the AskUserQuestion tool for interactive clarification.
 * Currently only Claude CLI provides this capability natively.
 */
const AGENTS_WITH_ASK_USER_QUESTION: AgentType[] = ['claude', 'research', 'qa']

/**
 * Check if an agent type supports the AskUserQuestion tool.
 * Used to gate includeQuestions feature in task creation.
 */
export function supportsAskUserQuestion(agentType: AgentType): boolean {
  return AGENTS_WITH_ASK_USER_QUESTION.includes(agentType)
}

export const TASK_REVIEW_OUTPUT_START = '===TASK_REVIEW_OUTPUT_START==='
export const TASK_REVIEW_OUTPUT_END = '===TASK_REVIEW_OUTPUT_END==='

export const agentTypeLabel: Record<AgentType, string> = {
  claude: 'Claude CLI',
  codex: 'Codex CLI',
  opencode: 'OpenCode',
  cerebras: 'Cerebras GLM',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  research: 'Research Agent',
  qa: 'QA Agent',
}

/**
 * Convert ModelOption to the legacy {value, label} format for UI components
 */
function toLegacyFormat(options: ModelOption[]): Array<{ value: string; label: string; description?: string }> {
  return options.map(o => ({
    value: o.value,
    label: o.label,
    description: o.description,
  }))
}

// Re-export model options in legacy format for backward compatibility
export const OPENCODE_MODELS = [
  { value: '', label: 'Default' },
  ...toLegacyFormat(getModelOptions('opencode')),
]

export const GEMINI_MODELS = toLegacyFormat(getModelOptions('gemini'))

export const CEREBRAS_MODELS = toLegacyFormat(getModelOptions('cerebras'))

export const CLAUDE_MODELS = toLegacyFormat(getModelOptions('claude'))

export const CODEX_MODELS = toLegacyFormat(getModelOptions('codex'))

export const OPENROUTER_MODELS = toLegacyFormat(getModelOptions('openrouter'))

/**
 * Get all model options for a given agent type
 */
export function getModelsForAgentType(agentType: AgentType): Array<{ value: string; label: string; description?: string }> {
  const options = getModelOptions(agentType)
  // Add default empty option for agents that support it
  if (agentType === 'opencode') {
    return [{ value: '', label: 'Default' }, ...toLegacyFormat(options)]
  }
  return toLegacyFormat(options)
}

/**
 * Check if agent type supports model selection in UI
 */
export { supportsModelSelection, getDefaultModelId, getContextLimit }

// Re-export types
export type { ModelOption, ModelDefinition }

export function extractTaskReviewOutput(text: string): string | null {
  const startIdx = text.indexOf(TASK_REVIEW_OUTPUT_START)
  const endIdx = text.indexOf(TASK_REVIEW_OUTPUT_END)
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return text.slice(startIdx + TASK_REVIEW_OUTPUT_START.length, endIdx).trim()
  }

  const fenced = text.match(/```(?:markdown|md)\s*\n([\s\S]*?)\n```/)
  if (fenced?.[1]) return fenced[1].trim()
  return null
}
