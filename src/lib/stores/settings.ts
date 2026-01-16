/**
 * Settings Store
 *
 * Zustand store for user preferences including brand color and audio notifications.
 * Persists to localStorage so settings survive page refreshes.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { AgentType } from "@/lib/agent/types"
import type { PlannerAgentType } from "@/lib/agent/config"
import { DEFAULT_THEME_ID } from "@/lib/theme-presets"

interface SettingsState {
  /** Selected theme preset ID */
  themeId: string
  /** Update the theme preset */
  setThemeId: (themeId: string) => void

  /** Brand color hue (0-360 in OKLch color space) */
  brandHue: number
  /** Update the brand hue */
  setBrandHue: (hue: number) => void

  /** Audio notifications enabled */
  audioEnabled: boolean
  /** Selected ElevenLabs voice ID for notifications */
  selectedVoiceId: string | null
  /** Update audio enabled state */
  setAudioEnabled: (enabled: boolean) => void
  /** Update selected voice ID */
  setSelectedVoiceId: (voiceId: string | null) => void

  /** Default agent type for task planning */
  defaultPlanningAgentType: PlannerAgentType | null
  /** Update default planning agent type */
  setDefaultPlanningAgentType: (agentType: PlannerAgentType | null) => void

  /** Default agent type for task verification */
  defaultVerifyAgentType: AgentType | null
  /** Default model ID for task verification */
  defaultVerifyModelId: string | null
  /** Update default verify agent type */
  setDefaultVerifyAgentType: (agentType: AgentType | null) => void
  /** Update default verify model ID */
  setDefaultVerifyModelId: (modelId: string | null) => void
}

// Default hue - 220 is a nice blue
const DEFAULT_HUE = 220

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      setThemeId: (themeId) => set({ themeId }),

      brandHue: DEFAULT_HUE,
      setBrandHue: (hue) => set({ brandHue: hue }),

      audioEnabled: false,
      selectedVoiceId: null,
      setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
      setSelectedVoiceId: (voiceId) => set({ selectedVoiceId: voiceId }),

      defaultPlanningAgentType: null,
      setDefaultPlanningAgentType: (agentType) => set({ defaultPlanningAgentType: agentType }),

      defaultVerifyAgentType: null,
      defaultVerifyModelId: null,
      setDefaultVerifyAgentType: (agentType) => set({ defaultVerifyAgentType: agentType }),
      setDefaultVerifyModelId: (modelId) => set({ defaultVerifyModelId: modelId }),
    }),
    { name: "agentz-settings" }
  )
)

/**
 * Non-reactive getter for use outside React components.
 */
export const getBrandHue = () => useSettingsStore.getState().brandHue

/**
 * Apply brand hue to document CSS variables.
 * Call this on app init and when hue changes.
 */
export function applyBrandHue(hue: number) {
  document.documentElement.style.setProperty("--brand-hue", String(hue))
}
