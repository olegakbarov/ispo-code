/**
 * Theme Presets
 *
 * Predefined color schemes that modify CSS variables.
 * Each theme provides values for both light and dark modes.
 */

export interface ThemePreset {
  id: string
  name: string
  description: string
  /** CSS variables for dark mode */
  dark: Record<string, string>
  /** CSS variables for light mode */
  light: Record<string, string>
}

/**
 * Available theme presets
 */
export const themePresets: ThemePreset[] = [
  {
    id: "default",
    name: "Default",
    description: "Pure black/white with brand hue accent",
    dark: {
      "--background": "oklch(0 0 0)",
      "--foreground": "oklch(0.85 0 0)",
      "--card": "oklch(0.08 0 0)",
      "--card-foreground": "oklch(0.85 0 0)",
      "--popover": "oklch(0.08 0 0)",
      "--popover-foreground": "oklch(0.85 0 0)",
      "--secondary": "oklch(0.18 0 0)",
      "--secondary-foreground": "oklch(0.85 0 0)",
      "--muted": "oklch(0.18 0 0)",
      "--muted-foreground": "oklch(0.65 0 0)",
      "--muted-foreground-subtle": "oklch(0.5 0 0)",
      "--muted-foreground-faint": "oklch(0.35 0 0)",
      "--border": "oklch(0.18 0 0)",
      "--input": "oklch(0.12 0 0)",
    },
    light: {
      "--background": "oklch(0.98 0 0)",
      "--foreground": "oklch(0.15 0 0)",
      "--card": "oklch(0.96 0 0)",
      "--card-foreground": "oklch(0.15 0 0)",
      "--popover": "oklch(0.96 0 0)",
      "--popover-foreground": "oklch(0.15 0 0)",
      "--secondary": "oklch(0.94 0 0)",
      "--secondary-foreground": "oklch(0.25 0 0)",
      "--muted": "oklch(0.94 0 0)",
      "--muted-foreground": "oklch(0.45 0 0)",
      "--muted-foreground-subtle": "oklch(0.55 0 0)",
      "--muted-foreground-faint": "oklch(0.7 0 0)",
      "--border": "oklch(0.88 0 0)",
      "--input": "oklch(0.96 0 0)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep blue-tinted dark theme",
    dark: {
      "--background": "oklch(0.08 0.02 260)",
      "--foreground": "oklch(0.9 0.01 260)",
      "--card": "oklch(0.12 0.025 260)",
      "--card-foreground": "oklch(0.9 0.01 260)",
      "--popover": "oklch(0.12 0.025 260)",
      "--popover-foreground": "oklch(0.9 0.01 260)",
      "--secondary": "oklch(0.2 0.03 260)",
      "--secondary-foreground": "oklch(0.9 0.01 260)",
      "--muted": "oklch(0.2 0.025 260)",
      "--muted-foreground": "oklch(0.65 0.02 260)",
      "--muted-foreground-subtle": "oklch(0.5 0.015 260)",
      "--muted-foreground-faint": "oklch(0.35 0.01 260)",
      "--border": "oklch(0.22 0.03 260)",
      "--input": "oklch(0.14 0.02 260)",
    },
    light: {
      "--background": "oklch(0.97 0.01 260)",
      "--foreground": "oklch(0.2 0.03 260)",
      "--card": "oklch(0.95 0.015 260)",
      "--card-foreground": "oklch(0.2 0.03 260)",
      "--popover": "oklch(0.95 0.015 260)",
      "--popover-foreground": "oklch(0.2 0.03 260)",
      "--secondary": "oklch(0.92 0.02 260)",
      "--secondary-foreground": "oklch(0.25 0.03 260)",
      "--muted": "oklch(0.92 0.02 260)",
      "--muted-foreground": "oklch(0.45 0.02 260)",
      "--muted-foreground-subtle": "oklch(0.55 0.015 260)",
      "--muted-foreground-faint": "oklch(0.7 0.01 260)",
      "--border": "oklch(0.85 0.025 260)",
      "--input": "oklch(0.94 0.015 260)",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Earthy green-tinted theme",
    dark: {
      "--background": "oklch(0.08 0.015 145)",
      "--foreground": "oklch(0.88 0.02 145)",
      "--card": "oklch(0.12 0.02 145)",
      "--card-foreground": "oklch(0.88 0.02 145)",
      "--popover": "oklch(0.12 0.02 145)",
      "--popover-foreground": "oklch(0.88 0.02 145)",
      "--secondary": "oklch(0.2 0.025 145)",
      "--secondary-foreground": "oklch(0.88 0.02 145)",
      "--muted": "oklch(0.2 0.02 145)",
      "--muted-foreground": "oklch(0.65 0.02 145)",
      "--muted-foreground-subtle": "oklch(0.5 0.015 145)",
      "--muted-foreground-faint": "oklch(0.35 0.01 145)",
      "--border": "oklch(0.22 0.025 145)",
      "--input": "oklch(0.14 0.02 145)",
    },
    light: {
      "--background": "oklch(0.97 0.015 145)",
      "--foreground": "oklch(0.2 0.03 145)",
      "--card": "oklch(0.95 0.02 145)",
      "--card-foreground": "oklch(0.2 0.03 145)",
      "--popover": "oklch(0.95 0.02 145)",
      "--popover-foreground": "oklch(0.2 0.03 145)",
      "--secondary": "oklch(0.92 0.025 145)",
      "--secondary-foreground": "oklch(0.25 0.03 145)",
      "--muted": "oklch(0.92 0.02 145)",
      "--muted-foreground": "oklch(0.45 0.02 145)",
      "--muted-foreground-subtle": "oklch(0.55 0.015 145)",
      "--muted-foreground-faint": "oklch(0.7 0.01 145)",
      "--border": "oklch(0.85 0.02 145)",
      "--input": "oklch(0.94 0.02 145)",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Warm pink-tinted theme",
    dark: {
      "--background": "oklch(0.08 0.015 350)",
      "--foreground": "oklch(0.9 0.01 350)",
      "--card": "oklch(0.12 0.02 350)",
      "--card-foreground": "oklch(0.9 0.01 350)",
      "--popover": "oklch(0.12 0.02 350)",
      "--popover-foreground": "oklch(0.9 0.01 350)",
      "--secondary": "oklch(0.2 0.025 350)",
      "--secondary-foreground": "oklch(0.9 0.01 350)",
      "--muted": "oklch(0.2 0.02 350)",
      "--muted-foreground": "oklch(0.65 0.015 350)",
      "--muted-foreground-subtle": "oklch(0.5 0.01 350)",
      "--muted-foreground-faint": "oklch(0.35 0.008 350)",
      "--border": "oklch(0.22 0.025 350)",
      "--input": "oklch(0.14 0.018 350)",
    },
    light: {
      "--background": "oklch(0.98 0.01 350)",
      "--foreground": "oklch(0.2 0.025 350)",
      "--card": "oklch(0.96 0.015 350)",
      "--card-foreground": "oklch(0.2 0.025 350)",
      "--popover": "oklch(0.96 0.015 350)",
      "--popover-foreground": "oklch(0.2 0.025 350)",
      "--secondary": "oklch(0.94 0.02 350)",
      "--secondary-foreground": "oklch(0.25 0.025 350)",
      "--muted": "oklch(0.94 0.018 350)",
      "--muted-foreground": "oklch(0.45 0.02 350)",
      "--muted-foreground-subtle": "oklch(0.55 0.015 350)",
      "--muted-foreground-faint": "oklch(0.7 0.01 350)",
      "--border": "oklch(0.88 0.02 350)",
      "--input": "oklch(0.96 0.015 350)",
    },
  },
  {
    id: "coffee",
    name: "Coffee",
    description: "Warm brown sepia tones",
    dark: {
      "--background": "oklch(0.1 0.02 55)",
      "--foreground": "oklch(0.88 0.03 55)",
      "--card": "oklch(0.14 0.025 55)",
      "--card-foreground": "oklch(0.88 0.03 55)",
      "--popover": "oklch(0.14 0.025 55)",
      "--popover-foreground": "oklch(0.88 0.03 55)",
      "--secondary": "oklch(0.22 0.03 55)",
      "--secondary-foreground": "oklch(0.88 0.03 55)",
      "--muted": "oklch(0.22 0.025 55)",
      "--muted-foreground": "oklch(0.65 0.025 55)",
      "--muted-foreground-subtle": "oklch(0.5 0.02 55)",
      "--muted-foreground-faint": "oklch(0.35 0.015 55)",
      "--border": "oklch(0.25 0.03 55)",
      "--input": "oklch(0.16 0.022 55)",
    },
    light: {
      "--background": "oklch(0.96 0.02 55)",
      "--foreground": "oklch(0.25 0.04 55)",
      "--card": "oklch(0.94 0.025 55)",
      "--card-foreground": "oklch(0.25 0.04 55)",
      "--popover": "oklch(0.94 0.025 55)",
      "--popover-foreground": "oklch(0.25 0.04 55)",
      "--secondary": "oklch(0.9 0.03 55)",
      "--secondary-foreground": "oklch(0.3 0.04 55)",
      "--muted": "oklch(0.9 0.025 55)",
      "--muted-foreground": "oklch(0.5 0.03 55)",
      "--muted-foreground-subtle": "oklch(0.6 0.025 55)",
      "--muted-foreground-faint": "oklch(0.72 0.02 55)",
      "--border": "oklch(0.82 0.03 55)",
      "--input": "oklch(0.92 0.025 55)",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Cool gray with subtle blue",
    dark: {
      "--background": "oklch(0.1 0.008 240)",
      "--foreground": "oklch(0.88 0.005 240)",
      "--card": "oklch(0.14 0.01 240)",
      "--card-foreground": "oklch(0.88 0.005 240)",
      "--popover": "oklch(0.14 0.01 240)",
      "--popover-foreground": "oklch(0.88 0.005 240)",
      "--secondary": "oklch(0.22 0.012 240)",
      "--secondary-foreground": "oklch(0.88 0.005 240)",
      "--muted": "oklch(0.22 0.01 240)",
      "--muted-foreground": "oklch(0.62 0.008 240)",
      "--muted-foreground-subtle": "oklch(0.48 0.006 240)",
      "--muted-foreground-faint": "oklch(0.35 0.004 240)",
      "--border": "oklch(0.25 0.012 240)",
      "--input": "oklch(0.16 0.008 240)",
    },
    light: {
      "--background": "oklch(0.97 0.006 240)",
      "--foreground": "oklch(0.2 0.012 240)",
      "--card": "oklch(0.95 0.008 240)",
      "--card-foreground": "oklch(0.2 0.012 240)",
      "--popover": "oklch(0.95 0.008 240)",
      "--popover-foreground": "oklch(0.2 0.012 240)",
      "--secondary": "oklch(0.92 0.01 240)",
      "--secondary-foreground": "oklch(0.25 0.012 240)",
      "--muted": "oklch(0.92 0.008 240)",
      "--muted-foreground": "oklch(0.45 0.01 240)",
      "--muted-foreground-subtle": "oklch(0.55 0.008 240)",
      "--muted-foreground-faint": "oklch(0.7 0.006 240)",
      "--border": "oklch(0.85 0.01 240)",
      "--input": "oklch(0.94 0.008 240)",
    },
  },
]

/**
 * Get a theme preset by ID
 */
export function getThemePreset(id: string): ThemePreset | undefined {
  return themePresets.find((t) => t.id === id)
}

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = "default"
