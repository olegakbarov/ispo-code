/**
 * Settings Route - User preferences including brand color, audio notifications, and agent defaults
 */

import { createFileRoute } from "@tanstack/react-router"
import { useState, useRef, useMemo } from "react"
import { Palette, Check, Volume2, Play, Bot, Moon, Sun, User, LogOut, Sparkles } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { useSettingsStore, applyBrandHue } from "@/lib/stores/settings"
import { themePresets } from "@/lib/theme-presets"
import { trpc } from "@/lib/trpc-client"
import { agentTypeLabel, getModelsForAgentType, getDefaultModelId } from "@/lib/agent/config"
import type { AgentType } from "@/lib/agent/types"
import type { PlannerAgentType } from "@/lib/agent/config"
import { useTheme } from "@/components/theme"
import { ALL_PLANNER_CANDIDATES } from "@/components/tasks/create-task-form"

/** All agent types for verification dropdown (includes all AgentType values) */
const ALL_AGENT_TYPES: AgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'gemini', 'mcporter']

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

// Preset color options with their hue values
const COLOR_PRESETS = [
  { name: "Blue", hue: 220 },
  { name: "Cyan", hue: 195 },
  { name: "Teal", hue: 175 },
  { name: "Green", hue: 145 },
  { name: "Lime", hue: 125 },
  { name: "Yellow", hue: 85 },
  { name: "Orange", hue: 50 },
  { name: "Red", hue: 25 },
  { name: "Pink", hue: 350 },
  { name: "Purple", hue: 280 },
  { name: "Violet", hue: 300 },
  { name: "Indigo", hue: 260 },
]

