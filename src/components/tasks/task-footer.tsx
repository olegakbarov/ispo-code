/**
 * Task Footer Component
 * Chat-style input for requesting plan changes
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Scissors, ChevronDown, Sparkles } from 'lucide-react'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import type { AgentSession } from './agent-types'

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
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false)
      }
    }
    if (showAgentPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAgentPicker])

  // Don't show footer when agent is running
  if (agentSession) {
    return null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && rewriteComment.trim()) {
      e.preventDefault()
      onRewritePlan()
    }
  }

  const canSubmit = rewriteComment.trim() && !isRewriting
  const models = supportsModelSelection(rewriteAgentType) ? getModelsForAgentType(rewriteAgentType) : []
  const currentModel = models.find(m => m.value === rewriteModel)

  return (
    <div className="border-t border-border/60 bg-gradient-to-t from-panel to-transparent">
      <div className="p-5 flex justify-center">
        {/* Main input container */}
        <div className="relative w-full max-w-[800px] bg-background border border-border rounded-xl focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-all shadow-sm">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={rewriteComment}
            onChange={(e) => onRewriteCommentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe changes you'd like to make to this plan..."
            disabled={isRewriting}
            rows={7}
            className="w-full px-5 pt-5 pb-16 bg-transparent text-sm leading-relaxed resize-none focus:outline-none placeholder:text-text-muted/50 disabled:opacity-50"
          />

          {/* Bottom toolbar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-4">
            {/* Left side - agent picker & split */}
            <div className="flex items-center gap-2">
              {/* Agent picker */}
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                  disabled={isRewriting}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-vcr bg-panel/80 border border-border/60 text-text-secondary hover:text-text-primary hover:border-border hover:bg-panel transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>{agentTypeLabel[rewriteAgentType]}</span>
                  {currentModel && (
                    <>
                      <span className="text-border/80">•</span>
                      <span className="text-text-muted">{currentModel.label}</span>
                    </>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                </button>

                {/* Dropdown */}
                {showAgentPicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-panel border border-border rounded-xl shadow-xl py-2 z-10">
                    <div className="px-3 py-1.5 text-[10px] font-vcr text-text-muted uppercase tracking-wider">Agent</div>
                    {(Object.keys(agentTypeLabel) as AgentType[]).map((t) => {
                      const isAvailable = availableTypes ? availableTypes.includes(t) : true
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            onRewriteAgentTypeChange(t)
                            if (!supportsModelSelection(t)) setShowAgentPicker(false)
                          }}
                          disabled={!isAvailable}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-panel-hover transition-colors disabled:opacity-30 ${
                            t === rewriteAgentType ? 'text-accent bg-accent/5' : 'text-text-secondary'
                          }`}
                        >
                          {agentTypeLabel[t]}
                        </button>
                      )
                    })}

                    {models.length > 0 && (
                      <>
                        <div className="border-t border-border my-2" />
                        <div className="px-3 py-1.5 text-[10px] font-vcr text-text-muted uppercase tracking-wider">Model</div>
                        {models.map((m) => (
                          <button
                            key={m.value}
                            onClick={() => {
                              onRewriteModelChange(m.value)
                              setShowAgentPicker(false)
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-panel-hover transition-colors ${
                              m.value === rewriteModel ? 'text-accent bg-accent/5' : 'text-text-secondary'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Split button */}
              {canSplit && onSplit && (
                <button
                  onClick={onSplit}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-vcr bg-panel/80 border border-border/60 text-text-secondary hover:text-text-primary hover:border-border hover:bg-panel transition-all"
                  title="Split into subtasks"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>
              )}
            </div>

            {/* Right side - submit */}
            <div className="flex items-center gap-3">
              {rewriteComment.trim() && (
                <span className="text-xs text-text-muted">
                  <kbd className="px-1.5 py-0.5 rounded bg-panel border border-border text-[10px] font-mono">↵</kbd>
                  <span className="ml-1.5">to send</span>
                </span>
              )}
              <button
                onClick={onRewritePlan}
                disabled={!canSubmit}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-vcr transition-all ${
                  canSubmit
                    ? 'bg-accent text-background hover:opacity-90 cursor-pointer shadow-sm'
                    : 'bg-panel border border-border text-text-muted/50 cursor-not-allowed'
                }`}
                title={isRewriting ? 'Rewriting...' : 'Send feedback'}
              >
                <Send className={`w-4 h-4 ${isRewriting ? 'animate-pulse' : ''}`} />
                <span>{isRewriting ? 'Sending...' : 'Rewrite'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
