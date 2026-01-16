/**
 * Theme Variables Helper
 *
 * Functions to apply theme CSS variables to the DOM.
 */

import { getThemePreset, DEFAULT_THEME_ID } from "./theme-presets"

/**
 * Apply theme CSS variables to the document root element.
 * Call this when the theme changes or on app initialization.
 *
 * Most themes only set --brand-hue for accent colors.
 * Accessibility themes (high/low contrast) may also override neutral colors.
 *
 * @param themeId - The theme preset ID to apply
 * @param isDark - Whether dark mode is currently active
 */
export function applyThemeVariables(themeId: string, isDark: boolean): void {
  const preset = getThemePreset(themeId) ?? getThemePreset(DEFAULT_THEME_ID)
  if (!preset) return

  const root = document.documentElement

  // Always apply brand hue for accent colors
  root.style.setProperty("--brand-hue", String(preset.brandHue))

  // Clear any previous theme overrides first
  clearThemeOverrides()

  // Apply neutral color overrides if present (accessibility themes)
  const variables = isDark ? preset.dark : preset.light
  if (variables) {
    for (const [property, value] of Object.entries(variables)) {
      root.style.setProperty(property, value)
    }
  }
}

/** CSS variables that may be overridden by accessibility themes */
const THEME_OVERRIDE_VARIABLES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--muted-foreground-subtle",
  "--muted-foreground-faint",
  "--border",
  "--input",
]

/**
 * Clear theme override CSS variables from the document root.
 * This resets neutrals to CSS-defined defaults (from styles.css).
 * Called internally when switching themes.
 */
function clearThemeOverrides(): void {
  const root = document.documentElement
  for (const name of THEME_OVERRIDE_VARIABLES) {
    root.style.removeProperty(name)
  }
}

/**
 * Clear all theme CSS variables from the document root.
 * Used when resetting to CSS-defined defaults.
 */
export function clearThemeVariables(): void {
  const root = document.documentElement
  root.style.removeProperty("--brand-hue")
  clearThemeOverrides()
}
