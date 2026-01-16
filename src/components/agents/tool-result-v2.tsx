/**
 * Tool result display component - v2
 * Industrial-utilitarian CRT aesthetic with success/error visual states
 */

import { memo, useState, useEffect, useRef } from "react"
import { ChevronDown, Copy, Check, CheckCircle2, XCircle, Activity } from "lucide-react"
import { SyntaxHighlightedCode } from "./syntax-highlighted-code"
import { detectLanguage, type SupportedLanguage } from "@/lib/utils/syntax-highlighter"
import { cn } from "@/lib/utils"

type ResultState = "streaming" | "complete"

interface ToolResultProps {
  content: string
  success?: boolean
  toolName?: string
  filePath?: string
  /** Whether result is still streaming */
  state?: ResultState
}

/**
 * Detect if content is file content with line numbers
 */
function hasLineNumbers(content: string): boolean {
  const lines = content.split("\n").slice(0, 3)
  return lines.every((line) => /^\s*\d+[→|]/.test(line))
}

/**
 * Detect if content is JSON
 */
function isJSON(content: string): boolean {
  const trimmed = content.trim()
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))
}

type ContentType = "file" | "json" | "shell" | "error" | "plain"

function detectContentType(content: string, toolName?: string): ContentType {
  if (content.startsWith("error:") || content.startsWith("Error:")) return "error"
  if (hasLineNumbers(content)) return "file"
  if (isJSON(content)) return "json"
  if (toolName && (toolName.toLowerCase().includes("bash") || toolName.toLowerCase().includes("exec") || toolName.toLowerCase().includes("shell"))) {
    return "shell"
  }
  return "plain"
}

function getLanguageForContent(contentType: ContentType, filePath?: string, content?: string): SupportedLanguage {
  switch (contentType) {
    case "json": return "json"
    case "shell": return "bash"
    case "file": return detectLanguage(filePath, content)
    default: return "plain"
  }
}

function shouldHighlight(contentType: ContentType): boolean {
  return contentType === "file" || contentType === "json" || contentType === "shell"
}

/**
 * Calculate metadata from content
 */
function getContentMeta(content: string): { lines: number; bytes: number } {
  return {
    lines: content.split("\n").length,
    bytes: new Blob([content]).size
  }
}

export const ToolResultV2 = memo(function ToolResultV2({
  content,
  success = true,
  toolName,
  filePath,
  state = "complete"
}: ToolResultProps) {
  const contentType = detectContentType(content, toolName)
  const isError = !success || contentType === "error"
  const meta = getContentMeta(content)

  const [expanded, setExpanded] = useState(content.length <= 500)
  const [copied, setCopied] = useState(false)
  const [showPulse, setShowPulse] = useState(false)
  const prevContentRef = useRef(content)

  // Pulse animation when new data arrives
  useEffect(() => {
    if (content !== prevContentRef.current && state === "streaming") {
      setShowPulse(true)
      const timer = setTimeout(() => setShowPulse(false), 300)
      prevContentRef.current = content
      return () => clearTimeout(timer)
    }
  }, [content, state])

  const shouldTruncate = !expanded && content.length > 500
  const displayContent = shouldTruncate ? content.slice(0, 500) + "\n..." : content

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resultColor = isError ? "var(--color-error)" : "var(--color-accent-dim)"
  const useHighlighting = shouldHighlight(contentType) && !isError
  const language = getLanguageForContent(contentType, filePath, content)

  return (
    <div
      className={cn(
        "tool-result-v2 relative overflow-hidden group",
        showPulse && "tool-result-pulse"
      )}
      style={{ "--result-color": resultColor } as React.CSSProperties}
    >
      {/* Scanline overlay */}
      <div className="tool-scanlines absolute inset-0 pointer-events-none z-10" />

      {/* Header bar */}
      <div
        className={cn(
          "tool-result-header flex items-center gap-2 px-2 py-1.5",
          isError ? "bg-red-500/10" : "bg-green-500/5"
        )}
      >
        {/* Status icon */}
        <div
          className={cn(
            "tool-result-icon flex items-center justify-center w-5 h-5 flex-shrink-0",
            state === "streaming" && "animate-pulse"
          )}
          style={{ color: resultColor }}
        >
          {state === "streaming" ? (
            <Activity className="w-3.5 h-3.5" strokeWidth={2.5} />
          ) : isError ? (
            <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          )}
        </div>

        {/* Status label */}
        <span
          className="tool-result-label font-vcr text-[11px] tracking-wider"
          style={{ color: resultColor }}
        >
          {state === "streaming" ? "RECV" : isError ? "ERR" : "OK"}
        </span>

        {/* Tool name */}
        {toolName && (
          <span className="text-[10px] text-text-muted font-mono">
            {toolName}
          </span>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 text-[9px] text-text-muted font-mono ml-auto">
          <span>{meta.lines}L</span>
          <span>{meta.bytes}B</span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="tool-action-btn p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
          title="Copy result"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-text-muted" />
          )}
        </button>

        {/* Expand/collapse */}
        {content.length > 500 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="tool-expand-btn p-0.5 hover:bg-white/10 transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="tool-result-content px-2 py-2">
        {useHighlighting ? (
          <SyntaxHighlightedCode
            content={displayContent}
            filePath={filePath}
            language={language}
            showLineNumbers={contentType === "file"}
            className="text-text-secondary"
          />
        ) : (
          <pre
            className={cn(
              "text-xs overflow-x-auto whitespace-pre-wrap font-mono",
              isError ? "text-error" : "text-text-secondary"
            )}
          >
            {displayContent}
          </pre>
        )}
      </div>

      {/* Truncation indicator */}
      {shouldTruncate && (
        <div
          className="tool-result-truncated flex items-center justify-between px-2 py-1 border-t border-white/5 cursor-pointer hover:bg-white/5"
          onClick={() => setExpanded(true)}
        >
          <span className="text-[10px] text-text-muted font-mono">
            +{content.length - 500} chars
          </span>
          <span className="text-[9px] text-text-muted font-vcr">
            EXPAND
          </span>
        </div>
      )}

      {/* Streaming indicator */}
      {state === "streaming" && (
        <div className="tool-result-stream absolute bottom-0 left-0 right-0 h-0.5">
          <div
            className="h-full animate-tool-stream"
            style={{ backgroundColor: resultColor }}
          />
        </div>
      )}
    </div>
  )
})
