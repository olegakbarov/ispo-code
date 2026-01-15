/**
 * Tool result display component
 * Renders tool execution results with syntax highlighting and expand/collapse
 */

import { memo, useState } from "react"
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Copy } from "lucide-react"

interface ToolResultProps {
  content: string
  success?: boolean
  toolName?: string
}

/**
 * Detect if content is file content with line numbers (from read tool)
 */
function hasLineNumbers(content: string): boolean {
  const lines = content.split("\n").slice(0, 3)
  return lines.every((line) => /^\s*\d+\|/.test(line))
}

/**
 * Detect if content is JSON
 */
function isJSON(content: string): boolean {
  const trimmed = content.trim()
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))
}

/**
 * Detect content type for styling
 */
function detectContentType(content: string): "file" | "json" | "error" | "plain" {
  if (content.startsWith("error:")) return "error"
  if (hasLineNumbers(content)) return "file"
  if (isJSON(content)) return "json"
  return "plain"
}

export const ToolResult = memo(function ToolResult({ content, success = true, toolName }: ToolResultProps) {
  const contentType = detectContentType(content)
  const isError = !success || contentType === "error"

  const [expanded, setExpanded] = useState(content.length <= 500)
  const [copied, setCopied] = useState(false)

  const shouldTruncate = !expanded && content.length > 500
  const displayContent = shouldTruncate ? content.slice(0, 500) + "\n..." : content

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resultColor = isError ? "var(--color-error)" : "var(--color-accent-dim)"

  return (
    <div
      className="border-l-2 pl-2 py-1 group relative"
      style={{ borderLeftColor: resultColor }}
    >
      {/* Result header */}
      <div className="flex items-center gap-1.5 mb-1">
        {isError ? (
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: resultColor }} strokeWidth={2} />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: resultColor }} strokeWidth={2} />
        )}
        <span className="font-vcr text-[10px]" style={{ color: resultColor }}>
          {isError ? "ERROR" : "RESULT"}
        </span>
        {toolName && (
          <span className="text-[8px] text-text-muted">
            · {toolName}
          </span>
        )}

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted/30 rounded"
          title="Copy to clipboard"
        >
          <Copy className="w-3 h-3 text-text-muted" />
        </button>

        {/* Expand/collapse button */}
        {content.length > 500 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-muted/30 rounded"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            )}
          </button>
        )}
      </div>

      {/* Copy feedback */}
      {copied && (
        <div className="absolute top-1 right-1 text-[8px] text-accent bg-muted px-1.5 py-0.5 rounded">
          Copied!
        </div>
      )}

      {/* Result content */}
      <pre
        className={`text-xs overflow-x-auto whitespace-pre-wrap ${
          isError ? "text-error" : "text-text-secondary"
        } ${contentType === "file" ? "font-mono" : ""}`}
      >
        {displayContent}
      </pre>

      {/* Show more indicator */}
      {shouldTruncate && (
        <div className="text-[10px] text-text-muted italic mt-1">
          {content.length - 500} more characters · click to expand
        </div>
      )}
    </div>
  )
})
