/**
 * Tool call (tool_use) display component
 * Renders agent tool invocations with icons, categories, and formatted parameters
 */

import { useState } from "react"
import { ChevronDown, ChevronUp, Copy } from "lucide-react"
import { getToolMetadata, TOOL_CATEGORIES } from "@/lib/agent/tool-metadata"
import { ToolParamDisplay } from "./tool-param-display"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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
  const [copied, setCopied] = useState(false)
  const hasInput = toolInput !== undefined && toolInput !== null

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const content = typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput, null, 2)
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="border-l-2 pl-2 py-1 transition-colors hover:bg-muted/20 cursor-pointer group relative"
      style={{ borderLeftColor: toolMetadata.color }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Tool header */}
      <div className="flex items-center gap-1.5 mb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5">
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: toolMetadata.color }}
                strokeWidth={2}
              />
              <span className="font-vcr text-[10px]" style={{ color: toolMetadata.color }}>
                {toolName}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            {toolMetadata.description}
          </TooltipContent>
        </Tooltip>
        <Badge
          variant="outline"
          className="text-[8px] h-4 px-1 border-current/30"
          style={{ color: toolMetadata.color, backgroundColor: `${toolMetadata.color}15` }}
        >
          {category.label}
        </Badge>
        {/* Copy button - appears on hover */}
        {hasInput && (
          <button
            onClick={handleCopy}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted/30 rounded"
            title="Copy to clipboard"
          >
            <Copy className="w-3 h-3 text-text-muted" />
          </button>
        )}
        {shouldCollapseInput(toolInput) && (
          <div className="flex items-center">
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronDown className="w-3 h-3 text-text-muted" />
            )}
          </div>
        )}
      </div>

      {/* Copy feedback */}
      {copied && (
        <div className="absolute top-1 right-1 text-[8px] text-accent bg-muted px-1.5 py-0.5 rounded">
          Copied!
        </div>
      )}

      {/* Tool parameters */}
      {hasInput && (
        <div className="mt-1">
          <ToolParamDisplay toolInput={toolInput} expanded={expanded} />
        </div>
      )}
    </div>
  )
}
