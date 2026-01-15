/**
 * Tool result display component
 * Renders tool execution results with syntax highlighting and expand/collapse
 */

import { memo, useState } from "react"
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Copy } from "lucide-react"
import { SyntaxHighlightedCode } from "./syntax-highlighted-code"
import { detectLanguage, type SupportedLanguage } from "@/lib/utils/syntax-highlighter"

interface ToolResultProps {
  content: string
  success?: boolean
  toolName?: string
  /** File path for better language detection (from read/write tools) */
  filePath?: string
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

type ContentType = "file" | "json" | "shell" | "error" | "plain"

/**
 * Detect content type for styling and highlighting
 */
function detectContentType(content: string, toolName?: string): ContentType {
  if (content.startsWith("error:") || content.startsWith("Error:")) return "error"
  if (hasLineNumbers(content)) return "file"
  if (isJSON(content)) return "json"
  // Shell output from bash/exec tools
  if (toolName && (toolName.toLowerCase().includes("bash") || toolName.toLowerCase().includes("exec") || toolName.toLowerCase().includes("shell"))) {
    return "shell"
  }
  return "plain"
}

/**
 * Get language for highlighting based on content type and file path
 */
function getLanguageForContent(contentType: ContentType, filePath?: string, content?: string): SupportedLanguage {
  switch (contentType) {
    case "json":
      return "json"
    case "shell":
      return "bash"
    case "file":
      return detectLanguage(filePath, content)
    default:
      return "plain"
  }
}

/**
 * Determine if syntax highlighting should be applied
 */
function shouldHighlight(contentType: ContentType): boolean {
  return contentType === "file" || contentType === "json" || contentType === "shell"
}

export const ToolResult = memo(function ToolResult({ content, success = true, toolName, filePath }: ToolResultProps) {
  const contentType = detectContentType(content, toolName)
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
  const useHighlighting = shouldHighlight(contentType) && !isError
  const language = getLanguageForContent(contentType, filePath, content)

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
          className={`text-xs overflow-x-auto whitespace-pre-wrap font-mono ${
            isError ? "text-error" : "text-text-secondary"
          }`}
        >
          {displayContent}
        </pre>
      )}

      {/* Show more indicator */}
      {shouldTruncate && (
        <div className="text-[10px] text-text-muted italic mt-1">
          {content.length - 500} more characters · click to expand
        </div>
      )}
    </div>
  )
})
