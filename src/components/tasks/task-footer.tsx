/**
 * Task Footer Component
 * Contains plan rewrite controls at the bottom of the editor
 */

import { Select } from '@/components/ui/select'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'

interface TaskFooterProps {
  // Rewrite controls
  rewriteComment: string
  rewriteAgentType: AgentType
  rewriteModel: string
  isRewriting: boolean
  availableTypes: AgentType[] | undefined
  agentSession: any | null

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
        <textarea
          value={rewriteComment}
          onChange={(e) => onRewriteCommentChange(e.target.value)}
          placeholder="Request changes to this plan..."
          disabled={isRewriting}
          rows={4}
          className="flex-1 px-3 py-2 bg-background border-l-2 border-l-accent border-y border-r border-border rounded-r text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50 resize-none font-mono"
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
