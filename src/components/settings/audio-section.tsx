/**
 * Audio Section - audio notification controls
 */

import { useState, useRef } from "react"
import { Volume2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useSettingsStore } from "@/lib/stores/settings"
import { trpc } from "@/lib/trpc-client"

export function AudioSection() {
  const { audioEnabled, setAudioEnabled, selectedVoiceId, setSelectedVoiceId } = useSettingsStore()

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
        phase: "Implementation", // Sample phase for preview
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
            <Button
              type="button"
              onClick={() => handlePlayPreview("completed")}
              disabled={isGenerating !== null}
              variant="outline"
              size="xs"
              className="flex items-center gap-2"
            >
              {isGenerating === "completed" ? (
                <Spinner size="xs" />
              ) : (
                <Play className="w-3 h-4" />
              )}
              Success Sound
            </Button>
            <Button
              type="button"
              onClick={() => handlePlayPreview("failed")}
              disabled={isGenerating !== null}
              variant="outline"
              size="xs"
              className="flex items-center gap-2"
            >
              {isGenerating === "failed" ? (
                <Spinner size="xs" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Failure Sound
            </Button>
          </div>
        </div>
      )}

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} className="hidden" />
    </section>
  )
}
