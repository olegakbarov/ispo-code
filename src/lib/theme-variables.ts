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
 * @param themeId - The theme preset ID to apply
 * @param isDark - Whether dark mode is currently active
 */
export function applyThemeVariables(themeId: string, isDark: boolean): void {
  const preset = getThemePreset(themeId) ?? getThemePreset(DEFAULT_THEME_ID)
  if (!preset) return

  const variables = isDark ? preset.dark : preset.light
  const root = document.documentElement

  // Apply each CSS variable
  for (const [property, value] of Object.entries(variables)) {
    root.style.setProperty(property, value)
  }
}

/**
 * Clear all theme CSS variables from the document root.
 * Used when resetting to CSS-defined defaults.
 */
export function clearThemeVariables(): void {
  const root = document.documentElement
  const variableNames = [
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

  for (const name of variableNames) {
    root.style.removeProperty(name)
  }
}
