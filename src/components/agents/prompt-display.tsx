/**
 * Collapsible prompt display with optional plan link
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react'
import { Link } from '@tanstack/react-router'

interface PromptDisplayProps {
  prompt: string
  planPath?: string
  taskPath?: string
  isResumable?: boolean
}

export function PromptDisplay({ prompt, planPath, taskPath, isResumable }: PromptDisplayProps) {
  const [expanded, setExpanded] = useState(false)

  // Determine if we should show a link (either to plan or task)
  const linkPath = planPath || taskPath
  const linkLabel = planPath ? 'View Plan' : taskPath ? 'View Task' : null

  const maxCollapsedLength = 120
  const shouldCollapse = prompt.length > maxCollapsedLength
  const displayPrompt = !expanded && shouldCollapse
    ? prompt.slice(0, maxCollapsedLength) + '...'
    : prompt

  return (
    <div className="min-h-12 px-3 py-2 border-b border-border/60 bg-panel/30 flex items-center">
      <div className="flex items-start gap-2">
        {/* Expand/collapse button */}
        {shouldCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
            title={expanded ? 'Collapse prompt' : 'Expand prompt'}
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Prompt text */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs text-text-secondary ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {displayPrompt}
          </div>
        </div>

        {/* Resumable badge */}
        {isResumable && (
          <div className="flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/30 rounded text-[10px] font-vcr text-accent flex-shrink-0">
            <RefreshCw className="w-3 h-3" />
            <span>Resumable</span>
          </div>
        )}

        {/* Plan/Task link */}
        {linkPath && linkLabel && (
          <Link
            to="/tasks"
            search={{ path: linkPath }}
            className="flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/30 rounded text-[10px] font-vcr text-accent hover:bg-accent/20 transition-colors flex-shrink-0 cursor-pointer"
            title={`View ${planPath ? 'plan' : 'task'} file`}
          >
            <FileText className="w-3 h-3" />
            <span>{linkLabel}</span>
          </Link>
        )}
      </div>
    </div>
  )
}
