/**
 * Settings Route - User preferences including brand color and audio notifications
 */

import { createFileRoute } from "@tanstack/react-router"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { AppearanceSection } from "@/components/settings/appearance-section"
import { AudioSection } from "@/components/settings/audio-section"
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
  return (
    <div className="p-4 max-w-2xl">
      <AppearanceSection />
      <AudioSection />
      <ClaudeAuthSection />
      <AccountSection />
    </div>
  )
}
