/**
 * Task Footer Component
 * Contains plan rewrite controls at the bottom of the editor
 */

import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import type { AgentSession } from './agent-types'
import { Scissors } from 'lucide-react'

interface TaskFooterProps {
  // Rewrite controls
  rewriteComment: string
  rewriteAgentType: AgentType
  rewriteModel: string
  isRewriting: boolean
  availableTypes: AgentType[] | undefined
  agentSession: AgentSession | null

  // Split task
  canSplit?: boolean
  onSplit?: () => void

  // Handlers
  onRewriteCommentChange: (comment: string) => void
  onRewriteAgentTypeChange: (agentType: AgentType) => void
  onRewriteModelChange: (model: string) => void
  onRewritePlan: () => void
}

export function TaskFooter({
  rewriteComment,
  rewriteAgentType,
  rewriteModel,
  isRewriting,
  availableTypes,
  agentSession,
  canSplit,
  onSplit,
  onRewriteCommentChange,
  onRewriteAgentTypeChange,
  onRewriteModelChange,
  onRewritePlan,
}: TaskFooterProps) {
  // Don't show footer when agent is running
  if (agentSession) {
    return null
  }

  return (
    <div className="border-t border-border bg-panel p-4">
      <div className="flex gap-3 max-w-5xl mx-auto">
        {/* Textarea for comment */}
        <Textarea
          value={rewriteComment}
          onChange={(e) => onRewriteCommentChange(e.target.value)}
          placeholder="Request changes to this plan..."
          disabled={isRewriting}
          rows={4}
          className="flex-1 bg-background border-l-2 border-l-accent rounded-l-none font-mono"
        />

        {/* Controls Column - stacked vertically, same width */}
        <div className="flex flex-col gap-2 w-40 shrink-0">
          <Select
            value={rewriteAgentType}
            onChange={(e) => onRewriteAgentTypeChange(e.target.value as AgentType)}
            variant="sm"
            disabled={isRewriting}
            className="w-full bg-background text-xs py-2"
          >
            {(Object.keys(agentTypeLabel) as AgentType[]).map((t) => (
              <option key={t} value={t} disabled={availableTypes ? !availableTypes.includes(t) : false}>
                {agentTypeLabel[t]}
              </option>
            ))}
          </Select>

          {supportsModelSelection(rewriteAgentType) && (
            <Select
              value={rewriteModel}
              onChange={(e) => onRewriteModelChange(e.target.value)}
              variant="sm"
              disabled={isRewriting}
              className="w-full bg-background text-xs py-2"
            >
              {getModelsForAgentType(rewriteAgentType).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}

          {/* Split Task Button */}
          {canSplit && onSplit && (
            <button
              onClick={onSplit}
              className="w-full py-2 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors flex items-center justify-center gap-2"
              title="Split this task into multiple subtasks"
            >
              <Scissors className="w-3 h-3" />
              Split Task
            </button>
          )}

          {/* Rewrite Button */}
          <button
            onClick={onRewritePlan}
            disabled={!rewriteComment.trim() || isRewriting}
            className="w-full py-2 rounded text-xs font-vcr border border-accent/50 text-accent cursor-pointer hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Ask agent to rewrite this plan based on your feedback"
          >
            {isRewriting ? 'REWRITING...' : 'REWRITE PLAN'}
          </button>
        </div>
      </div>
    </div>
  )
}
