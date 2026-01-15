/**
 * MCPorter model configuration (server-only)
 */

export const DEFAULT_LLM_ENV_VAR = "DEFAULT_LLM"

const VALID_MCPORTER_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
] as const

export type MCPorterModelId = (typeof VALID_MCPORTER_MODELS)[number]

export const DEFAULT_MCPORTER_MODEL: MCPorterModelId = "gemini-2.0-flash"

export function isValidMCPorterModel(model: string): model is MCPorterModelId {
  return VALID_MCPORTER_MODELS.includes(model as MCPorterModelId)
}

export function getDefaultMCPorterModelId(): MCPorterModelId {
  const rawValue = process.env[DEFAULT_LLM_ENV_VAR]
  const trimmed = rawValue?.trim()

  if (!trimmed) {
    return DEFAULT_MCPORTER_MODEL
  }

  if (!isValidMCPorterModel(trimmed)) {
    console.error(
      `[MCPorterAgent] Invalid ${DEFAULT_LLM_ENV_VAR} "${trimmed}", falling back to ${DEFAULT_MCPORTER_MODEL}`
    )
    return DEFAULT_MCPORTER_MODEL
  }

  return trimmed
}
