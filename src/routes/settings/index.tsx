/**
 * Settings Route - User preferences including brand color, audio notifications, and agent defaults
 */

import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { useSettingsStore } from "@/lib/stores/settings"
import { AppearanceSection } from "@/components/settings/appearance-section"
import { AudioSection } from "@/components/settings/audio-section"
import { AgentDefaultsSection } from "@/components/settings/agent-defaults-section"
import { ClaudeAuthSection, AccountSection } from "@/components/settings/account-section"

export const Route = createFileRoute("/settings/")({
  component: SettingsPageWrapper,
})

function SettingsPageWrapper() {
  return (
    <ErrorBoundary
      name="SettingsPage"
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
            Settings page failed to load. Please refresh the page.
          </div>
        </div>
      }
    >
      <SettingsPage />
    </ErrorBoundary>
  )
}

function SettingsPage() {
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
      <AppearanceSection />
      <AudioSection />
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
      <ClaudeAuthSection />
      <AccountSection />
    </div>
  )
}
