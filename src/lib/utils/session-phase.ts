/**
 * Session Phase Utilities
 *
 * Maps session titles to phase labels for audio notifications.
 * Session titles follow the pattern: "{Phase}: {task title}"
 */

/**
 * Phase label for audio notifications.
 * These are the human-readable forms spoken in audio notifications.
 */
export type PhaseLabel = 'Planning' | 'Implementation' | 'Verification' | 'Review' | 'Debugging'

/** All valid phase labels */
export const PHASE_LABELS = ['Planning', 'Implementation', 'Verification', 'Review', 'Debugging'] as const

/**
 * Session title prefix to phase label mapping.
 * Each prefix maps to a spoken phase name.
 */
const PREFIX_TO_PHASE: Record<string, PhaseLabel> = {
  'Plan': 'Planning',
  'Debug': 'Debugging',
  'Run': 'Implementation',
  'Review': 'Review',
  'Verify': 'Verification',
}

/**
 * Extracts the phase label from a session title.
 *
 * Session titles follow the pattern: "{Prefix}: {task title}"
 * where Prefix is one of: Plan, Debug, Run, Review, Verify
 *
 * @param sessionTitle - The session title (e.g., "Plan: Add new feature")
 * @returns The phase label, or undefined if no recognized prefix
 *
 * @example
 * getPhaseFromSessionTitle("Plan: Add dark mode") // "Planning"
 * getPhaseFromSessionTitle("Run: Add dark mode") // "Implementation"
 * getPhaseFromSessionTitle("Verify: Add dark mode") // "Verification"
 * getPhaseFromSessionTitle("Debug: Fix login bug") // "Debugging"
 * getPhaseFromSessionTitle("Some other title") // undefined
 */
export function getPhaseFromSessionTitle(sessionTitle: string | undefined): PhaseLabel | undefined {
  if (!sessionTitle) return undefined

  // Extract prefix before the colon
  const colonIndex = sessionTitle.indexOf(':')
  if (colonIndex === -1) return undefined

  const prefix = sessionTitle.slice(0, colonIndex).trim()
  return PREFIX_TO_PHASE[prefix]
}
