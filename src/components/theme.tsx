import { createContext, useContext, useEffect, useRef, useState } from "react"
import { getCookie, setCookie } from "@/lib/cookies"
import { useSettingsStore } from "@/lib/stores/settings"
import { applyThemeVariables } from "@/lib/theme-variables"

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

  // Get theme preset from settings store
  const themeId = useSettingsStore((state) => state.themeId)

  // Load stored theme on mount - this is the source of truth
  useEffect(() => {
    const stored = getStoredTheme()
    const activeTheme = stored ?? "dark"

    if (stored) {
      setThemeState(stored)
      applyThemeToDOM(stored)
    } else {
      // No cookie - keep dark default and persist it
      persistTheme("dark")
      // DOM already has dark from SSR/inline script, no need to reapply
    }

    // Apply theme preset CSS variables on initial load
    const isDark =
      activeTheme === "dark" ||
      (activeTheme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    applyThemeVariables(themeId, isDark)

    initialized.current = true
  }, [themeId])

  // Apply theme to DOM when it changes AFTER initialization
  // Skip the initial render to avoid race with the init effect
  useEffect(() => {
    if (!initialized.current) return
    applyThemeToDOM(theme)
  }, [theme])

  // Apply theme preset CSS variables when theme or themeId changes
  useEffect(() => {
    if (!initialized.current) return
    // Determine if dark mode is active
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    applyThemeVariables(themeId, isDark)
  }, [theme, themeId])

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
 * Script to be injected in head to prevent flash of wrong theme
 */
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = document.cookie.match(/theme=([^;]+)/)?.[1];
              if (theme === 'light') {
                document.documentElement.classList.add('light');
              } else if (theme === 'system') {
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.add(prefersDark ? 'dark' : 'light');
              } else {
                document.documentElement.classList.add('dark');
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
