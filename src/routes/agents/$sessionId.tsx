/**
 * Agent Session Detail Page
 *
 * Displays a single agent session with:
 * - Prompt display (collapsible)
 * - Progress banner (status, cancel button)
 * - Output renderer (text, tool calls, results)
 * - Thread sidebar (git, changed files, metadata)
 *
 * Supports actions:
 * - Cancel: Stop a running session
 * - Approve: Approve a pending tool operation
 * - Resume: Send a follow-up message to a completed session
 */

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowLeft, Send, CheckCircle, XCircle } from 'lucide-react'
import { z } from 'zod'
import { trpc } from '@/lib/trpc-client'
import { useAdaptivePolling, computeSessionHash } from '@/lib/hooks/use-adaptive-polling'
import { mergeOutputWithPending, filterPendingUserMessages, type PendingUserMessage } from '@/lib/agent/output-utils'
import { PromptDisplay } from '@/components/agents/prompt-display'
import { AgentProgressBanner } from '@/components/agents/progress-banner'
import { OutputRenderer } from '@/components/agents/output-renderer'
import { ThreadSidebar } from '@/components/agents/thread-sidebar'
import { ImageAttachmentInput } from '@/components/agents/image-attachment-input'
import { Spinner } from '@/components/ui/spinner'
import { StyledTextarea } from '@/components/ui/styled-textarea'
import type { ImageAttachment } from '@/lib/agent/types'
import { encodeTaskPath } from '@/lib/utils/task-routing'

export const Route = createFileRoute('/agents/$sessionId')({
  parseParams: (params) => ({
    sessionId: z.string().min(1).parse(params.sessionId),
  }),
  component: AgentSessionPage,
})

const RESUME_POLL_TIMEOUT_MS = 20000

