/**
 * Agent Defaults Settings Route - Configure default agents for task workflows
 */

import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { useSettingsStore } from "@/lib/stores/settings"
import { AgentDefaultsSection } from "@/components/settings/agent-defaults-section"

export const Route = createFileRoute("/settings/agent-defaults")({
  component: AgentDefaultsPageWrapper,
})

function AgentDefaultsPageWrapper() {
  return (
    <ErrorBoundary
      name="AgentDefaultsPage"
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
            Agent defaults page failed to load. Please refresh the page.
          </div>
        </div>
      }
    >
      <AgentDefaultsPage />
    </ErrorBoundary>
  )
}

function AgentDefaultsPage() {
  const {
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
  } = useSettingsStore()

  return (
    <div className="p-4 max-w-2xl">
      <AgentDefaultsSection
        defaultPlanningAgentType={defaultPlanningAgentType}
        setDefaultPlanningAgentType={setDefaultPlanningAgentType}
        defaultVerifyAgentType={defaultVerifyAgentType}
        setDefaultVerifyAgentType={setDefaultVerifyAgentType}
        defaultVerifyModelId={defaultVerifyModelId}
        setDefaultVerifyModelId={setDefaultVerifyModelId}
        defaultImplementAgentType={defaultImplementAgentType}
        setDefaultImplementAgentType={setDefaultImplementAgentType}
        defaultImplementModelId={defaultImplementModelId}
        setDefaultImplementModelId={setDefaultImplementModelId}
      />
    </div>
  )
}
