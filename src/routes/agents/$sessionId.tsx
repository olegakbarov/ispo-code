/**
 * Agent Session Route - View and interact with an agent session
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Send, Square, RotateCcw, Trash2 } from 'lucide-react'
import { PromptDisplay } from '@/components/agents/prompt-display'
import { Section, InfoRow, StatusBadge, StatusDot } from '@/components/agents/session-primitives'
import { ProgressDisplay, extractTodos } from '@/components/agents/progress-display'
import { ResumeHistory } from '@/components/agents/resume-history'
import { OutputRenderer } from '@/components/agents/output-renderer'
import type { AgentOutputChunk, SessionStatus } from '@/lib/agent/types'
import { trpc } from '@/lib/trpc-client'

export const Route = createFileRoute('/agents/$sessionId')({
  component: AgentSessionPage,
})

function AgentSessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  // Track retry attempts for newly-created sessions
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 10 // Retry for up to 10s

  // Reset retry count when session changes
  useEffect(() => {
    setRetryCount(0)
  }, [sessionId])

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

  // Retry fetching for newly-created sessions that haven't appeared yet
  useEffect(() => {
    if (session || isLoading) {
      setRetryCount(0)
      return
    }

    // No session found - might be a race condition with daemon startup
    if (retryCount < maxRetries) {
      const timer = setTimeout(() => {
        setRetryCount(c => c + 1)
        utils.agent.get.invalidate({ id: sessionId })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [session, isLoading, retryCount, sessionId, utils])

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
        <span className="font-vcr text-sm text-muted-foreground">Loading session...</span>
      </div>
    )
  }

  if (!session) {
    // Still retrying - show loading state
    if (retryCount < maxRetries) {
      return (
        <div className="flex items-center justify-center h-full">
          <span className="font-vcr text-sm text-muted-foreground">Starting session...</span>
        </div>
      )
    }

    // Exhausted retries - show not found
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span className="font-vcr text-sm text-destructive">Session not found</span>
        <Link
          to="/"
          className="px-4 py-2 bg-card border border-border rounded text-sm font-vcr text-foreground hover:border-primary cursor-pointer"
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
            <div className="text-center text-muted-foreground text-sm py-8">
              {isBusy ? 'Waiting for output...' : 'No output'}
            </div>
          ) : (
            <OutputRenderer chunks={allOutput} />
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error display */}
        {session.error && (
          <div className="px-3 py-2 border-t border-destructive/30 bg-destructive/10">
            <div className="text-xs text-destructive">{session.error}</div>
          </div>
        )}

        {/* Approval buttons */}
        {needsApproval && (
          <div className="px-3 py-2 border-t border-destructive/30 bg-destructive/5 flex items-center gap-2">
            <span className="font-vcr text-[10px] text-destructive">APPROVAL REQUIRED</span>
            <div className="flex-1" />
            <button
              onClick={handleDeny}
              disabled={isMutating}
              className="px-3 py-1 bg-card border border-destructive/30 text-destructive rounded text-xs font-vcr hover:bg-destructive/10 cursor-pointer disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={isMutating}
              className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-vcr hover:bg-primary/90 cursor-pointer disabled:opacity-50"
            >
              {isMutating ? 'Approving...' : 'Approve'}
            </button>
          </div>
        )}

        {/* Unified input + metadata footer */}
        <div className="border-t border-border bg-card">
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
                className="w-full px-3 py-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-b border-border/40"
              />
            </form>
          )}

          {/* Metadata footer */}
          <div className="px-3 py-2 flex items-center gap-3 text-[10px]">
            {/* Agent type + status */}
            <div className="flex items-center gap-2">
              <span className="font-vcr text-primary">{session.agentType?.toUpperCase() ?? 'AGENT'}</span>
              <StatusDot status={session.status} />
            </div>

            {/* Session info */}
            <span className="text-muted-foreground">
              {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Tokens */}
            {totalTokens && (
              <span className="text-muted-foreground" title={`In: ${tokens!.input} / Out: ${tokens!.output}`}>
                {totalTokens.toLocaleString()} tok
              </span>
            )}

            <div className="flex-1" />

            {/* Action buttons */}
            {isBusy && (
              <button
                onClick={handleCancel}
                disabled={isMutating}
                className="flex items-center gap-1 px-2 py-1 text-destructive hover:bg-destructive/10 rounded cursor-pointer disabled:opacity-50 transition-colors"
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
                  className="flex items-center gap-1 px-2 py-1 text-primary hover:bg-primary/10 rounded cursor-pointer disabled:opacity-50 transition-colors"
                  title="Rerun with same prompt"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="font-vcr">Rerun</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer disabled:opacity-50 transition-colors"
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
                className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded cursor-pointer hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                title={canSendMessage ? "Send message" : "Waiting for agent"}
              >
                <Send className="w-3 h-3" />
                <span className="font-vcr">Send</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar - shows session metadata */}
      <div className="w-72 border-l border-border bg-card overflow-y-auto">
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