function createClientMessageId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID()
  }
  return `resume-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function AgentSessionPage() {
  const { sessionId } = Route.useParams()
  const [resumeMessage, setResumeMessage] = useState('')
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [pendingMessages, setPendingMessages] = useState<PendingUserMessage[]>([])
  const [awaitingResumeStatus, setAwaitingResumeStatus] = useState(false)
  const outputContainerRef = useRef<HTMLDivElement>(null)

  // Fetch session with metadata
  const { data: session, isLoading, error, refetch } = trpc.agent.getSessionWithMetadata.useQuery(
    { id: sessionId },
    { refetchInterval: false } // We'll control polling manually
  )

  // Adaptive polling based on session status
  const isTerminalStatus = session?.status === 'completed' || session?.status === 'failed' || session?.status === 'cancelled'
  const pollingStatus = awaitingResumeStatus && isTerminalStatus ? 'running' : session?.status

  const { refetchInterval, reset: resetPolling } = useAdaptivePolling({
    status: pollingStatus,
    dataHash: computeSessionHash(session ?? null),
  })

  // Apply adaptive polling
  trpc.agent.getSessionWithMetadata.useQuery(
    { id: sessionId },
    { refetchInterval }
  )

  // Reset polling when sessionId changes
  useEffect(() => {
    resetPolling()
    setPendingMessages([])
    setAwaitingResumeStatus(false)
  }, [sessionId, resetPolling])

  const outputChunks = useMemo(
    () => mergeOutputWithPending(session?.output ?? [], pendingMessages),
    [session?.output, pendingMessages]
  )

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputContainerRef.current && outputChunks.length > 0) {
      const container = outputContainerRef.current
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight
      }
    }
  }, [outputChunks.length])

  useEffect(() => {
    if (!session?.output || pendingMessages.length === 0) return
    setPendingMessages((prev) => {
      const next = filterPendingUserMessages(session.output, prev)
      return next.length === prev.length ? prev : next
    })
  }, [session?.output, pendingMessages.length])

  useEffect(() => {
    if (!awaitingResumeStatus || !session?.status) return
    if (session.status !== 'completed' && session.status !== 'failed' && session.status !== 'cancelled') {
      setAwaitingResumeStatus(false)
    }
  }, [awaitingResumeStatus, session?.status])

  useEffect(() => {
    if (!awaitingResumeStatus) return
    const timeout = setTimeout(() => setAwaitingResumeStatus(false), RESUME_POLL_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [awaitingResumeStatus])

  // Mutations
  const cancelMutation = trpc.agent.cancel.useMutation({
    onSuccess: () => refetch(),
  })

  const approveMutation = trpc.agent.approve.useMutation({
    onSuccess: () => refetch(),
  })

  const resumeMutation = trpc.agent.sendMessage.useMutation({
    onMutate: (variables) => {
      setAwaitingResumeStatus(true)
      resetPolling()

      const previousMessage = resumeMessage
      const previousAttachments = attachments
      const serializedAttachments = variables.attachments?.map((att) => ({
        type: att.type,
        mimeType: att.mimeType,
        data: att.data,
        fileName: att.fileName,
      }))

      const pendingMessage: PendingUserMessage = {
        id: variables.clientMessageId ?? createClientMessageId(),
        content: variables.message,
        timestamp: new Date().toISOString(),
        attachments: serializedAttachments,
      }

      setPendingMessages((prev) => [...prev, pendingMessage])
      setResumeMessage('')
      setAttachments([])

      return { previousMessage, previousAttachments, pendingId: pendingMessage.id }
    },
    onSuccess: () => {
      refetch()
    },
    onError: (_err, _variables, context) => {
      if (context?.pendingId) {
        setPendingMessages((prev) => prev.filter((msg) => msg.id !== context.pendingId))
      }
      if (context?.previousMessage !== undefined) {
        setResumeMessage(context.previousMessage)
      }
      if (context?.previousAttachments !== undefined) {
        setAttachments(context.previousAttachments)
      }
      setAwaitingResumeStatus(false)
    },
  })

  const handleCancel = () => {
    cancelMutation.mutate({ id: sessionId })
  }

  const handleApprove = (approved: boolean) => {
    approveMutation.mutate({ sessionId, approved })
  }

  const handleResume = () => {
    const trimmed = resumeMessage.trim()
    if (!trimmed) return
    resumeMutation.mutate({
      sessionId,
      message: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
      clientMessageId: createClientMessageId(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleResume()
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner size="sm" />
          <span className="font-vcr text-sm">Loading session...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-destructive font-vcr text-sm">
          Error loading session: {error.message}
        </div>
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  // Session not found
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-muted-foreground font-vcr text-sm">
          Session not found
        </div>
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </Link>
      </div>
    )
  }

  const isRunning = session.status === 'running' || session.status === 'pending' || session.status === 'working'
  const isWaitingApproval = session.status === 'waiting_approval'
  const isWaitingInput = session.status === 'waiting_input'
  const isTerminal = session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled'
  const canResume = isTerminal && session.resumable !== false

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <Link
            to={session.taskPath ? "/tasks/$" : "/"}
            params={session.taskPath ? { _splat: encodeTaskPath(session.taskPath) } : undefined}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={session.taskPath ? "Back to task" : "Back to dashboard"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            {session.taskPath ? (
              <Link
                to="/tasks/$"
                params={{ _splat: encodeTaskPath(session.taskPath) }}
                className="font-vcr text-sm truncate block hover:text-accent transition-colors"
              >
                {session.title || session.prompt.slice(0, 60)}
              </Link>
            ) : (
              <h1 className="font-vcr text-sm truncate">
                {session.title || session.prompt.slice(0, 60)}
              </h1>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{session.agentType}</span>
              {session.model && (
                <>
                  <span>·</span>
                  <span className="font-mono">{session.model}</span>
                </>
              )}
              <span>·</span>
              <span className="font-mono">{sessionId.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* Prompt */}
        <PromptDisplay
          prompt={session.prompt}
          instructions={session.instructions}
          githubRepo={session.githubRepo}
        />

        {/* Progress banner */}
        {(isRunning || isTerminal) && (
          <AgentProgressBanner session={session} onCancel={handleCancel} />
        )}

        {/* Approval banner */}
        {isWaitingApproval && (
          <div className="px-4 py-3 border-b border-warning/30 bg-warning/10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-warning">
                <span className="font-vcr text-xs">WAITING FOR APPROVAL</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(false)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-vcr rounded border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(true)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-vcr rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Output */}
        <div
          ref={outputContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2"
        >
          {outputChunks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {isRunning ? (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="font-vcr">Waiting for output...</span>
                </div>
              ) : (
                <span className="font-vcr">No output yet</span>
              )}
            </div>
          ) : (
            <OutputRenderer chunks={outputChunks} />
          )}
        </div>

        {/* Resume input (for completed/resumable sessions or waiting_input) */}
        {(canResume || isWaitingInput) && (
          <div className="border-t border-border p-4 bg-card/50">
            <div className="space-y-2">
              <ImageAttachmentInput
                attachments={attachments}
                onChange={setAttachments}
              />
              <div className="flex items-end gap-2">
                <StyledTextarea
                  value={resumeMessage}
                  onChange={(e) => setResumeMessage(e.target.value)}
                  autoGrowValue={resumeMessage}
                  onKeyDown={handleKeyDown}
                  placeholder={isWaitingInput ? "Respond to agent..." : "Send follow-up message..."}
                  variant="sm"
                  containerClassName="flex-1"
                  className="min-h-[60px] max-h-[200px]"
                  disabled={resumeMutation.isPending}
                />
                <button
                  onClick={handleResume}
                  disabled={!resumeMessage.trim() || resumeMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-vcr rounded-lg bg-accent text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resumeMutation.isPending ? (
                    <Spinner size="xs" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Press ⌘+Enter to send
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <ThreadSidebar sessionId={sessionId} session={session} />
    </div>
  )
}
