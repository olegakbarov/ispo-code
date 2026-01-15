/**
 * Syntax highlighting utility using Shiki
 * Provides code highlighting with caching and lazy loading
 */

import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki"

// Singleton highlighter instance
let highlighterPromise: Promise<Highlighter> | null = null

// Languages we support - loaded on demand
const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "css",
  "scss",
  "html",
  "markdown",
  "bash",
  "shellscript",
  "yaml",
  "python",
  "rust",
  "go",
  "sql",
  "graphql",
  "diff",
]

// Supported language type - includes "plain" for no highlighting
export type SupportedLanguage = BundledLanguage | "plain"

/**
 * Get or create the singleton highlighter
 */
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark", "github-light"],
      langs: SUPPORTED_LANGUAGES,
    })
  }
  return highlighterPromise
}

/**
 * Map file extensions to shiki language identifiers
 */
const EXTENSION_TO_LANG: Record<string, BundledLanguage> = {
  // JavaScript/TypeScript
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  // Styles
  css: "css",
  scss: "scss",
  // Markup
  html: "html",
  htm: "html",
  md: "markdown",
  mdx: "markdown",
  // Data
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  // Shell
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  // Other
  py: "python",
  rs: "rust",
  go: "go",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  diff: "diff",
  patch: "diff",
}

/**
 * Detect language from file path or content
 */
export function detectLanguage(filePath?: string, content?: string): SupportedLanguage {
  // Try extension first
  if (filePath) {
    const ext = filePath.split(".").pop()?.toLowerCase()
    if (ext && ext in EXTENSION_TO_LANG) {
      return EXTENSION_TO_LANG[ext]
    }
  }

  // Content-based detection for common patterns
  if (content) {
    const trimmed = content.trim()

    // JSON detection
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      return "json"
    }

    // Shell output detection ($ prefix or common commands)
    if (/^\$\s/.test(trimmed) || /^(npm|git|node|yarn|pnpm|bun)\s/.test(trimmed)) {
      return "bash"
    }

    // Diff detection
    if (trimmed.startsWith("diff --") || trimmed.startsWith("@@") ||
        (trimmed.includes("+++ ") && trimmed.includes("--- "))) {
      return "diff"
    }
  }

  return "plain"
}

/**
 * Result of syntax highlighting
 */
export interface HighlightResult {
  html: string
  language: SupportedLanguage
}

/**
 * Cache for highlighted code to avoid re-processing
 */
const highlightCache = new Map<string, HighlightResult>()
const MAX_CACHE_SIZE = 100

/**
 * Generate cache key from content and options
 */
function getCacheKey(code: string, lang: SupportedLanguage, theme: string): string {
  // Use first/last 50 chars + length for key to avoid huge keys
  const codeKey = code.length <= 100
    ? code
    : `${code.slice(0, 50)}...${code.slice(-50)}:${code.length}`
  return `${lang}:${theme}:${codeKey}`
}

/**
 * Highlight code with syntax highlighting
 */
export async function highlightCode(
  code: string,
  options: {
    language?: SupportedLanguage
    filePath?: string
    theme?: "dark" | "light"
  } = {}
): Promise<HighlightResult> {
  const { theme = "dark" } = options
  const language = options.language || detectLanguage(options.filePath, code)
  const shikiTheme = theme === "dark" ? "github-dark" : "github-light"

  // Check cache
  const cacheKey = getCacheKey(code, language, shikiTheme)
  const cached = highlightCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // For plain text, skip shiki and return escaped HTML
  if (language === "plain") {
    const result: HighlightResult = {
      html: `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`,
      language: "plain",
    }
    highlightCache.set(cacheKey, result)
    return result
  }

  try {
    const highlighter = await getHighlighter()

    const html = highlighter.codeToHtml(code, {
      lang: language,
      theme: shikiTheme,
    })

    const result: HighlightResult = { html, language }

    // Cache with LRU-style eviction
    if (highlightCache.size >= MAX_CACHE_SIZE) {
      const firstKey = highlightCache.keys().next().value
      if (firstKey) highlightCache.delete(firstKey)
    }
    highlightCache.set(cacheKey, result)

    return result
  } catch (error) {
    // Fallback to plain if highlighting fails
    console.warn("Syntax highlighting failed:", error)
    return {
      html: `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`,
      language: "plain",
    }
  }
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Strip line numbers from read tool output
 * Format: "   123|code here"
 */
export function stripLineNumbers(content: string): { code: string; startLine: number } {
  const lines = content.split("\n")
  let startLine = 1

  const codeLines = lines.map((line, i) => {
    const match = line.match(/^\s*(\d+)\|(.*)$/)
    if (match) {
      if (i === 0) {
        startLine = parseInt(match[1], 10)
      }
      return match[2]
    }
    return line
  })

  return {
    code: codeLines.join("\n"),
    startLine,
  }
}

/**
 * Synchronous check if highlighter is ready
 * Useful for determining if we can use highlighting immediately
 */
export function isHighlighterReady(): boolean {
  return highlighterPromise !== null
}

/**
 * Preload the highlighter (call early in app lifecycle)
 */
export function preloadHighlighter(): void {
  getHighlighter()
}
