/**
 * Orchestrator Modal - Shows live codex output synthesizing multi-agent debug results
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { Spinner } from '@/components/ui/spinner'
import { isTerminalStatus } from '@/lib/agent/status'

interface OrchestratorModalProps {
  isOpen: boolean
  sessionId: string | null
  taskPath: string | null
  onClose: () => void
}

export function OrchestratorModal({
  isOpen,
  sessionId,
  taskPath,
  onClose,
}: OrchestratorModalProps) {
  const navigate = useNavigate()
  const outputRef = useRef<HTMLDivElement>(null)

  // Subscribe to session output
  const { data: session } = trpc.agent.get.useQuery(
    { id: sessionId ?? '' },
    {
      enabled: isOpen && !!sessionId,
      refetchInterval: 1000,
    }
  )

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [session?.output])

  const isTerminal = session?.status ? isTerminalStatus(session.status) : false

  // Extract text output chunks
  const textOutput = session?.output
    ?.filter((chunk) => chunk.type === 'text')
    .map((chunk) => chunk.content)
    .join('') ?? ''

  const handleViewSession = () => {
    if (sessionId) {
      navigate({
        to: '/agents/$sessionId',
        params: { sessionId },
        search: taskPath ? { taskPath } : undefined,
      })
      onClose()
    }
  }

  const handleViewTask = () => {
    if (taskPath) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-4xl h-[80vh] bg-panel border border-border rounded shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-vcr text-sm text-accent flex items-center gap-2">
                Orchestrator
                {!isTerminal && <Spinner size="sm" className="text-accent" />}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                Synthesizing debug session findings
              </div>
            </div>
            {session?.status && (
              <span className={`text-[10px] font-vcr px-2 py-0.5 rounded ${
                session.status === 'completed' ? 'bg-success/20 text-success' :
                session.status === 'failed' ? 'bg-error/20 text-error' :
                session.status === 'cancelled' ? 'bg-muted/20 text-text-muted' :
                'bg-accent/20 text-accent'
              }`}>
                {session.status}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors"
          >
            x
          </button>
        </div>

        {/* Output Area */}
        <div
          ref={outputRef}
          className="flex-1 overflow-auto p-4 font-mono text-xs text-text-secondary bg-background"
        >
          {!session ? (
            <div className="flex items-center gap-2 text-text-muted">
              <Spinner size="sm" />
              <span>Connecting to orchestrator...</span>
            </div>
          ) : textOutput.length === 0 && !isTerminal ? (
            <div className="flex items-center gap-2 text-text-muted">
              <Spinner size="sm" />
              <span>Waiting for orchestrator output...</span>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words">{textOutput}</pre>
          )}

          {session?.error && (
            <div className="mt-4 p-2 bg-error/10 border border-error/20 rounded text-error text-xs">
              Error: {session.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border shrink-0">
          <div className="text-[10px] text-text-muted">
            {session?.output?.filter((c) => c.type === 'tool_use').length ?? 0} tool calls
          </div>
          <div className="flex items-center gap-2">
            {sessionId && (
              <button
                onClick={handleViewSession}
                className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors"
              >
                View Full Session
              </button>
            )}
            {isTerminal && taskPath && (
              <button
                onClick={handleViewTask}
                className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90"
              >
                View Updated Task
              </button>
            )}
            {!isTerminal && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors"
              >
                Run in Background
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
