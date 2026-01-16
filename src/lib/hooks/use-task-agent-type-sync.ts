/**
 * Task Agent Type Synchronization Hook
 *
 * Manages agent type selection synchronization when availability changes.
 * Includes settings defaults application and debug agents initialization.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSynchronizeAgentType } from '@/lib/hooks/use-synchronize-agent-type'
import { useSettingsStore } from '@/lib/stores/settings'
import { ALL_PLANNER_CANDIDATES } from '@/components/tasks/create-task-modal'
import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'
import type {
  TasksAction,
  CreateModalState,
  RunAgentState,
  VerifyAgentState,
  RewriteState,
} from '@/lib/stores/tasks-reducer'

interface UseTaskAgentTypeSyncParams {
  dispatch: React.Dispatch<TasksAction>
  create: CreateModalState
  run: RunAgentState
  verify: VerifyAgentState
  rewrite: RewriteState
  availableTypes: AgentType[]
  availablePlannerTypes: PlannerAgentType[]
}

export function useTaskAgentTypeSync({
  dispatch,
  create,
  run,
  verify,
  rewrite,
  availableTypes,
  availablePlannerTypes,
}: UseTaskAgentTypeSyncParams) {
  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Type Change Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCreateAgentTypeChange = useCallback((newType: PlannerAgentType) => {
    dispatch({ type: 'SET_CREATE_AGENT_TYPE', payload: newType })
  }, [dispatch])

  const handleRunAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_RUN_AGENT_TYPE', payload: newType })
  }, [dispatch])

  const handleRewriteAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_REWRITE_AGENT_TYPE', payload: newType })
  }, [dispatch])

  const handleVerifyAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_VERIFY_AGENT_TYPE', payload: newType })
  }, [dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Preferred Order Memos
  // ─────────────────────────────────────────────────────────────────────────────

  const plannerPreferredOrder: PlannerAgentType[] = useMemo(
    () => ['claude', 'codex', 'cerebras', 'opencode', 'openrouter', 'research', 'qa'],
    []
  )

  const agentPreferredOrder: AgentType[] = useMemo(
    () => ['claude', 'codex', 'cerebras', 'opencode', 'gemini', 'research', 'qa'],
    []
  )

  const verifyPreferredOrder: AgentType[] = useMemo(
    () => ['codex', 'claude', 'cerebras', 'opencode', 'gemini', 'qa', 'research'],
    []
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Synchronize Agent Types
  // ─────────────────────────────────────────────────────────────────────────────

  useSynchronizeAgentType({
    currentType: create.agentType,
    availableTypes: availablePlannerTypes,
    preferredOrder: plannerPreferredOrder,
    onTypeChange: handleCreateAgentTypeChange,
  })

  useSynchronizeAgentType({
    currentType: run.agentType,
    availableTypes,
    preferredOrder: agentPreferredOrder,
    onTypeChange: handleRunAgentTypeChange,
  })

  useSynchronizeAgentType({
    currentType: rewrite.agentType,
    availableTypes,
    preferredOrder: agentPreferredOrder,
    onTypeChange: handleRewriteAgentTypeChange,
  })

  useSynchronizeAgentType({
    currentType: verify.agentType,
    availableTypes,
    preferredOrder: verifyPreferredOrder,
    onTypeChange: handleVerifyAgentTypeChange,
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Initialize Debug Agents
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (create.debugAgents.length === 0) {
      dispatch({ type: 'INIT_DEBUG_AGENTS', payload: ALL_PLANNER_CANDIDATES })
    }
  }, [create.debugAgents.length, dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Apply Settings Defaults
  // ─────────────────────────────────────────────────────────────────────────────

  const {
    defaultPlanningAgentType,
    defaultVerifyAgentType,
    defaultVerifyModelId,
    defaultImplementAgentType,
    defaultImplementModelId,
  } = useSettingsStore()

  const hasAppliedSettingsRef = useRef(false)

  useEffect(() => {
    if (hasAppliedSettingsRef.current) return
    hasAppliedSettingsRef.current = true

    // Apply default planning agent from settings
    if (defaultPlanningAgentType && availablePlannerTypes.includes(defaultPlanningAgentType)) {
      dispatch({ type: 'SET_CREATE_AGENT_TYPE', payload: defaultPlanningAgentType })
    }

    // Apply default verify agent and model from settings
    if (defaultVerifyAgentType && availableTypes.includes(defaultVerifyAgentType)) {
      dispatch({ type: 'SET_VERIFY_AGENT_TYPE', payload: defaultVerifyAgentType })
      if (defaultVerifyModelId) {
        dispatch({ type: 'SET_VERIFY_MODEL', payload: defaultVerifyModelId })
      }
    }

    // Apply default implementation agent and model from settings
    if (defaultImplementAgentType && availableTypes.includes(defaultImplementAgentType)) {
      dispatch({ type: 'SET_RUN_AGENT_TYPE', payload: defaultImplementAgentType })
      if (defaultImplementModelId) {
        dispatch({ type: 'SET_RUN_MODEL', payload: defaultImplementModelId })
      }
    }
  }, [
    defaultPlanningAgentType,
    defaultVerifyAgentType,
    defaultVerifyModelId,
    defaultImplementAgentType,
    defaultImplementModelId,
    availablePlannerTypes,
    availableTypes,
    dispatch,
  ])

  return {
    handleCreateAgentTypeChange,
    handleRunAgentTypeChange,
    handleRewriteAgentTypeChange,
    handleVerifyAgentTypeChange,
  }
}
