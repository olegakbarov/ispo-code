/**
 * Agent Defaults Section - configure default agents for task workflows
 */

import { useMemo } from "react"
import { Bot } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { trpc } from "@/lib/trpc-client"
import { agentTypeLabel, getModelsForAgentType, getDefaultModelId } from "@/lib/agent/config"
import type { AgentType } from "@/lib/agent/types"
import type { PlannerAgentType } from "@/lib/agent/config"
import { ALL_PLANNER_CANDIDATES } from "@/components/tasks/create-task-form"

/** All agent types for verification dropdown (includes all AgentType values) */
const ALL_AGENT_TYPES: AgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'gemini', 'openrouter']

interface AgentDefaultsSectionProps {
  defaultPlanningAgentType: PlannerAgentType | null
  setDefaultPlanningAgentType: (agentType: PlannerAgentType | null) => void
  defaultVerifyAgentType: AgentType | null
  setDefaultVerifyAgentType: (agentType: AgentType | null) => void
  defaultVerifyModelId: string | null
  setDefaultVerifyModelId: (modelId: string | null) => void
  defaultImplementAgentType: AgentType | null
  setDefaultImplementAgentType: (agentType: AgentType | null) => void
  defaultImplementModelId: string | null
  setDefaultImplementModelId: (modelId: string | null) => void
}

export function AgentDefaultsSection({
  defaultPlanningAgentType,
  setDefaultPlanningAgentType,
  defaultVerifyAgentType,
  setDefaultVerifyAgentType,
  defaultVerifyModelId,
  setDefaultVerifyModelId,
  defaultImplementAgentType,
  setDefaultImplementAgentType,
  defaultImplementModelId,
  setDefaultImplementModelId,
}: AgentDefaultsSectionProps) {
  // Fetch available agent types
  const { data: availableTypes = [], isLoading } = trpc.agent.availableTypes.useQuery()

  // Filter to planner types
  const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
    const candidates: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'openrouter']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  // Get models for selected verify agent type
  const verifyModels = useMemo(() => {
    if (!defaultVerifyAgentType) return []
    return getModelsForAgentType(defaultVerifyAgentType)
  }, [defaultVerifyAgentType])

  // Get models for selected implementation agent type
  const implementModels = useMemo(() => {
    if (!defaultImplementAgentType) return []
    return getModelsForAgentType(defaultImplementAgentType)
  }, [defaultImplementAgentType])

  const handlePlanningAgentChange = (value: string) => {
    setDefaultPlanningAgentType(value ? (value as PlannerAgentType) : null)
  }

  const handleVerifyAgentChange = (value: string) => {
    const newType = value ? (value as AgentType) : null
    setDefaultVerifyAgentType(newType)
    // Reset model when agent type changes, set to default for the new type
    if (newType) {
      setDefaultVerifyModelId(getDefaultModelId(newType))
    } else {
      setDefaultVerifyModelId(null)
    }
  }

  const handleVerifyModelChange = (value: string) => {
    setDefaultVerifyModelId(value || null)
  }

  const handleImplementAgentChange = (value: string) => {
    const newType = value ? (value as AgentType) : null
    setDefaultImplementAgentType(newType)
    // Reset model when agent type changes, set to default for the new type
    if (newType) {
      setDefaultImplementModelId(getDefaultModelId(newType))
    } else {
      setDefaultImplementModelId(null)
    }
  }

  const handleImplementModelChange = (value: string) => {
    setDefaultImplementModelId(value || null)
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Agent Defaults</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Configure default agents and models for task workflows. These defaults will be pre-selected when creating or verifying tasks.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner size="xs" />
          Loading available agents...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Planning Agent Default */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Default Planning Agent
            </label>
            <p className="text-[10px] text-muted-foreground/70 mb-2">
              Pre-selected agent when creating new tasks with AI planning
            </p>
            <select
              value={defaultPlanningAgentType ?? ""}
              onChange={(e) => handlePlanningAgentChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Use system default</option>
              {ALL_PLANNER_CANDIDATES.map((type) => {
                const isAvailable = availablePlannerTypes.includes(type)
                return (
                  <option key={type} value={type} disabled={!isAvailable}>
                    {agentTypeLabel[type]}{!isAvailable ? ' (Not available)' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Verification Agent Default */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Default Verification Agent
            </label>
            <p className="text-[10px] text-muted-foreground/70 mb-2">
              Pre-selected agent for task verification
            </p>
            <select
              value={defaultVerifyAgentType ?? ""}
              onChange={(e) => handleVerifyAgentChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Use system default</option>
              {ALL_AGENT_TYPES.map((type) => {
                const isAvailable = availableTypes.includes(type)
                return (
                  <option key={type} value={type} disabled={!isAvailable}>
                    {agentTypeLabel[type]}{!isAvailable ? ' (Not available)' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Verification Model Default (only show if agent is selected) */}
          {defaultVerifyAgentType && verifyModels.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Default Verification Model
              </label>
              <p className="text-[10px] text-muted-foreground/70 mb-2">
                Pre-selected model for the verification agent
              </p>
              <select
                value={defaultVerifyModelId ?? ""}
                onChange={(e) => handleVerifyModelChange(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {verifyModels.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Implementation Agent Default */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Default Implementation Agent
            </label>
            <p className="text-[10px] text-muted-foreground/70 mb-2">
              Pre-selected agent for task implementation
            </p>
            <select
              value={defaultImplementAgentType ?? ""}
              onChange={(e) => handleImplementAgentChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Use system default</option>
              {ALL_AGENT_TYPES.map((type) => {
                const isAvailable = availableTypes.includes(type)
                return (
                  <option key={type} value={type} disabled={!isAvailable}>
                    {agentTypeLabel[type]}{!isAvailable ? ' (Not available)' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Implementation Model Default (only show if agent is selected) */}
          {defaultImplementAgentType && implementModels.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Default Implementation Model
              </label>
              <p className="text-[10px] text-muted-foreground/70 mb-2">
                Pre-selected model for the implementation agent
              </p>
              <select
                value={defaultImplementModelId ?? ""}
                onChange={(e) => handleImplementModelChange(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {implementModels.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
