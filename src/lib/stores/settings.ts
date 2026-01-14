/**
 * Settings Store
 *
 * Zustand store for user preferences including brand color.
 * Persists to localStorage so settings survive page refreshes.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsState {
  /** Brand color hue (0-360 in OKLch color space) */
  brandHue: number
  /** Update the brand hue */
  setBrandHue: (hue: number) => void
}

// Default hue - 220 is a nice blue
const DEFAULT_HUE = 220

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      brandHue: DEFAULT_HUE,
      setBrandHue: (hue) => set({ brandHue: hue }),
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
