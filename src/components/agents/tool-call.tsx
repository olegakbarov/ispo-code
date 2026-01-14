/**
 * Tool call (tool_use) display component
 * Renders agent tool invocations with icons, categories, and formatted parameters
 */

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { getToolMetadata, TOOL_CATEGORIES } from "@/lib/agent/tool-metadata"
import { ToolParamDisplay } from "./tool-param-display"
import { Badge } from "@/components/ui/badge"

interface ToolCallProps {
  toolName: string
  toolInput: unknown
  metadata?: Record<string, string | number | boolean | null>
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

export function ToolCall({ toolName, toolInput }: ToolCallProps) {
  const toolMetadata = getToolMetadata(toolName)
  const Icon = toolMetadata.icon
  const category = TOOL_CATEGORIES[toolMetadata.category]

  const [expanded, setExpanded] = useState(!shouldCollapseInput(toolInput))
  const hasInput = toolInput !== undefined && toolInput !== null

  return (
    <div
      className="border-l-2 pl-2 py-1 transition-colors hover:bg-muted/20 cursor-pointer"
      style={{ borderLeftColor: toolMetadata.color }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Tool header */}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: toolMetadata.color }}
          strokeWidth={2}
        />
        <span className="font-vcr text-[10px]" style={{ color: toolMetadata.color }}>
          {toolName}
        </span>
        <Badge
          variant="outline"
          className="text-[8px] h-4 px-1 border-current/30"
          style={{ color: toolMetadata.color, backgroundColor: `${toolMetadata.color}15` }}
        >
          {category.label}
        </Badge>
        {shouldCollapseInput(toolInput) && (
          <div className="ml-auto flex items-center">
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            )}
          </div>
        )}
      </div>

      {/* Tool parameters */}
      {hasInput && (
        <div className="mt-1">
          <ToolParamDisplay toolInput={toolInput} expanded={expanded} />
        </div>
      )}
    </div>
  )
}
