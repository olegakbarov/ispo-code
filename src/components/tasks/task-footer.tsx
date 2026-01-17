/**
 * Task Footer Component
 * Chat-style input for requesting plan changes
 */

import { useState, useRef, useEffect } from 'react'
import { Send, Scissors, ChevronDown, Sparkles } from 'lucide-react'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import { TaskInput } from './task-input'

interface TaskFooterProps {
  // Rewrite controls
  rewriteComment: string
  rewriteAgentType: AgentType
  rewriteModel: string
  isRewriting: boolean
  availableTypes: AgentType[] | undefined

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
  canSplit,
  onSplit,
  onRewriteCommentChange,
  onRewriteAgentTypeChange,
  onRewriteModelChange,
  onRewritePlan,
}: TaskFooterProps) {
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

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

  const canSubmit = Boolean(rewriteComment.trim()) && !isRewriting
  const models = supportsModelSelection(rewriteAgentType) ? getModelsForAgentType(rewriteAgentType) : []
  const currentModel = models.find(m => m.value === rewriteModel)

  // Agent picker component
  const agentPicker = (
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
  )

  // Split button component
  const splitButton = canSplit && onSplit && (
    <button
      onClick={onSplit}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-vcr bg-panel/80 border border-border/60 text-text-secondary hover:text-text-primary hover:border-border hover:bg-panel transition-all"
      title="Split into subtasks"
    >
      <Scissors className="w-3.5 h-3.5" />
      <span>Split</span>
    </button>
  )

  return (
    <TaskInput
      value={rewriteComment}
      onChange={onRewriteCommentChange}
      placeholder="Describe changes you'd like to make to this plan..."
      rows={6}
      onSubmit={onRewritePlan}
      canSubmit={canSubmit}
      submitLabel="Rewrite"
      submitIcon={<Send className="w-4 h-4" />}
      isSubmitting={isRewriting}
      toolbarLeft={
        <>
          {agentPicker}
          {splitButton}
        </>
      }
      containerClassName="p-4 flex justify-center"
    />
  )
}
