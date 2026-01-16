import { createContext, useContext, useEffect, useRef, useState } from "react"
import { getCookie, setCookie } from "@/lib/cookies"
import { useSettingsStore } from "@/lib/stores/settings"
import { applyThemeVariables } from "@/lib/theme-variables"
import { themePresets, DEFAULT_THEME_ID } from "@/lib/theme-presets"

type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_COOKIE_NAME = "theme"

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null
  const cookieTheme = getCookie(THEME_COOKIE_NAME)
  if (
    cookieTheme === "light" ||
    cookieTheme === "dark" ||
    cookieTheme === "system"
  ) {
    return cookieTheme
  }
  return null
}

function persistTheme(theme: Theme) {
  setCookie(THEME_COOKIE_NAME, theme)
}

function applyThemeToDOM(theme: Theme) {
  const root = window.document.documentElement
  root.classList.remove("light", "dark")

  if (theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches
    root.classList.add(prefersDark ? "dark" : "light")
  } else {
    root.classList.add(theme)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with "dark" to match SSR default - prevents flash
  const [theme, setThemeState] = useState<Theme>("dark")
  // Track if we've initialized from cookie to avoid applying default theme
  const initialized = useRef(false)
  // Track if settings store has hydrated from localStorage
  const [storeHydrated, setStoreHydrated] = useState(false)
  // Track the previous themeId to detect actual changes vs hydration
  const prevThemeId = useRef<string | null>(null)

  // Get theme preset from settings store
  const themeId = useSettingsStore((state) => state.themeId)

  // Listen for Zustand persist hydration
  useEffect(() => {
    const unsubscribe = useSettingsStore.persist.onFinishHydration(() => {
      setStoreHydrated(true)
    })
    // Check if already hydrated (in case hydration finished before effect ran)
    if (useSettingsStore.persist.hasHydrated()) {
      setStoreHydrated(true)
    }
    return unsubscribe
  }, [])

  // Load stored theme on mount - this is the source of truth
  useEffect(() => {
    const stored = getStoredTheme()

    if (stored) {
      setThemeState(stored)
      applyThemeToDOM(stored)
    } else {
      // No cookie - keep dark default and persist it
      persistTheme("dark")
      // DOM already has dark from SSR/inline script, no need to reapply
    }

    // Theme preset CSS variables are already applied by inline ThemeScript
    // No need to reapply here - just mark as initialized
    initialized.current = true
  }, [])

  // Apply theme to DOM when it changes AFTER initialization
  // Skip the initial render to avoid race with the init effect
  useEffect(() => {
    if (!initialized.current) return
    applyThemeToDOM(theme)
  }, [theme])

  // Apply theme preset CSS variables when theme or themeId changes
  // Only after store has hydrated to avoid flash from default -> hydrated value
  useEffect(() => {
    if (!initialized.current || !storeHydrated) return

    // Skip if this is the first time we're seeing the hydrated value
    // (the inline script already applied it)
    if (prevThemeId.current === null) {
      prevThemeId.current = themeId
      return
    }

    // Only apply if themeId actually changed (user action)
    if (prevThemeId.current !== themeId) {
      prevThemeId.current = themeId
      const isDark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      applyThemeVariables(themeId, isDark)
    }
  }, [theme, themeId, storeHydrated])

  // Re-apply theme variables when theme mode changes (not themeId)
  useEffect(() => {
    if (!initialized.current || !storeHydrated) return
    // This handles light/dark mode toggle - need to reapply with current themeId
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    applyThemeVariables(themeId, isDark)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]) // Only depend on theme, not themeId

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      applyThemeToDOM("system")
      // Also update theme variables for the new mode
      const isDark = mediaQuery.matches
      applyThemeVariables(themeId, isDark)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, themeId])

  // Wrapper that persists theme changes
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    persistTheme(newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

/**
 * Generate minimal preset map for inline script
 * Only includes data needed for early theme application
 */
function generatePresetMapScript(): string {
  const presetMap: Record<string, { brandHue: number; dark: Record<string, string>; light: Record<string, string> }> = {}
  for (const preset of themePresets) {
    presetMap[preset.id] = {
      brandHue: preset.brandHue,
      dark: preset.dark,
      light: preset.light,
    }
  }
  return JSON.stringify(presetMap)
}

/**
 * Script to be injected in head to prevent flash of wrong theme
 * Applies both dark/light mode AND theme preset CSS variables early
 */
export function ThemeScript() {
  const presetMap = generatePresetMapScript()
  const defaultThemeId = DEFAULT_THEME_ID

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var root = document.documentElement;

              // 1. Apply dark/light mode from cookie
              var theme = document.cookie.match(/theme=([^;]+)/)?.[1];
              var isDark;
              if (theme === 'light') {
                root.classList.add('light');
                isDark = false;
              } else if (theme === 'system') {
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                root.classList.add(prefersDark ? 'dark' : 'light');
                isDark = prefersDark;
              } else {
                root.classList.add('dark');
                isDark = true;
              }

              // 2. Apply theme preset CSS variables from localStorage
              var presets = ${presetMap};
              var defaultId = "${defaultThemeId}";
              var themeId = defaultId;

              try {
                var settings = localStorage.getItem('ispo-code-settings');
                if (settings) {
                  var parsed = JSON.parse(settings);
                  if (parsed.state && parsed.state.themeId) {
                    themeId = parsed.state.themeId;
                  }
                }
              } catch (e) {}

              var preset = presets[themeId] || presets[defaultId];
              if (preset) {
                var vars = isDark ? preset.dark : preset.light;
                for (var prop in vars) {
                  root.style.setProperty(prop, vars[prop]);
                }
                root.style.setProperty('--brand-hue', String(preset.brandHue));
              }
            } catch (e) {
              document.documentElement.classList.add('dark');
            }
          })();
        `,
      }}
    />
  )
}
