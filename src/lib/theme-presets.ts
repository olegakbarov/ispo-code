/**
 * Theme Presets
 *
 * Predefined color schemes based on Ivy League + Stanford university colors.
 * Most themes only change the brand hue for accent colors.
 * Accessibility themes (high/low contrast) can override neutral colors.
 */

export interface ThemePreset {
  id: string
  name: string
  description: string
  /** Brand hue (0-360) for accent colors derived from theme */
  brandHue: number
  /** Optional CSS variable overrides for dark mode (used by accessibility themes) */
  dark?: Record<string, string>
  /** Optional CSS variable overrides for light mode (used by accessibility themes) */
  light?: Record<string, string>
}

/**
 * Available theme presets - Ivy League + Stanford universities
 * University themes only set brandHue; accessibility themes override neutrals
 */
export const themePresets: ThemePreset[] = [
  {
    id: "harvard",
    name: "Harvard",
    description: "Crimson red accents",
    brandHue: 15,
  },
  {
    id: "yale",
    name: "Yale",
    description: "Yale Blue accents",
    brandHue: 250,
  },
  {
    id: "princeton",
    name: "Princeton",
    description: "Tiger orange accents",
    brandHue: 55,
  },
  {
    id: "columbia",
    name: "Columbia",
    description: "Columbia Blue accents",
    brandHue: 230,
  },
  {
    id: "penn",
    name: "Penn",
    description: "Penn Blue accents",
    brandHue: 240,
  },
  {
    id: "brown",
    name: "Brown",
    description: "Brown Seal accents",
    brandHue: 30,
  },
  {
    id: "dartmouth",
    name: "Dartmouth",
    description: "Dartmouth Green accents",
    brandHue: 155,
  },
  {
    id: "cornell",
    name: "Cornell",
    description: "Carnelian red accents",
    brandHue: 25,
  },
  {
    id: "stanford",
    name: "Stanford",
    description: "Cardinal red accents",
    brandHue: 20,
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Maximum contrast for accessibility",
    brandHue: 220,
    dark: {
      "--background": "oklch(0.1 0 0)",
      "--foreground": "oklch(1 0 0)",
      "--card": "oklch(0.15 0 0)",
      "--card-foreground": "oklch(1 0 0)",
      "--popover": "oklch(0.15 0 0)",
      "--popover-foreground": "oklch(1 0 0)",
      "--secondary": "oklch(0.25 0 0)",
      "--secondary-foreground": "oklch(1 0 0)",
      "--muted": "oklch(0.25 0 0)",
      "--muted-foreground": "oklch(0.75 0 0)",
      "--muted-foreground-subtle": "oklch(0.6 0 0)",
      "--muted-foreground-faint": "oklch(0.45 0 0)",
      "--border": "oklch(0.45 0 0)",
      "--input": "oklch(0.2 0 0)",
    },
    light: {
      "--background": "oklch(1 0 0)",
      "--foreground": "oklch(0 0 0)",
      "--card": "oklch(0.98 0 0)",
      "--card-foreground": "oklch(0 0 0)",
      "--popover": "oklch(0.98 0 0)",
      "--popover-foreground": "oklch(0 0 0)",
      "--secondary": "oklch(0.92 0 0)",
      "--secondary-foreground": "oklch(0 0 0)",
      "--muted": "oklch(0.92 0 0)",
      "--muted-foreground": "oklch(0.3 0 0)",
      "--muted-foreground-subtle": "oklch(0.4 0 0)",
      "--muted-foreground-faint": "oklch(0.55 0 0)",
      "--border": "oklch(0.7 0 0)",
      "--input": "oklch(0.95 0 0)",
    },
  },
  {
    id: "low-contrast",
    name: "Low Contrast",
    description: "Softer, reduced contrast theme",
    brandHue: 220,
    dark: {
      "--background": "oklch(0.25 0 0)",
      "--foreground": "oklch(0.75 0 0)",
      "--card": "oklch(0.28 0 0)",
      "--card-foreground": "oklch(0.75 0 0)",
      "--popover": "oklch(0.28 0 0)",
      "--popover-foreground": "oklch(0.75 0 0)",
      "--secondary": "oklch(0.32 0 0)",
      "--secondary-foreground": "oklch(0.75 0 0)",
      "--muted": "oklch(0.32 0 0)",
      "--muted-foreground": "oklch(0.55 0 0)",
      "--muted-foreground-subtle": "oklch(0.45 0 0)",
      "--muted-foreground-faint": "oklch(0.35 0 0)",
      "--border": "oklch(0.35 0 0)",
      "--input": "oklch(0.3 0 0)",
    },
    light: {
      "--background": "oklch(0.95 0 0)",
      "--foreground": "oklch(0.3 0 0)",
      "--card": "oklch(0.93 0 0)",
      "--card-foreground": "oklch(0.3 0 0)",
      "--popover": "oklch(0.93 0 0)",
      "--popover-foreground": "oklch(0.3 0 0)",
      "--secondary": "oklch(0.9 0 0)",
      "--secondary-foreground": "oklch(0.35 0 0)",
      "--muted": "oklch(0.9 0 0)",
      "--muted-foreground": "oklch(0.5 0 0)",
      "--muted-foreground-subtle": "oklch(0.58 0 0)",
      "--muted-foreground-faint": "oklch(0.68 0 0)",
      "--border": "oklch(0.85 0 0)",
      "--input": "oklch(0.92 0 0)",
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
 * Default theme ID - Yale Blue
 */
export const DEFAULT_THEME_ID = "yale"
