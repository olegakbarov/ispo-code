/**
 * Appearance Section - theme and preset controls
 */

import { Moon, Sun, Sparkles, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/lib/stores/settings"
import { themePresets, type ThemePreset } from "@/lib/theme-presets"
import { useTheme } from "@/components/theme"

/** Generate accent color swatch from brand hue */
function getAccentColor(preset: ThemePreset, isDark: boolean): string {
  // Use the same formula as --primary in styles.css
  const lightness = isDark ? 0.65 : 0.55
  const chroma = isDark ? 0.2 : 0.22
  return `oklch(${lightness} ${chroma} ${preset.brandHue})`
}

export function AppearanceSection() {
  const { themeId, setThemeId } = useSettingsStore()
  const { theme, toggleTheme } = useTheme()

  return (
    <>
      {/* Theme Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
          <h2 className="text-sm font-semibold">Theme</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Choose between light and dark mode for the interface.
        </p>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={toggleTheme}
            variant={theme === 'dark' ? 'default' : 'outline'}
            className="flex items-center gap-2"
          >
            <Moon className="w-4 h-4" />
            <span className="text-sm">Dark</span>
          </Button>
          <Button
            type="button"
            onClick={toggleTheme}
            variant={theme === 'light' ? 'default' : 'outline'}
            className="flex items-center gap-2"
          >
            <Sun className="w-4 h-4" />
            <span className="text-sm">Light</span>
          </Button>
        </div>
      </section>

      {/* Theme Preset Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Theme Preset</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Choose accent colors for the interface. Accessibility presets also adjust contrast.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {themePresets.map((preset) => {
            const isDark = theme === 'dark'
            const accentColor = getAccentColor(preset, isDark)

            return (
              <Button
                key={preset.id}
                type="button"
                onClick={() => setThemeId(preset.id)}
                variant={themeId === preset.id ? 'default' : 'outline'}
                className="flex flex-col gap-1 p-3 h-auto items-start"
              >
                <div className="flex items-center gap-2 w-full">
                  <div
                    className="w-5 h-5 rounded-full border border-border/50"
                    style={{ background: accentColor }}
                  />
                  {themeId === preset.id && (
                    <Check className="w-3 h-3 text-primary ml-auto" />
                  )}
                </div>
                <span className="text-xs font-medium">{preset.name}</span>
                <span className="text-[10px] text-muted-foreground">{preset.description}</span>
              </Button>
            )
          })}
        </div>
      </section>
    </>
  )
}
