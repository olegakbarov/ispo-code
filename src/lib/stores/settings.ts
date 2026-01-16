/**
 * Settings Store
 *
 * Zustand store for user preferences including theme and audio notifications.
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

  /** Default agent type for task implementation */
  defaultImplementAgentType: AgentType | null
  /** Default model ID for task implementation */
  defaultImplementModelId: string | null
  /** Update default implementation agent type */
  setDefaultImplementAgentType: (agentType: AgentType | null) => void
  /** Update default implementation model ID */
  setDefaultImplementModelId: (modelId: string | null) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      setThemeId: (themeId) => set({ themeId }),

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

      defaultImplementAgentType: null,
      defaultImplementModelId: null,
      setDefaultImplementAgentType: (agentType) => set({ defaultImplementAgentType: agentType }),
      setDefaultImplementModelId: (modelId) => set({ defaultImplementModelId: modelId }),
    }),
    { name: "ispo-code-settings" }
  )
)
