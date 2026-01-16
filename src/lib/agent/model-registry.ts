/**
 * Global Model Registry
 *
 * Single source of truth for all models across agent types.
 * Provides consistent model metadata, context limits, and selection utilities.
 */

import type { AgentType } from "./types"

/**
 * Unified model definition structure
 */
export interface ModelDefinition {
  /** Unique model identifier (e.g., "gemini-2.0-flash", "zai-glm-4.7") */
  id: string
  /** Display name for UI */
  name: string
  /** Short description of model capabilities */
  description: string
  /** Context window size in tokens */
  contextLimit: number
  /** Agent type this model belongs to */
  agentType: AgentType
  /** Provider name (for display grouping) */
  provider: string
  /** Whether this is the default model for its agent type */
  isDefault?: boolean
}

/**
 * Model selection option for UI components
 */
export interface ModelOption {
  value: string
  label: string
  description?: string
  agentType: AgentType
  contextLimit: number
}

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

/**
 * Cerebras models - Ultra-fast inference
 */
const CEREBRAS_MODELS: ModelDefinition[] = [
  {
    id: "zai-glm-4.7",
    name: "GLM 4.7 (357B)",
    description: "Advanced reasoning with tool use",
    contextLimit: 131_072,
    agentType: "cerebras",
    provider: "Cerebras",
    isDefault: true,
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    description: "Complex reasoning",
    contextLimit: 131_072,
    agentType: "cerebras",
    provider: "Cerebras",
  },
  {
    id: "qwen-3-32b",
    name: "Qwen 3 32B",
    description: "General-purpose",
    contextLimit: 32_768,
    agentType: "cerebras",
    provider: "Cerebras",
  },
  {
    id: "llama3.1-8b",
    name: "Llama 3.1 8B",
    description: "Speed-critical tasks",
    contextLimit: 131_072,
    agentType: "cerebras",
    provider: "Cerebras",
  },
]

/**
 * Google Gemini models - Large context, multimodal
 */
const GEMINI_MODELS: ModelDefinition[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast multimodal",
    contextLimit: 1_048_576,
    agentType: "gemini",
    provider: "Google",
    isDefault: true,
  },
  {
    id: "gemini-2.0-pro",
    name: "Gemini 2.0 Pro",
    description: "Advanced reasoning",
    contextLimit: 1_048_576,
    agentType: "gemini",
    provider: "Google",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    description: "Balanced performance",
    contextLimit: 2_097_152,
    agentType: "gemini",
    provider: "Google",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    description: "Speed optimized",
    contextLimit: 1_048_576,
    agentType: "gemini",
    provider: "Google",
  },
]

/**
 * OpenCode models - Multi-provider support
 * Format: provider/model
 */
const OPENCODE_MODELS: ModelDefinition[] = [
  // Cerebras via OpenCode
  {
    id: "cerebras/zai-glm-4.7",
    name: "Cerebras GLM 4.7 (357B)",
    description: "20x faster inference",
    contextLimit: 131_072,
    agentType: "opencode",
    provider: "Cerebras",
    isDefault: true,
  },
  {
    id: "cerebras/llama-3.3-70b",
    name: "Cerebras Llama 3.3 70B",
    description: "Complex reasoning",
    contextLimit: 131_072,
    agentType: "opencode",
    provider: "Cerebras",
  },
  {
    id: "cerebras/qwen-3-32b",
    name: "Cerebras Qwen 3 32B",
    description: "General-purpose",
    contextLimit: 32_768,
    agentType: "opencode",
    provider: "Cerebras",
  },
  // Anthropic via OpenCode
  {
    id: "anthropic/claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    description: "Most capable, enhanced reasoning",
    contextLimit: 200_000,
    agentType: "opencode",
    provider: "Anthropic",
  },
  // OpenAI via OpenCode
  {
    id: "openai/codex-5.2",
    name: "Codex 5.2",
    description: "Most capable coding model",
    contextLimit: 200_000,
    agentType: "opencode",
    provider: "OpenAI",
  },
  // Google via OpenCode (agentic Gemini)
  {
    id: "google/gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast multimodal, agentic",
    contextLimit: 1_048_576,
    agentType: "opencode",
    provider: "Google",
  },
  {
    id: "google/gemini-2.5-pro-preview-06-05",
    name: "Gemini 2.5 Pro",
    description: "Advanced reasoning, agentic",
    contextLimit: 1_048_576,
    agentType: "opencode",
    provider: "Google",
  },
  {
    id: "google/gemini-2.5-flash-preview-05-20",
    name: "Gemini 2.5 Flash",
    description: "Fast and capable, agentic",
    contextLimit: 1_048_576,
    agentType: "opencode",
    provider: "Google",
  },
]

/**
 * Claude CLI models - Uses Claude's built-in model selection
 */
const CLAUDE_MODELS: ModelDefinition[] = [
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    description: "Most capable, enhanced reasoning",
    contextLimit: 200_000,
    agentType: "claude",
    provider: "Anthropic",
    isDefault: true,
  },
]

/**
 * Codex CLI models
 */
const CODEX_MODELS: ModelDefinition[] = [
  {
    id: "codex-5.2",
    name: "Codex 5.2",
    description: "Most capable coding model",
    contextLimit: 200_000,
    agentType: "codex",
    provider: "OpenAI",
    isDefault: true,
  },
]

/**
 * Research Agent models - Claude CLI with --chrome for web research
 */
const RESEARCH_MODELS: ModelDefinition[] = [
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    description: "Research with web browsing",
    contextLimit: 200_000,
    agentType: "research",
    provider: "Anthropic",
    isDefault: true,
  },
]

/**
 * QA Agent models - Claude CLI with --chrome for testing/verification
 */
