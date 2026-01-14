/**
 * Agent Session Route - View and interact with an agent session
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Send, Square, RotateCcw, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { StreamingMarkdown } from '@/components/ui/streaming-markdown'
import { SimpleErrorBoundary } from '@/components/ui/error-boundary'
import { PromptDisplay } from '@/components/agents/prompt-display'
import { ToolCall } from '@/components/agents/tool-call'
import { ToolResult } from '@/components/agents/tool-result'
import type { AgentOutputChunk, SessionStatus, ResumeHistoryEntry } from '@/lib/agent/types'
import { trpc } from '@/lib/trpc-client'

/** Todo item from TodoWrite tool calls */
interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

/** Extract the latest todo list from output chunks */
function extractTodos(output: AgentOutputChunk[]): TodoItem[] | null {
  // Find the last TodoWrite tool call
  for (let i = output.length - 1; i >= 0; i--) {
    const chunk = output[i]
    if (chunk.type !== 'tool_use') continue

    try {
      const parsed = JSON.parse(chunk.content)
      if (parsed.name === 'TodoWrite' && parsed.input?.todos) {
        return parsed.input.todos as TodoItem[]
      }
    } catch {
      // Not valid JSON or not a TodoWrite call
    }
  }
  return null
}

/** Progress display showing todo list with visual indicators */
function ProgressDisplay({ todos }: { todos: TodoItem[] }) {
  const completed = todos.filter(t => t.status === 'completed').length
  const total = todos.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-[10px] font-vcr text-text-muted">
          {completed}/{total}
        </span>
      </div>

      {/* Todo list */}
      <div className="space-y-1">
        {todos.map((todo, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            {todo.status === 'completed' ? (
              <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
            ) : todo.status === 'in_progress' ? (
              <Loader2 className="w-3 h-3 text-accent animate-spin mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="w-3 h-3 text-text-muted mt-0.5 flex-shrink-0" />
            )}
            <span className={
              todo.status === 'completed' ? 'text-text-muted line-through' :
              todo.status === 'in_progress' ? 'text-accent' :
              'text-text-secondary'
            }>
              {todo.status === 'in_progress' ? (todo.activeForm ?? todo.content) : todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Resume history display */
function ResumeHistory({ history }: { history: ResumeHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {history.map((entry, i) => (
        <div key={i} className="text-[10px] border-l-2 pl-2 py-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            {entry.success ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <Circle className="w-3 h-3 text-error" />
            )}
            <span className="text-text-muted">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-text-secondary truncate">
            {entry.message.slice(0, 50)}{entry.message.length > 50 ? '...' : ''}
          </div>
          {entry.error && (
            <div className="text-error mt-0.5 truncate">
              {entry.error}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

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
  const bottomRef = useRef<HTMLDivElement>(null)

  // All output from session
  const allOutput = useMemo((): AgentOutputChunk[] => {
    return session?.output ?? []
  }, [session?.output])

  // Extract todo list from output
  const todos = useMemo(() => extractTodos(allOutput), [allOutput])

  // Auto-scroll to bottom
  useEffect(() => {
    const el = outputRef.current
    const bottomEl = bottomRef.current
    if (!el || !bottomEl) return

    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight
      bottomEl.scrollIntoView({ block: 'end' })
    }

    let rafId = 0
    let prevScrollHeight = -1
    let stableFrames = 0
    const maxFrames = 60 // ~1s
    let frame = 0

    const tick = () => {
      frame++
      scrollToBottom()

      const nextScrollHeight = el.scrollHeight
      if (nextScrollHeight === prevScrollHeight) {
        stableFrames++
      } else {
        prevScrollHeight = nextScrollHeight
        stableFrames = 0
      }

      if (stableFrames >= 2) return
      if (frame >= maxFrames) return
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [sessionId, allOutput.length])

  // Status helpers
  const busyStatuses: SessionStatus[] = ['pending', 'running', 'working', 'waiting_approval', 'waiting_input']
  const isBusy = session?.status ? busyStatuses.includes(session.status) : false
  const needsApproval = session?.status === 'waiting_approval'
  // Allow follow-ups for idle, waiting_input, OR completed sessions (resume support)
  const isReadyForInput = session?.status === 'waiting_input' || session?.status === 'idle' || session?.status === 'completed'
  const isSdkAgent = session?.agentType === 'cerebras' || session?.agentType === 'opencode'
  const canSendMessage = isReadyForInput && (isSdkAgent || Boolean(session?.cliSessionId))
  const isDone = session?.status === 'failed' || session?.status === 'cancelled'

  // Check if session is resumable
  const isResumable = session?.resumable !== false && canSendMessage

  // Mutations
  const cancelMutation = trpc.agent.cancel.useMutation({
    onSuccess: () => {
      utils.agent.get.invalidate({ id: sessionId })
    },
  })

  const deleteMutation = trpc.agent.delete.useMutation({
    onSuccess: () => {
      navigate({ to: '/' })
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
    onError: (error) => {
      console.error('Failed to send message:', error)
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
          to="/"
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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Prompt display - collapsible with plan/task links */}
        <PromptDisplay
          prompt={session.prompt}
          planPath={session.planPath}
          taskPath={session.taskPath}
          isResumable={isResumable}
        />

        {/* Output area */}
        <div ref={outputRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {allOutput.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">
              {isBusy ? 'Waiting for output...' : 'No output'}
            </div>
          ) : (
            <OutputRenderer chunks={allOutput} />
          )}
          <div ref={bottomRef} />
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
            {isBusy && (
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
            {session.resumeAttempts !== undefined && session.resumeAttempts > 0 && (
              <InfoRow label="Resume attempts" value={String(session.resumeAttempts)} />
            )}
            {session.lastResumedAt && (
              <InfoRow label="Last resumed" value={new Date(session.lastResumedAt).toLocaleString()} />
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

          {session.resumeHistory && session.resumeHistory.length > 0 && (
            <Section title="Resume History">
              <ResumeHistory history={session.resumeHistory} />
            </Section>
          )}

          {todos && todos.length > 0 && (
            <Section title="Progress">
              <ProgressDisplay todos={todos} />
            </Section>
          )}
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
              <SimpleErrorBoundary>
                <StreamingMarkdown content={combinedText} className="text-xs" />
              </SimpleErrorBoundary>
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

    const toolName = parsed.name || (metadata?.tool as string | undefined) || 'unknown'
    const toolInput = parsed.input ?? parsed.args

    return <ToolCall toolName={toolName} toolInput={toolInput} metadata={metadata} />
  }

  if (type === 'tool_result') {
    // Determine success from metadata or content
    const success = metadata?.success !== false && !content.startsWith('error:')
    const toolName = metadata?.tool as string | undefined

    return <ToolResult content={content} success={success} toolName={toolName} />
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

  if (type === 'user_message') {
    return (
      <div className="border-l-2 border-accent pl-2 py-1.5 my-2">
        <div className="font-vcr text-[10px] text-accent mb-0.5">USER</div>
        <div className="text-xs text-text-primary whitespace-pre-wrap">{content}</div>
      </div>
    )
  }

  return null
}
