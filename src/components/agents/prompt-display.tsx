/**
 * Collapsible prompt display with optional plan link
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Image, Github } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { ImageAttachmentPreview } from '@/components/agents/image-attachment-input'
import type { ImageAttachment } from '@/lib/agent/types'
import { encodeTaskPath } from '@/lib/utils/task-routing'

interface PromptDisplayProps {
  prompt: string
  planPath?: string
  instructions?: string
  /** Image attachments for the initial prompt */
  attachments?: ImageAttachment[]
  /** GitHub repository info if working in a cloned repo */
  githubRepo?: {
    owner: string
    repo: string
  }
}

export function PromptDisplay({ prompt, planPath, instructions, attachments, githubRepo }: PromptDisplayProps) {
  // Auto-expand if custom instructions are present or attachments exist
  const [expanded, setExpanded] = useState(!!instructions || (attachments && attachments.length > 0))

  const maxCollapsedLength = 120
  const shouldCollapse = prompt.length > maxCollapsedLength
  const displayPrompt = !expanded && shouldCollapse
    ? prompt.slice(0, maxCollapsedLength) + '...'
    : prompt

  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-border/60 bg-panel/30">
      <div className="flex items-start gap-2">
        {/* Expand/collapse button */}
        {shouldCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 mt-0.5 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
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
          <div className={`text-xs text-text-secondary ${expanded ? 'whitespace-pre-wrap max-h-96 overflow-y-auto' : 'line-clamp-2'}`}>
            {displayPrompt}
          </div>
          {/* Show image attachments when expanded */}
          {expanded && attachments && attachments.length > 0 && (
            <ImageAttachmentPreview attachments={attachments} />
          )}
        </div>

        {/* Attachments badge */}
        {attachments && attachments.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/30 rounded text-[10px] font-vcr text-primary flex-shrink-0">
            <Image className="w-3 h-3" />
            <span>{attachments.length}</span>
          </div>
        )}

        {/* Custom instructions badge */}
        {instructions && (
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] font-vcr text-blue-400 flex-shrink-0">
            <span>Custom Instructions</span>
          </div>
        )}

        {/* GitHub repo badge */}
        {githubRepo && (
          <a
            href={`https://github.com/${githubRepo.owner}/${githubRepo.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] font-vcr text-purple-400 hover:bg-purple-500/20 transition-colors flex-shrink-0 cursor-pointer"
            title="Working in GitHub repository"
          >
            <Github className="w-3 h-3" />
            <span>{githubRepo.owner}/{githubRepo.repo}</span>
          </a>
        )}

        {/* Plan link (task links are in header now) */}
        {planPath && (
          <Link
            to="/tasks/$"
            params={{ _splat: encodeTaskPath(planPath) }}
            className="flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/30 rounded text-[10px] font-vcr text-accent hover:bg-accent/20 transition-colors flex-shrink-0 cursor-pointer"
            title="View plan file"
          >
            <FileText className="w-3 h-3" />
            <span>View Plan</span>
          </Link>
        )}
      </div>
    </div>
  )
}
