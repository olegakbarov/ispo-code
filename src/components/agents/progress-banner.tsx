/**
 * Progress banner shown while agent is generating content
 */

import { useMemo } from 'react'
import type { AgentSession, AgentOutputChunk } from '@/lib/agent/types'

interface AgentProgressBannerProps {
  session: AgentSession
  onCancel: () => void
}

export function AgentProgressBanner({ session, onCancel }: AgentProgressBannerProps) {
  const status = session.status
  const isWorking = status === 'running' || status === 'pending'
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed' || status === 'cancelled'

  // Get last meaningful output for display
  const lastOutput = useMemo(() => {
    const outputs = session.output ?? []
    for (let i = outputs.length - 1; i >= 0; i--) {
      const chunk = outputs[i] as AgentOutputChunk
      if (chunk.type === 'text' || chunk.type === 'tool_use' || chunk.type === 'system') {
        // Truncate long content
        const content = chunk.content.slice(0, 100)
        return content + (chunk.content.length > 100 ? '...' : '')
      }
    }
    return null
  }, [session.output])

  // Count tool uses for progress indication
  const toolUseCount = useMemo(() => {
    return (session.output ?? []).filter((o) => o.type === 'tool_use').length
  }, [session.output])

  return (
    <div
      className={`px-3 py-2 border-b text-xs ${
        isWorking
          ? 'bg-primary/10 border-primary/30 text-primary'
          : isCompleted
            ? 'bg-green-500/10 border-green-500/30 text-green-500'
            : 'bg-destructive/10 border-destructive/30 text-destructive'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isWorking && (
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {isCompleted && <span className="shrink-0">✓</span>}
          {isFailed && <span className="shrink-0">✗</span>}

          <span className="font-vcr shrink-0">
            {isWorking ? 'Processing...' : isCompleted ? 'Complete' : 'Failed'}
          </span>

          {toolUseCount > 0 && isWorking && (
            <span className="text-[10px] opacity-70 shrink-0">({toolUseCount} operations)</span>
          )}

          {lastOutput && (
            <span className="truncate text-[10px] opacity-70 min-w-0">{lastOutput}</span>
          )}
        </div>

        {isWorking && (
          <button
            onClick={onCancel}
            className="shrink-0 px-2 py-0.5 rounded text-[10px] font-vcr border border-current/30 hover:bg-current/10 cursor-pointer transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {session.error && (
        <div className="mt-1 text-[10px] opacity-80">{session.error}</div>
      )}
    </div>
  )
}