const QA_MODELS: ModelDefinition[] = [
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    description: "QA with web browsing",
    contextLimit: 200_000,
    agentType: "qa",
    provider: "Anthropic",
    isDefault: true,
  },
]

/**
 * OpenRouter models - Multi-provider access via unified API
 * Format: provider/model (OpenRouter routing format)
 */
const OPENROUTER_MODELS: ModelDefinition[] = [
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    description: "Balanced performance",
    contextLimit: 200_000,
    agentType: "openrouter",
    provider: "Anthropic",
    isDefault: true,
  },
  {
    id: "anthropic/claude-opus-4",
    name: "Claude Opus 4",
    description: "Most capable",
    contextLimit: 200_000,
    agentType: "openrouter",
    provider: "Anthropic",
  },
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    description: "Latest GPT-4",
    contextLimit: 128_000,
    agentType: "openrouter",
    provider: "OpenAI",
  },
  {
    id: "openai/o3",
    name: "O3",
    description: "Advanced reasoning",
    contextLimit: 200_000,
    agentType: "openrouter",
    provider: "OpenAI",
  },
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro",
    description: "Google's latest",
    contextLimit: 1_048_576,
    agentType: "openrouter",
    provider: "Google",
  },
  {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    description: "Open source",
    contextLimit: 131_072,
    agentType: "openrouter",
    provider: "Meta",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    description: "Reasoning model",
    contextLimit: 64_000,
    agentType: "openrouter",
    provider: "DeepSeek",
  },
  {
    id: "mistralai/mistral-large-2411",
    name: "Mistral Large",
    description: "Enterprise grade",
    contextLimit: 128_000,
    agentType: "openrouter",
    provider: "Mistral AI",
  },
]

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * All models indexed by agent type
 */
const MODEL_REGISTRY: Record<AgentType, ModelDefinition[]> = {
  cerebras: CEREBRAS_MODELS,
  gemini: GEMINI_MODELS,
  opencode: OPENCODE_MODELS,
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
  openrouter: OPENROUTER_MODELS,
  research: RESEARCH_MODELS,
  qa: QA_MODELS,
}

/**
 * Flat list of all models
 */
const ALL_MODELS: ModelDefinition[] = Object.values(MODEL_REGISTRY).flat()

// ============================================================================
// API
// ============================================================================

/**
 * Get all models for a specific agent type
 */
export function getModelsForAgent(agentType: AgentType): ModelDefinition[] {
  return MODEL_REGISTRY[agentType] ?? []
}

/**
 * Get the default model for an agent type
 */
export function getDefaultModel(agentType: AgentType): ModelDefinition | undefined {
  const models = getModelsForAgent(agentType)
  return models.find(m => m.isDefault) ?? models[0]
}

/**
 * Get default model ID for an agent type
 */
export function getDefaultModelId(agentType: AgentType): string {
  return getDefaultModel(agentType)?.id ?? ""
}

/**
 * Find a model by ID (searches all agent types)
 */
export function findModelById(modelId: string): ModelDefinition | undefined {
  return ALL_MODELS.find(m => m.id === modelId)
}

/**
 * Find a model by ID within a specific agent type
 */
export function findModelByIdForAgent(modelId: string, agentType: AgentType): ModelDefinition | undefined {
  return getModelsForAgent(agentType).find(m => m.id === modelId)
}

/**
 * Get context limit for a model, with fallback
 */
export function getContextLimit(modelId: string, agentType: AgentType): number {
  const model = findModelByIdForAgent(modelId, agentType) ?? findModelById(modelId)
  if (model) return model.contextLimit

  // Fallback by agent type (for unknown models)
  const defaults: Record<AgentType, number> = {
    claude: 200_000,
    codex: 200_000,
    opencode: 200_000,
    cerebras: 131_072,
    gemini: 1_048_576,
    openrouter: 200_000,
    research: 200_000,
    qa: 200_000,
  }
  return defaults[agentType] ?? 128_000
}

/**
 * Convert models to UI select options
 */
export function getModelOptions(agentType: AgentType): ModelOption[] {
  return getModelsForAgent(agentType).map(m => ({
    value: m.id,
    label: m.name,
    description: m.description,
    agentType: m.agentType,
    contextLimit: m.contextLimit,
  }))
}

/**
 * Get all models as select options (grouped by agent type)
 */
export function getAllModelOptions(): Record<AgentType, ModelOption[]> {
  const result: Partial<Record<AgentType, ModelOption[]>> = {}
  for (const agentType of Object.keys(MODEL_REGISTRY) as AgentType[]) {
    result[agentType] = getModelOptions(agentType)
  }
  return result as Record<AgentType, ModelOption[]>
}

/**
 * Check if an agent type supports model selection
 */
export function supportsModelSelection(agentType: AgentType): boolean {
  // All agent types now support model selection
  return getModelsForAgent(agentType).length > 1
}

/**
 * Get all unique providers
 */
export function getAllProviders(): string[] {
  const providers = new Set<string>()
  for (const model of ALL_MODELS) {
    providers.add(model.provider)
  }
  return Array.from(providers).sort()
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: string): ModelDefinition[] {
  return ALL_MODELS.filter(m => m.provider === provider)
}

// ============================================================================
// EXPORTS (backward compatibility)
// ============================================================================

// Re-export grouped arrays for backward compatibility
export { CEREBRAS_MODELS, GEMINI_MODELS, OPENCODE_MODELS, CLAUDE_MODELS, CODEX_MODELS, OPENROUTER_MODELS, RESEARCH_MODELS, QA_MODELS }

// Export the full registry
export { MODEL_REGISTRY, ALL_MODELS }
