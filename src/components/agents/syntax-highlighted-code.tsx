/**
 * Syntax highlighted code component
 * Renders code with shiki syntax highlighting
 */

import { memo, useState, useEffect } from "react"
import {
  highlightCode,
  detectLanguage,
  stripLineNumbers,
  type SupportedLanguage,
} from "@/lib/utils/syntax-highlighter"

interface SyntaxHighlightedCodeProps {
  /** The code content to highlight */
  content: string
  /** File path for language detection */
  filePath?: string
  /** Override language detection */
  language?: SupportedLanguage
  /** Show line numbers (uses numbers from content if present, otherwise adds them) */
  showLineNumbers?: boolean
  /** Starting line number */
  startLine?: number
  /** Additional CSS classes */
  className?: string
}

export const SyntaxHighlightedCode = memo(function SyntaxHighlightedCode({
  content,
  filePath,
  language,
  showLineNumbers = false,
  startLine = 1,
  className = "",
}: SyntaxHighlightedCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  // Check if content has line numbers from read tool
  const hasReadToolLineNumbers = content.split("\n").slice(0, 3).every((line) => /^\s*\d+\|/.test(line))

  // Process content - strip line numbers if present
  const { code, startLine: extractedStartLine } = hasReadToolLineNumbers
    ? stripLineNumbers(content)
    : { code: content, startLine }

  const effectiveStartLine = hasReadToolLineNumbers ? extractedStartLine : startLine

  useEffect(() => {
    let cancelled = false

    const lang = language || detectLanguage(filePath, code)

    highlightCode(code, { language: lang, filePath })
      .then((result) => {
        if (!cancelled) {
          setHighlightedHtml(result.html)
        }
      })
      .catch((error) => {
        console.warn("Highlighting failed:", error)
        if (!cancelled) {
          setHighlightedHtml(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [code, filePath, language])

  // Show line numbers if requested or if the original content had them
  const shouldShowLineNumbers = showLineNumbers || hasReadToolLineNumbers

  // Render fallback while loading or if highlighting failed
  if (!highlightedHtml) {
    return (
      <pre className={`font-mono text-xs overflow-x-auto ${className}`}>
        <code>
          {shouldShowLineNumbers
            ? code.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="text-text-muted select-none pr-3 text-right min-w-[3ch]">
                    {effectiveStartLine + i}
                  </span>
                  <span>{line}</span>
                </div>
              ))
            : code}
        </code>
      </pre>
    )
  }

  // If we need line numbers, we need to wrap the shiki output
  if (shouldShowLineNumbers) {
    // Parse the highlighted HTML and add line numbers
    // Shiki outputs: <pre class="shiki ..."><code>...spans...</code></pre>
    // We need to wrap each line with a line number
    return (
      <div className={`font-mono text-xs overflow-x-auto ${className}`}>
        <div
          className="syntax-highlighted-with-lines"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
        <style>{`
          .syntax-highlighted-with-lines .shiki {
            background: transparent !important;
            padding: 0;
            margin: 0;
          }
          .syntax-highlighted-with-lines .shiki code {
            counter-reset: line ${effectiveStartLine - 1};
          }
          .syntax-highlighted-with-lines .shiki code > .line {
            display: block;
          }
          .syntax-highlighted-with-lines .shiki code > .line::before {
            counter-increment: line;
            content: counter(line);
            display: inline-block;
            width: 3ch;
            margin-right: 1ch;
            text-align: right;
            color: var(--color-text-muted);
            user-select: none;
          }
        `}</style>
      </div>
    )
  }

  // Simple rendering without line numbers
  return (
    <div
      className={`font-mono text-xs overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      style={{
        // Override shiki's default backgrounds
      }}
    />
  )
})

/**
 * Language badge component to show detected/specified language
 */
export function LanguageBadge({ language }: { language: SupportedLanguage }) {
  if (language === "plain") return null

  const displayName = language === "typescript" ? "TS"
    : language === "javascript" ? "JS"
    : language === "tsx" ? "TSX"
    : language === "jsx" ? "JSX"
    : language === "json" ? "JSON"
    : language === "bash" ? "Shell"
    : language === "shellscript" ? "Shell"
    : language === "markdown" ? "MD"
    : language === "css" ? "CSS"
    : language === "html" ? "HTML"
    : language.toUpperCase()

  return (
    <span className="text-[8px] text-text-muted bg-muted/30 px-1 py-0.5 rounded">
      {displayName}
    </span>
  )
}
