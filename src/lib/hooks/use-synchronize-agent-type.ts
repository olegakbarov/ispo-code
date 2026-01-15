/**
 * Hook to synchronize agent type selection when available types change
 *
 * Handles the common pattern where we need to:
 * 1. Check if the current selection is still available
 * 2. If not, switch to a preferred fallback from a priority list
 * 3. Update both the agent type and its default model
 */

import { useEffect } from 'react'
import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'

interface UseSynchronizeAgentTypeOptions<T extends AgentType | PlannerAgentType> {
  /** Currently selected agent type */
  currentType: T
  /** List of available agent types from the server */
  availableTypes: T[]
  /** Preferred agent types in priority order (first available will be selected) */
  preferredOrder: T[]
  /** Callback to update the agent type (should also update the model) */
  onTypeChange: (newType: T) => void
}

/**
 * Synchronizes the selected agent type with available types.
 *
 * When availability changes and the current selection is no longer valid,
 * automatically switches to the first available type from the preferred order.
 *
 * @example
 * useSynchronizeAgentType({
 *   currentType: runAgentType,
 *   availableTypes,
 *   preferredOrder: ['claude', 'codex', 'cerebras', 'opencode', 'gemini'],
 *   onTypeChange: handleRunAgentTypeChange,
 * })
 */
export function useSynchronizeAgentType<T extends AgentType | PlannerAgentType>({
  currentType,
  availableTypes,
  preferredOrder,
  onTypeChange,
}: UseSynchronizeAgentTypeOptions<T>): void {
  useEffect(() => {
    // Skip if no types are available yet
    if (availableTypes.length === 0) return

    // Skip if current selection is still valid
    if (availableTypes.includes(currentType)) return

    // Find the first available type from the preferred order
    const nextType = preferredOrder.find((t) => availableTypes.includes(t)) ?? availableTypes[0]

    // Update to the new type (callback should also update the model)
    onTypeChange(nextType)
  }, [availableTypes, currentType, preferredOrder, onTypeChange])
}
