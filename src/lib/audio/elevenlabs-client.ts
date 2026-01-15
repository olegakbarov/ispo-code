/**
 * ElevenLabs TTS API Client
 *
 * Server-side client for ElevenLabs text-to-speech API.
 * Used to generate audio notifications when agent sessions complete.
 */

import { ensureServerEnv } from "@/lib/server/env"

const BASE_URL = "https://api.elevenlabs.io/v1"

/** Voice metadata from ElevenLabs API */
export interface ElevenLabsVoice {
  voice_id: string
  name: string
  preview_url: string
  category?: string
  labels?: Record<string, string>
}

/** Response shape from /v1/voices endpoint */
interface VoicesResponse {
  voices: ElevenLabsVoice[]
}

/**
 * Get the ElevenLabs API key from environment.
 * Ensures .env is loaded first.
 */
function getApiKey(): string {
  ensureServerEnv()
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set")
  }
  return key
}

/**
 * List all available voices from ElevenLabs.
 */
export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = getApiKey()

  const response = await fetch(`${BASE_URL}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ElevenLabs API error: ${response.status} - ${text}`)
  }

  const data = (await response.json()) as VoicesResponse
  return data.voices
}

/**
 * Generate speech from text using a specific voice.
 * Returns audio as a base64 data URL (audio/mpeg).
 */
export async function generateSpeech(
  voiceId: string,
  text: string
): Promise<string> {
  const apiKey = getApiKey()

  const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.7,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${text}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  return `data:audio/mpeg;base64,${base64}`
}

/**
 * Check if the ElevenLabs API key is configured.
 * Does not throw, returns false if not configured.
 */
export function isConfigured(): boolean {
  ensureServerEnv()
  return Boolean(process.env.ELEVENLABS_API_KEY)
}