function SettingsPage() {
  const {
    themeId,
    setThemeId,
    brandHue,
    setBrandHue,
    audioEnabled,
    setAudioEnabled,
    selectedVoiceId,
    setSelectedVoiceId,
    defaultPlanningAgentType,
    setDefaultPlanningAgentType,
    defaultVerifyAgentType,
    setDefaultVerifyAgentType,
    defaultVerifyModelId,
    setDefaultVerifyModelId,
  } = useSettingsStore()

  const { theme, toggleTheme } = useTheme()

  const handleHueChange = (hue: number) => {
    setBrandHue(hue)
    applyBrandHue(hue)
  }

  // Audio notification state
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isGenerating, setIsGenerating] = useState<string | null>(null)

  // Fetch ElevenLabs configuration status and voices
  const { data: isConfigured } = trpc.audio.isConfigured.useQuery()
  const { data: voices, isLoading: voicesLoading } = trpc.audio.listVoices.useQuery(undefined, {
    enabled: isConfigured === true,
  })

  // Generate notification audio mutation
  const generateNotification = trpc.audio.generateNotification.useMutation()

  const handlePlayPreview = async (type: "completed" | "failed") => {
    if (!selectedVoiceId) return

    setIsGenerating(type)
    try {
      const result = await generateNotification.mutateAsync({
        voiceId: selectedVoiceId,
        type,
        taskTitle: "audio notification should specify which",
      })

      // Create a new Audio element for each play to avoid ref issues
      // and ensure clean playback state
      console.log("[AudioPreview] Creating audio, data length:", result.audioDataUrl.length)
      const audio = new Audio(result.audioDataUrl)
      audio.volume = 1.0
      console.log("[AudioPreview] Attempting to play...")
      await audio.play()
      console.log("[AudioPreview] Play started successfully")
    } catch (error) {
      // Check for autoplay policy errors
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        console.warn("[AudioPreview] Autoplay blocked - please interact with the page first")
      } else {
        console.error("Failed to generate/play audio:", error)
      }
    } finally {
      setIsGenerating(null)
    }
  }

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId)
  }

  return (
    <div className="p-4 max-w-2xl">
      {/* Theme Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
          <h2 className="text-sm font-semibold">Theme</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Choose between light and dark mode for the interface.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-all ${
              theme === 'dark'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:border-foreground/30'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span className="text-sm">Dark</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-all ${
              theme === 'light'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:border-foreground/30'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="text-sm">Light</span>
          </button>
        </div>
      </section>

      {/* Theme Preset Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Theme Preset</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Choose a color scheme for the interface. Each preset adjusts background and surface colors.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {themePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setThemeId(preset.id)}
              className={`flex flex-col gap-1 p-3 rounded-lg border transition-all text-left ${
                themeId === preset.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-foreground/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: theme === 'dark'
                      ? preset.dark['--background']
                      : preset.light['--background'],
                  }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: theme === 'dark'
                      ? preset.dark['--card']
                      : preset.light['--card'],
                  }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: theme === 'dark'
                      ? preset.dark['--secondary']
                      : preset.light['--secondary'],
                  }}
                />
                {themeId === preset.id && (
                  <Check className="w-3 h-3 text-primary ml-auto" />
                )}
              </div>
              <span className="text-xs font-medium">{preset.name}</span>
              <span className="text-[10px] text-muted-foreground">{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Brand Color Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Brand Color</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Choose an accent color for the interface. This affects buttons, links, and highlights throughout the app.
        </p>

        {/* Color Presets */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">
            Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleHueChange(preset.hue)}
                className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all hover:border-foreground/30"
                style={{
                  borderColor: brandHue === preset.hue ? `oklch(0.65 0.2 ${preset.hue})` : undefined,
                  backgroundColor: brandHue === preset.hue ? `oklch(0.65 0.2 ${preset.hue} / 0.1)` : undefined,
                }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: `oklch(0.65 0.2 ${preset.hue})` }}
                />
                <span className="text-xs">{preset.name}</span>
                {brandHue === preset.hue && (
                  <Check className="w-3 h-3 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Hue Slider */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">
            Custom Hue ({brandHue})
          </label>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="360"
              value={brandHue}
              onChange={(e) => handleHueChange(Number(e.target.value))}
              className="w-full h-8 rounded-md cursor-pointer appearance-none hue-slider"
              style={{
                background: `linear-gradient(to right,
                  oklch(0.65 0.2 0),
                  oklch(0.65 0.2 60),
                  oklch(0.65 0.2 120),
                  oklch(0.65 0.2 180),
                  oklch(0.65 0.2 240),
                  oklch(0.65 0.2 300),
                  oklch(0.65 0.2 360)
                )`,
              }}
            />
            {/* Custom thumb indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{
                left: `calc(${(brandHue / 360) * 100}% - 8px)`,
                backgroundColor: `oklch(0.65 0.2 ${brandHue})`,
              }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-xs font-semibold mb-3 text-muted-foreground">
            Preview
          </h3>
          <div className="space-y-3">
            {/* Button preview */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-xs font-medium text-primary-foreground"
                style={{ backgroundColor: `oklch(0.65 0.2 ${brandHue})` }}
              >
                Primary Button
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-xs font-medium border"
                style={{
                  borderColor: `oklch(0.65 0.2 ${brandHue})`,
                  color: `oklch(0.65 0.2 ${brandHue})`,
                }}
              >
                Outline Button
              </button>
            </div>

            {/* Text preview */}
            <div>
              <span className="text-xs" style={{ color: `oklch(0.65 0.2 ${brandHue})` }}>
                Accent text color
              </span>
              <span className="text-xs text-muted-foreground"> - </span>
              <a
                href="#"
                className="text-xs underline"
                style={{ color: `oklch(0.65 0.2 ${brandHue})` }}
                onClick={(e) => e.preventDefault()}
              >
                Link example
              </a>
            </div>

            {/* Badge preview */}
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium text-primary-foreground"
                style={{ backgroundColor: `oklch(0.65 0.2 ${brandHue})` }}
              >
                Badge
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: `oklch(0.65 0.2 ${brandHue} / 0.15)`,
                  color: `oklch(0.65 0.2 ${brandHue})`,
                }}
              >
                Soft Badge
              </span>
            </div>

            {/* Focus ring preview */}
            <div>
              <input
                type="text"
                placeholder="Focus ring preview (click to focus)"
                className="w-full px-3 py-1.5 rounded-md text-xs bg-input border border-border outline-none transition-shadow"
                style={{
                  boxShadow: `0 0 0 2px oklch(0.65 0.2 ${brandHue} / 0.3)`,
                }}
                readOnly
              />
            </div>
          </div>
        </div>
      </section>

      {/* Audio Notifications Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Audio Notifications</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Play audio notifications when agent tasks complete or fail. Powered by ElevenLabs text-to-speech.
        </p>

        {/* Configuration check */}
        {isConfigured === false && (
          <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground mb-4">
            ElevenLabs API key not configured. Add <code className="px-1 py-0.5 bg-background rounded">ELEVENLABS_API_KEY</code> to your environment to enable audio notifications.
          </div>
        )}

        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between mb-4">
          <label className="text-xs text-muted-foreground">
            Enable audio notifications
          </label>
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            disabled={!isConfigured}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              audioEnabled && isConfigured ? "bg-primary" : "bg-muted"
            } ${!isConfigured ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                audioEnabled && isConfigured ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Voice selection */}
        {isConfigured && (
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-2 block">
              Voice
            </label>
            {voicesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner size="xs" />
                Loading voices...
              </div>
            ) : (
              <select
                value={selectedVoiceId ?? ""}
                onChange={(e) => handleVoiceChange(e.target.value)}
                disabled={!audioEnabled}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                <option value="">Select a voice...</option>
                {voices?.map((voice) => (
                  <option key={voice.voiceId} value={voice.voiceId}>
                    {voice.name} {voice.category ? `(${voice.category})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Preview buttons */}
        {isConfigured && selectedVoiceId && audioEnabled && (
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-2 block">
              Preview
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePlayPreview("completed")}
                disabled={isGenerating !== null}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isGenerating === "completed" ? (
                  <Spinner size="xs" />
                ) : (
                  <Play className="w-3 h-4" />
                )}
                Success Sound
              </button>
              <button
                type="button"
                onClick={() => handlePlayPreview("failed")}
                disabled={isGenerating !== null}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isGenerating === "failed" ? (
                  <Spinner size="xs" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                Failure Sound
              </button>
            </div>
          </div>
        )}

        {/* Hidden audio element for playback */}
        <audio ref={audioRef} className="hidden" />
      </section>

      {/* Agent Defaults Section */}
      <AgentDefaultsSection
        defaultPlanningAgentType={defaultPlanningAgentType}
        setDefaultPlanningAgentType={setDefaultPlanningAgentType}
        defaultVerifyAgentType={defaultVerifyAgentType}
        setDefaultVerifyAgentType={setDefaultVerifyAgentType}
        defaultVerifyModelId={defaultVerifyModelId}
        setDefaultVerifyModelId={setDefaultVerifyModelId}
      />

      {/* Account Section */}
      <AccountSection />
    </div>
  )
}

/**
 * Agent Defaults Section - separate component to handle available types query
 */
function AgentDefaultsSection({
  defaultPlanningAgentType,
  setDefaultPlanningAgentType,
  defaultVerifyAgentType,
  setDefaultVerifyAgentType,
  defaultVerifyModelId,
  setDefaultVerifyModelId,
}: {
  defaultPlanningAgentType: PlannerAgentType | null
  setDefaultPlanningAgentType: (agentType: PlannerAgentType | null) => void
  defaultVerifyAgentType: AgentType | null
  setDefaultVerifyAgentType: (agentType: AgentType | null) => void
  defaultVerifyModelId: string | null
  setDefaultVerifyModelId: (modelId: string | null) => void
}) {
  // Fetch available agent types
  const { data: availableTypes = [], isLoading } = trpc.agent.availableTypes.useQuery()

  // Filter to planner types
  const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
    const candidates: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'mcporter']
    return candidates.filter((t) => availableTypes.includes(t))
  }, [availableTypes])

  // Get models for selected verify agent type
  const verifyModels = useMemo(() => {
    if (!defaultVerifyAgentType) return []
    return getModelsForAgentType(defaultVerifyAgentType)
  }, [defaultVerifyAgentType])

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
        </div>
      )}
    </section>
  )
}

/**
 * Account Section - shows user info and sign out option
 */
function AccountSection() {
  const { data: session } = trpc.github.getSession.useQuery()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.reload()
  }

  // Only show if authenticated
  if (!session?.authenticated || !session.username) {
    return null
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Account</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Manage your GitHub account connection.
      </p>

      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
            {session.username[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium">{session.username}</div>
            <div className="text-xs text-muted-foreground">Connected via GitHub</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
    </section>
  )
}
