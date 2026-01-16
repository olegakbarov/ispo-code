/**
 * Appearance Section - theme, preset, and brand color controls
 */

import { Moon, Sun, Sparkles, Palette, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSettingsStore, applyBrandHue } from "@/lib/stores/settings"
import { themePresets } from "@/lib/theme-presets"
import { useTheme } from "@/components/theme"

// Preset color options with their hue values
const COLOR_PRESETS = [
  { name: "Blue", hue: 220 },
  { name: "Cyan", hue: 195 },
  { name: "Teal", hue: 175 },
  { name: "Green", hue: 145 },
  { name: "Lime", hue: 125 },
  { name: "Yellow", hue: 85 },
  { name: "Orange", hue: 50 },
  { name: "Red", hue: 25 },
  { name: "Pink", hue: 350 },
  { name: "Purple", hue: 280 },
  { name: "Violet", hue: 300 },
  { name: "Indigo", hue: 260 },
]

export function AppearanceSection() {
  const { themeId, setThemeId, brandHue, setBrandHue } = useSettingsStore()
  const { theme, toggleTheme } = useTheme()

  const handleHueChange = (hue: number) => {
    setBrandHue(hue)
    applyBrandHue(hue)
  }

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
          Choose a color scheme for the interface. Each preset adjusts background and surface colors.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {themePresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              onClick={() => setThemeId(preset.id)}
              variant={themeId === preset.id ? 'default' : 'outline'}
              className="flex flex-col gap-1 p-3 h-auto items-start"
            >
              <div className="flex items-center gap-2 w-full">
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: theme === 'dark'
                      ? preset.dark['--background']
                      : preset.light['--background'],
                  }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: theme === 'dark'
                      ? preset.dark['--card']
                      : preset.light['--card'],
                  }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-border/50"
                  style={{
                    background: theme === 'dark'
                      ? preset.dark['--secondary']
                      : preset.light['--secondary'],
                  }}
                />
                {themeId === preset.id && (
                  <Check className="w-3 h-3 text-primary ml-auto" />
                )}
              </div>
              <span className="text-xs font-medium">{preset.name}</span>
              <span className="text-[10px] text-muted-foreground">{preset.description}</span>
            </Button>
          ))}
        </div>
      </section>

      {/* Brand Color Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Brand Color</h2>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Choose an accent color for the interface. This affects buttons, links, and highlights throughout the app.
        </p>

        {/* Color Presets */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">
            Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                onClick={() => handleHueChange(preset.hue)}
                variant={brandHue === preset.hue ? 'default' : 'outline'}
                size="xs"
                className="flex items-center gap-2"
                style={
                  brandHue === preset.hue
                    ? {
                        borderColor: `oklch(0.65 0.2 ${preset.hue})`,
                        backgroundColor: `oklch(0.65 0.2 ${preset.hue} / 0.1)`,
                      }
                    : undefined
                }
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: `oklch(0.65 0.2 ${preset.hue})` }}
                />
                <span className="text-xs">{preset.name}</span>
                {brandHue === preset.hue && (
                  <Check className="w-3 h-3 text-primary" />
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Hue Slider */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">
            Custom Hue ({brandHue})
          </label>
          <div className="relative">
            <input
              type="range"
              min="0"
              max="360"
              value={brandHue}
              onChange={(e) => handleHueChange(Number(e.target.value))}
              className="w-full h-8 rounded-md cursor-pointer appearance-none hue-slider"
              style={{
                background: `linear-gradient(to right,
                  oklch(0.65 0.2 0),
                  oklch(0.65 0.2 60),
                  oklch(0.65 0.2 120),
                  oklch(0.65 0.2 180),
                  oklch(0.65 0.2 240),
                  oklch(0.65 0.2 300),
                  oklch(0.65 0.2 360)
                )`,
              }}
            />
            {/* Custom thumb indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{
                left: `calc(${(brandHue / 360) * 100}% - 8px)`,
                backgroundColor: `oklch(0.65 0.2 ${brandHue})`,
              }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-xs font-semibold mb-3 text-muted-foreground">
            Preview
          </h3>
          <div className="space-y-3">
            {/* Button preview */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-xs font-medium text-primary-foreground"
                style={{ backgroundColor: `oklch(0.65 0.2 ${brandHue})` }}
              >
                Primary Button
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-xs font-medium border"
                style={{
                  borderColor: `oklch(0.65 0.2 ${brandHue})`,
                  color: `oklch(0.65 0.2 ${brandHue})`,
                }}
              >
                Outline Button
              </button>
            </div>

            {/* Text preview */}
            <div>
              <span className="text-xs" style={{ color: `oklch(0.65 0.2 ${brandHue})` }}>
                Accent text color
              </span>
              <span className="text-xs text-muted-foreground"> - </span>
              <a
                href="#"
                className="text-xs underline"
                style={{ color: `oklch(0.65 0.2 ${brandHue})` }}
                onClick={(e) => e.preventDefault()}
              >
                Link example
              </a>
            </div>

            {/* Badge preview */}
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium text-primary-foreground"
                style={{ backgroundColor: `oklch(0.65 0.2 ${brandHue})` }}
              >
                Badge
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: `oklch(0.65 0.2 ${brandHue} / 0.15)`,
                  color: `oklch(0.65 0.2 ${brandHue})`,
                }}
              >
                Soft Badge
              </span>
            </div>

            {/* Focus ring preview */}
            <div>
              <input
                type="text"
                placeholder="Focus ring preview (click to focus)"
                className="w-full px-3 py-1.5 rounded-md text-xs bg-input border border-border outline-none transition-shadow"
                style={{
                  boxShadow: `0 0 0 2px oklch(0.65 0.2 ${brandHue} / 0.3)`,
                }}
                readOnly
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
