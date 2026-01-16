/**
 * Tool parameter display v2
 * Monospace grid layout with staggered fade-in animations
 */

import { useState, useEffect } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToolParamDisplayV2Props {
  toolInput: unknown
  expanded: boolean
  toolColor?: string
}

/**
 * Get semantic value type for coloring
 */
function getValueType(key: string, value: unknown): "path" | "command" | "pattern" | "content" | "number" | "boolean" | "default" {
  if (key === "path" || key === "file_path" || key === "file" || key.endsWith("_path")) return "path"
  if (key === "command" || key === "cmd") return "command"
  if (key === "pattern" || key === "pat" || key === "glob" || key === "regex") return "pattern"
  if (key === "content" || key === "old_string" || key === "new_string" || key === "old" || key === "new") return "content"
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  return "default"
}

/**
 * Format parameter value for display
 */
function formatParamValue(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value === null || value === undefined) return "(empty)"
  return JSON.stringify(value, null, 2)
}

/**
 * Truncate content for collapsed view
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + "..."
}

export function ToolParamDisplayV2({ toolInput, expanded, toolColor }: ToolParamDisplayV2Props) {
  const [visibleRows, setVisibleRows] = useState<number[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Staggered reveal animation
  useEffect(() => {
    if (!expanded) {
      setVisibleRows([])
      return
    }

    if (typeof toolInput !== "object" || toolInput === null) {
      setVisibleRows([0])
      return
    }

    const entries = Object.entries(toolInput)
    setVisibleRows([])

    entries.forEach((_, idx) => {
      setTimeout(() => {
        setVisibleRows(prev => [...prev, idx])
      }, idx * 40) // 40ms stagger
    })
  }, [expanded, toolInput])

  const handleCopy = async (key: string, value: unknown, e: React.MouseEvent) => {
    e.stopPropagation()
    const content = formatParamValue(value)
    await navigator.clipboard.writeText(content)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  // Non-object input
  if (typeof toolInput !== "object" || toolInput === null) {
    const content = formatParamValue(toolInput)
    const display = expanded ? content : truncateContent(content, 150)
    return (
      <pre className="tool-param-value text-xs text-text-secondary whitespace-pre-wrap font-mono">
        {display}
      </pre>
    )
  }

  const params = toolInput as Record<string, unknown>
  const entries = Object.entries(params)

  return (
    <div className="tool-params-grid space-y-0">
      {entries.map(([key, value], idx) => {
        const isVisible = visibleRows.includes(idx)
        const valueType = getValueType(key, value)
        const formattedValue = formatParamValue(value)
        const isMultiline = formattedValue.includes("\n")

        return (
          <div
            key={key}
            className={cn(
              "tool-param-row grid grid-cols-[100px_1fr_auto] gap-2 items-start py-1 border-b border-white/5 last:border-b-0 group/param",
              "transition-all duration-150",
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            )}
            style={{ transitionDelay: `${idx * 20}ms` }}
          >
            {/* Key */}
            <span className="tool-param-key font-vcr text-[10px] text-text-muted tracking-wide pt-0.5">
              {key}
            </span>

            {/* Value */}
            <div className={cn(
              "tool-param-value text-xs font-mono overflow-hidden",
              isMultiline ? "whitespace-pre-wrap" : "truncate",
              valueType === "path" && "tool-value-path",
              valueType === "command" && "tool-value-command",
              valueType === "pattern" && "tool-value-pattern",
              valueType === "content" && "tool-value-content",
              valueType === "number" && "tool-value-number",
              valueType === "boolean" && "tool-value-boolean",
              valueType === "default" && "text-text-secondary"
            )}>
              {formattedValue}
            </div>

            {/* Copy button */}
            <button
              onClick={(e) => handleCopy(key, value, e)}
              className="opacity-0 group-hover/param:opacity-100 transition-opacity p-0.5 hover:bg-white/10"
              title={`Copy ${key}`}
            >
              {copiedKey === key ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3 text-text-muted" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
