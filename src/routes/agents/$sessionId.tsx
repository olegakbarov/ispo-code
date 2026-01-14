/**
 * Agent Session Route - View and interact with an agent session
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Send, Square, RotateCcw, Trash2 } from 'lucide-react'
import { StreamingMarkdown } from '@/components/ui/streaming-markdown'
import type { AgentOutputChunk, SessionStatus } from '@/lib/agent/types'
import { trpc } from '@/lib/trpc-client'

export const Route = createFileRoute('/agents/$sessionId')({
  component: AgentSessionPage,
})

function AgentSessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  // Fetch session data from server
  const { data: session, isLoading } = trpc.agent.get.useQuery(
    { id: sessionId },
    { refetchInterval: (query) => {
      // Poll every 1s while session is active
      const status = query.state.data?.status
      const activeStatuses = ['pending', 'running', 'working', 'waiting_approval', 'waiting_input', 'idle']
      return status && activeStatuses.includes(status) ? 1000 : false
    }}
  )

  const [messageInput, setMessageInput] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)

  // All output from session
  const allOutput = useMemo((): AgentOutputChunk[] => {
    return session?.output ?? []
  }, [session?.output])

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [sessionId, allOutput.length])

  // Status helpers
  const activeStatuses: SessionStatus[] = ['working', 'waiting_approval', 'waiting_input', 'idle', 'pending']
  const isRunning = session?.status ? activeStatuses.includes(session.status) : false
  const needsApproval = session?.status === 'waiting_approval'
  const isReadyForInput = session?.status === 'waiting_input' || session?.status === 'idle'
  const isSdkAgent = session?.agentType === 'cerebras' || session?.agentType === 'opencode'
  const canSendMessage = isReadyForInput && (isSdkAgent || session?.cliSessionId)
  const isDone = session?.status === 'completed' || session?.status === 'failed' || session?.status === 'cancelled'

  // Mutations
  const cancelMutation = trpc.agent.cancel.useMutation({
    onSuccess: () => {
      utils.agent.get.invalidate({ id: sessionId })
    },
  })

  const deleteMutation = trpc.agent.delete.useMutation({
    onSuccess: () => {
      navigate({ to: '/agents/new' })
    },
  })

  const spawnMutation = trpc.agent.spawn.useMutation({
    onSuccess: (data) => {
      navigate({ to: '/agents/$sessionId', params: { sessionId: data.sessionId } })
    },
  })

  const sendMessageMutation = trpc.agent.sendMessage.useMutation({
    onSuccess: () => {
      setMessageInput('')
      utils.agent.get.invalidate({ id: sessionId })
    },
  })

  const approveMutation = trpc.agent.approve.useMutation({
    onSuccess: () => {
      utils.agent.get.invalidate({ id: sessionId })
    },
  })

  const isMutating = cancelMutation.isPending || deleteMutation.isPending ||
    spawnMutation.isPending || sendMessageMutation.isPending || approveMutation.isPending

  const handleCancel = () => {
    cancelMutation.mutate({ id: sessionId })
  }

  const handleDelete = () => {
    deleteMutation.mutate({ id: sessionId })
  }

  const handleRerun = () => {
    if (!session) return
    spawnMutation.mutate({
      prompt: session.prompt,
      agentType: session.agentType,
    })
  }

  const handleApprove = () => {
    approveMutation.mutate({ sessionId, approved: true })
  }

  const handleDeny = () => {
    approveMutation.mutate({ sessionId, approved: false })
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageInput.trim() || !canSendMessage) return
    sendMessageMutation.mutate({ sessionId, message: messageInput.trim() })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-vcr text-sm text-text-muted">Loading session...</span>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span className="font-vcr text-sm text-error">Session not found</span>
        <Link
          to="/agents/new"
          className="px-4 py-2 bg-panel border border-border rounded text-sm font-vcr text-text-primary hover:border-accent cursor-pointer"
        >
          New Agent
        </Link>
      </div>
    )
  }

  const tokens = session.tokensUsed
  const totalTokens = tokens ? tokens.input + tokens.output : null

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Prompt banner - compact */}
        <div className="px-3 py-1.5 border-b border-border/60 bg-panel/30">
          <div className="text-xs text-text-secondary line-clamp-2">{session.prompt}</div>
        </div>

        {/* Output area */}
        <div ref={outputRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {allOutput.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">
              {isRunning ? 'Waiting for output...' : 'No output'}
            </div>
          ) : (
            <OutputRenderer chunks={allOutput} />
          )}
        </div>

        {/* Error display */}
        {session.error && (
          <div className="px-3 py-2 border-t border-error/30 bg-error/10">
            <div className="text-xs text-error">{session.error}</div>
          </div>
        )}

        {/* Approval buttons */}
        {needsApproval && (
          <div className="px-3 py-2 border-t border-error/30 bg-error/5 flex items-center gap-2">
            <span className="font-vcr text-[10px] text-error">APPROVAL REQUIRED</span>
            <div className="flex-1" />
            <button
              onClick={handleDeny}
              disabled={isMutating}
              className="px-3 py-1 bg-panel border border-error/30 text-error rounded text-xs font-vcr hover:bg-error/10 cursor-pointer disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={isMutating}
              className="px-3 py-1 bg-accent text-background rounded text-xs font-vcr hover:bg-accent/90 cursor-pointer disabled:opacity-50"
            >
              {isMutating ? 'Approving...' : 'Approve'}
            </button>
          </div>
        )}

        {/* Unified input + metadata footer */}
        <div className="border-t border-border bg-panel">
          {/* Textarea - only for active sessions */}
          {!isDone && (
            <form onSubmit={handleSendMessage}>
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && canSendMessage) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                placeholder={canSendMessage ? "Message... (Enter to send)" : "Waiting for agent..."}
                disabled={!canSendMessage || isMutating}
                rows={2}
                className="w-full px-3 py-2 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-b border-border/40"
              />
            </form>
          )}

          {/* Metadata footer */}
          <div className="px-3 py-2 flex items-center gap-3 text-[10px]">
            {/* Agent type + status */}
            <div className="flex items-center gap-2">
              <span className="font-vcr text-accent">{session.agentType?.toUpperCase() ?? 'AGENT'}</span>
              <StatusDot status={session.status} />
            </div>

            {/* Session info */}
            <span className="text-text-muted">
              {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Tokens */}
            {totalTokens && (
              <span className="text-text-muted" title={`In: ${tokens!.input} / Out: ${tokens!.output}`}>
                {totalTokens.toLocaleString()} tok
              </span>
            )}

            <div className="flex-1" />

            {/* Action buttons */}
            {isRunning && (
              <button
                onClick={handleCancel}
                disabled={isMutating}
                className="flex items-center gap-1 px-2 py-1 text-error hover:bg-error/10 rounded cursor-pointer disabled:opacity-50 transition-colors"
                title="Stop agent"
              >
                <Square className="w-3 h-3" />
                <span className="font-vcr">Stop</span>
              </button>
            )}

            {isDone && (
              <>
                <button
                  onClick={handleRerun}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-accent hover:bg-accent/10 rounded cursor-pointer disabled:opacity-50 transition-colors"
                  title="Rerun with same prompt"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="font-vcr">Rerun</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-text-muted hover:text-error hover:bg-error/10 rounded cursor-pointer disabled:opacity-50 transition-colors"
                  title="Delete session"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}

            {/* Send button - only when can send */}
            {!isDone && (
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || !canSendMessage || isMutating}
                className="flex items-center gap-1 px-2 py-1 bg-accent text-background rounded cursor-pointer hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                title={canSendMessage ? "Send message" : "Waiting for agent"}
              >
                <Send className="w-3 h-3" />
                <span className="font-vcr">Send</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar placeholder - shows session metadata */}
      <div className="w-72 border-l border-border bg-panel overflow-y-auto">
        <div className="p-4 space-y-6">
          <Section title="Thread">
            <StatusBadge status={session.status} />
            <InfoRow label="Agent" value={session.agentType ?? 'unknown'} />
            <InfoRow label="Started" value={new Date(session.startedAt).toLocaleString()} />
            {session.completedAt && (
              <InfoRow label="Completed" value={new Date(session.completedAt).toLocaleString()} />
            )}
          </Section>

          {tokens && (
            <Section title="Tokens">
              <InfoRow label="Input" value={tokens.input.toLocaleString()} />
              <InfoRow label="Output" value={tokens.output.toLocaleString()} />
              <InfoRow label="Total" value={(tokens.input + tokens.output).toLocaleString()} />
            </Section>
          )}

          <Section title="Output">
            <InfoRow label="Chunks" value={String(allOutput.length)} />
            <InfoRow label="Text" value={String(allOutput.filter(c => c.type === 'text').length)} />
            <InfoRow label="Tool calls" value={String(allOutput.filter(c => c.type === 'tool_use').length)} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-vcr text-xs text-accent mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-text-muted/10', text: 'text-text-muted' },
    working: { bg: 'bg-accent/10', text: 'text-accent' },
    waiting_approval: { bg: 'bg-error/10', text: 'text-error' },
    waiting_input: { bg: 'bg-green-500/10', text: 'text-green-500' },
    idle: { bg: 'bg-green-500/10', text: 'text-green-500' },
    completed: { bg: 'bg-text-secondary/10', text: 'text-text-secondary' },
    failed: { bg: 'bg-error/10', text: 'text-error' },
    cancelled: { bg: 'bg-warning/10', text: 'text-warning' },
    running: { bg: 'bg-accent/10', text: 'text-accent' },
  }

  const c = config[status] ?? { bg: 'bg-text-muted/10', text: 'text-text-muted' }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-vcr ${c.bg} ${c.text}`}>
      {status}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; pulse?: boolean; label: string }> = {
    pending: { color: 'bg-text-muted', label: 'pending' },
    working: { color: 'bg-accent', pulse: true, label: 'working' },
    waiting_approval: { color: 'bg-error', pulse: true, label: 'approval' },
    waiting_input: { color: 'bg-green-500', label: 'ready' },
    idle: { color: 'bg-green-500', label: 'idle' },
    completed: { color: 'bg-text-secondary', label: 'done' },
    failed: { color: 'bg-error', label: 'failed' },
    cancelled: { color: 'bg-warning', label: 'cancelled' },
    running: { color: 'bg-accent', pulse: true, label: 'working' },
  }

  const c = config[status] ?? { color: 'bg-text-muted', label: status }

  return (
    <div className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${c.color} ${c.pulse ? 'animate-pulse' : ''}`} />
      <span className="font-vcr text-text-muted">{c.label}</span>
    </div>
  )
}

