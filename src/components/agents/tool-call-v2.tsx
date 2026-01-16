/**
 * Tool call (tool_use) display component - v2
 * Industrial-utilitarian CRT aesthetic with scanlines and mechanical animations
 */

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Copy, Check } from "lucide-react"
import { getToolMetadata, TOOL_CATEGORIES } from "@/lib/agent/tool-metadata"
import { ToolParamDisplayV2 } from "./tool-param-display-v2"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ToolExecutionState = "idle" | "executing" | "complete"

interface ToolCallProps {
  toolName: string
  toolInput: unknown
  metadata?: Record<string, string | number | boolean | null>
  /** Execution state for visual feedback */
  state?: ToolExecutionState
}

/**
 * Determine if tool input should be collapsed by default
 */
function shouldCollapseInput(toolInput: unknown): boolean {
  if (typeof toolInput === "object" && toolInput !== null) {
    const paramCount = Object.keys(toolInput).length
    const jsonLength = JSON.stringify(toolInput).length
    return paramCount > 3 || jsonLength > 150
  }
  if (typeof toolInput === "string") {
    return toolInput.length > 150
  }
  return false
}

export function ToolCallV2({ toolName, toolInput, state = "complete" }: ToolCallProps) {
  const toolMetadata = getToolMetadata(toolName)
  const Icon = toolMetadata.icon
  const category = TOOL_CATEGORIES[toolMetadata.category]

  const [expanded, setExpanded] = useState(!shouldCollapseInput(toolInput))
  const [copied, setCopied] = useState(false)
  const hasInput = toolInput !== undefined && toolInput !== null
  const isCollapsible = shouldCollapseInput(toolInput)

  // Typewriter effect for tool name
  const [displayName, setDisplayName] = useState("")
  const nameRef = useRef(toolName)

  useEffect(() => {
    nameRef.current = toolName
    setDisplayName("")
    let i = 0
    const interval = setInterval(() => {
      if (i <= nameRef.current.length) {
        setDisplayName(nameRef.current.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 25)
    return () => clearInterval(interval)
  }, [toolName])

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const content = typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput, null, 2)
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleExpand = (e: React.MouseEvent) => {
    if (isCollapsible) {
      e.stopPropagation()
      setExpanded(!expanded)
    }
  }

  return (
    <div
      className={cn(
        "tool-call-v2 relative overflow-hidden",
        state === "executing" && "tool-executing"
      )}
      style={{ "--tool-color": toolMetadata.color } as React.CSSProperties}
    >
      {/* Scanline overlay */}
      <div className="tool-scanlines absolute inset-0 pointer-events-none z-10" />

      {/* Header bar - full width with category color */}
      <div
        className="tool-header flex items-center gap-2 px-2 py-1.5"
        style={{ backgroundColor: `color-mix(in oklch, ${toolMetadata.color} 15%, transparent)` }}
      >
        {/* Icon with glow */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "tool-icon-container flex items-center justify-center w-5 h-5 flex-shrink-0",
                state === "executing" && "tool-icon-pulse"
              )}
              style={{
                color: toolMetadata.color,
                filter: `drop-shadow(0 0 4px ${toolMetadata.color})`
              }}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="font-mono text-xs">
            {toolMetadata.description}
          </TooltipContent>
        </Tooltip>

        {/* Tool name with typewriter effect */}
        <span
          className="tool-name font-vcr text-[11px] tracking-wider"
          style={{ color: toolMetadata.color }}
        >
          {displayName}
          <span className="tool-cursor opacity-80">_</span>
        </span>

        {/* Category badge */}
        <span
          className="tool-category text-[9px] font-vcr px-1.5 py-0.5 tracking-wide"
          style={{
            color: toolMetadata.color,
            backgroundColor: `color-mix(in oklch, ${toolMetadata.color} 20%, transparent)`,
            border: `1px solid color-mix(in oklch, ${toolMetadata.color} 40%, transparent)`
          }}
        >
          {category.label}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasInput && (
            <button
              onClick={handleCopy}
              className="tool-action-btn p-1 hover:bg-white/10 transition-colors"
              title="Copy parameters"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3 text-text-muted" />
              )}
            </button>
          )}
        </div>

        {/* Expand/collapse indicator */}
        {isCollapsible && (
          <button
            onClick={toggleExpand}
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

      {/* Parameters section */}
      {hasInput && (
        <div
          className={cn(
            "tool-params-container overflow-hidden transition-all duration-200",
            !expanded && "max-h-0"
          )}
        >
          <div className="tool-params px-2 py-2 border-t border-white/5">
            <ToolParamDisplayV2 toolInput={toolInput} expanded={expanded} toolColor={toolMetadata.color} />
          </div>
        </div>
      )}

      {/* Collapsed params preview */}
      {hasInput && !expanded && (
        <div
          className="tool-params-preview px-2 py-1 text-[10px] text-text-muted font-mono truncate cursor-pointer"
          onClick={toggleExpand}
        >
          {typeof toolInput === "object" && toolInput !== null
            ? Object.entries(toolInput as Record<string, unknown>).slice(0, 2).map(([k, v]) =>
                `${k}=${typeof v === "string" ? v.slice(0, 30) : JSON.stringify(v).slice(0, 30)}`
              ).join(" ")
            : String(toolInput).slice(0, 60)
          }
          {isCollapsible && " ..."}
        </div>
      )}

      {/* Execution state indicator */}
      {state === "executing" && (
        <div className="tool-progress absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent animate-tool-progress" style={{ color: toolMetadata.color }} />
      )}
    </div>
  )
}
