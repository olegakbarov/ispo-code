/**
 * Audio tRPC Router
 *
 * Endpoints for ElevenLabs TTS integration:
 * - List available voices
 * - Generate sample audio for preview
 * - Generate notification audio for completion/failure events
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import {
  listVoices as elevenLabsListVoices,
  generateSpeech,
  isConfigured,
} from "@/lib/audio/elevenlabs-client"
import { getTaskSnippet } from "@/lib/utils/task-title"

/** In-memory cache for generated audio (voiceId + text -> base64 data URL) */
const audioCache = new Map<string, string>()

/** Cache key generator */
function cacheKey(voiceId: string, text: string): string {
  return `${voiceId}:${text}`
}

/** Default notification messages */
const NOTIFICATION_MESSAGES = {
  completed: "Task completed successfully",
  failed: "Task failed",
} as const

function notificationText(type: "completed" | "failed", count?: number): string {
  if (!count || count <= 1) {
    return NOTIFICATION_MESSAGES[type]
  }

  if (type === "completed") {
    return `${count} tasks completed successfully`
  }

  return `${count} tasks failed`
}

export const audioRouter = router({
  /**
   * Check if ElevenLabs API is configured
   */
  isConfigured: procedure.query(() => {
    return isConfigured()
  }),

  /**
   * List available ElevenLabs voices.
   * Returns simplified voice metadata for UI selection.
   */
  listVoices: procedure.query(async () => {
    if (!isConfigured()) {
      return []
    }

    const voices = await elevenLabsListVoices()
    return voices.map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url,
      category: v.category,
    }))
  }),

  /**
   * Generate a sample audio clip with custom text.
   * Used for preview in settings UI.
   */
  generateSample: procedure
    .input(
      z.object({
        voiceId: z.string(),
        text: z.string().max(500),
      })
    )
    .mutation(async ({ input }) => {
      const key = cacheKey(input.voiceId, input.text)

      // Check cache first
      const cached = audioCache.get(key)
      if (cached) {
        return { audioDataUrl: cached }
      }

      // Generate new audio
      const audioDataUrl = await generateSpeech(input.voiceId, input.text)

      // Cache the result
      audioCache.set(key, audioDataUrl)

      return { audioDataUrl }
    }),

  /**
   * Generate notification audio for completion events.
   * Uses predefined messages based on notification type, optionally including task title snippet.
   */
  generateNotification: procedure
    .input(
      z.object({
        voiceId: z.string(),
        type: z.enum(["completed", "failed"]),
        taskTitle: z.string().optional(),
        count: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Build notification text with task context if available
      let text = notificationText(input.type, input.count)
      if (input.taskTitle && (!input.count || input.count <= 1)) {
        const snippet = getTaskSnippet(input.taskTitle)
        if (snippet) {
          // Format: "Task completed successfully: first five words"
          text = `${text}: ${snippet}`
        }
      }

      const key = cacheKey(input.voiceId, text)

      // Check cache first
      const cached = audioCache.get(key)
      if (cached) {
        return { audioDataUrl: cached }
      }

      // Generate new audio
      const audioDataUrl = await generateSpeech(input.voiceId, text)

      // Cache the result
      audioCache.set(key, audioDataUrl)

      return { audioDataUrl }
    }),
})