/**
 * Groups consecutive text chunks and renders them together
 */
function OutputRenderer({ chunks }: { chunks: AgentOutputChunk[] }) {
  const groups: { type: string; chunks: AgentOutputChunk[] }[] = []

  for (const chunk of chunks) {
    const lastGroup = groups[groups.length - 1]
    if (chunk.type === 'text' && lastGroup?.type === 'text') {
      lastGroup.chunks.push(chunk)
    } else {
      groups.push({ type: chunk.type, chunks: [chunk] })
    }
  }

  return (
    <>
      {groups.map((group, i) => {
        if (group.type === 'text') {
          const combinedText = group.chunks.map(c => c.content).join('')
          return (
            <div key={i} className="py-0.5">
              <StreamingMarkdown content={combinedText} className="text-xs" />
            </div>
          )
        }
        return group.chunks.map((chunk, j) => (
          <OutputChunk key={`${i}-${j}`} chunk={chunk} />
        ))
      })}
    </>
  )
}

function OutputChunk({ chunk }: { chunk: AgentOutputChunk }) {
  const { type, content, metadata } = chunk

  if (type === 'tool_use') {
    let parsed: { name?: string; input?: unknown; args?: unknown } = {}
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { name: 'unknown', input: content }
    }

    const toolName = parsed.name || (metadata?.tool as string | undefined)
    const toolInput = parsed.input ?? parsed.args

    return (
      <div className="border-l-2 border-warning pl-2 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-vcr text-[10px] text-warning">TOOL</span>
          <span className="text-xs text-text-primary">{toolName}</span>
        </div>
        {toolInput !== undefined && (
          <pre className="mt-0.5 text-[10px] text-text-muted overflow-x-auto">
            {typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput, null, 2)}
          </pre>
        )}
      </div>
    )
  }

  if (type === 'tool_result') {
    return (
      <div className="border-l-2 border-accent-dim pl-2 py-0.5">
        <div className="font-vcr text-[10px] text-accent-dim mb-0.5">RESULT</div>
        <pre className="text-[10px] text-text-secondary overflow-x-auto whitespace-pre-wrap">
          {content.length > 500 ? content.slice(0, 500) + '...' : content}
        </pre>
      </div>
    )
  }

  if (type === 'thinking') {
    return (
      <div className="border-l-2 border-text-muted pl-2 py-0.5">
        <div className="font-vcr text-[10px] text-text-muted mb-0.5">THINKING</div>
        <div className="text-xs text-text-muted italic">{content}</div>
      </div>
    )
  }

  if (type === 'error') {
    return (
      <div className="border-l-2 border-error pl-2 py-0.5">
        <div className="font-vcr text-[10px] text-error mb-0.5">ERROR</div>
        <div className="text-xs text-error">{content}</div>
      </div>
    )
  }

  if (type === 'system') {
    return (
      <div className="text-[10px] text-text-muted italic py-0.5">
        {content}
      </div>
    )
  }

  return null
}
