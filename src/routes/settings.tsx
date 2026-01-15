/**
 * Settings Route - User preferences including brand color and audio notifications
 */

import { createFileRoute } from "@tanstack/react-router"
import { useState, useRef } from "react"
import { Settings, Palette, Check, Volume2, Play, Loader2 } from "lucide-react"
import { useSettingsStore, applyBrandHue } from "@/lib/stores/settings"
import { trpc } from "@/lib/trpc-client"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

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
    brandHue,
    setBrandHue,
    audioEnabled,
    setAudioEnabled,
    selectedVoiceId,
    setSelectedVoiceId,
  } = useSettingsStore()

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
      })

      if (audioRef.current) {
        audioRef.current.src = result.audioDataUrl
        audioRef.current.play()
      }
    } catch (error) {
      console.error("Failed to generate audio:", error)
    } finally {
      setIsGenerating(null)
    }
  }

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId)
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border h-12 px-4 flex items-center">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-bold">Settings</h1>
        </div>
      </header>

      <div className="p-4 max-w-2xl">
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
                  <Loader2 className="w-3 h-3 animate-spin" />
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
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
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
                    <Loader2 className="w-3 h-3 animate-spin" />
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
      </div>
    </div>
  )
}
