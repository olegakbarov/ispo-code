/**
 * Agent configuration - types, models, and constants
 */

import type { AgentType } from '@/lib/agent/types'

export type PlannerAgentType = AgentType

export const TASK_REVIEW_OUTPUT_START = '===TASK_REVIEW_OUTPUT_START==='
export const TASK_REVIEW_OUTPUT_END = '===TASK_REVIEW_OUTPUT_END==='

/** Common models for OpenCode */
export const OPENCODE_MODELS = [
  { value: '', label: 'Default' },
  // Cerebras (20x faster inference)
  { value: 'cerebras/zai-glm-4.7', label: 'Cerebras GLM 4.7 (357B)' },
  { value: 'cerebras/llama-3.3-70b', label: 'Cerebras Llama 3.3 70B' },
  { value: 'cerebras/qwen-3-32b', label: 'Cerebras Qwen 3 32B' },
  // Anthropic
  { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'anthropic/claude-opus-4-20250514', label: 'Claude Opus 4' },
  // OpenAI
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'openai/o1', label: 'OpenAI o1' },
  // Google
  { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
]

export const agentTypeLabel: Record<AgentType, string> = {
  claude: 'Claude CLI',
  codex: 'Codex CLI',
  opencode: 'OpenCode',
  cerebras: 'Cerebras GLM',
}

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
