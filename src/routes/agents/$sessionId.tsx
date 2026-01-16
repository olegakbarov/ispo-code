/**
 * Agent Session Route - View and interact with an agent session
 *
 * This route uses a single source of truth for session data:
 * - `getSessionWithMetadata` is fetched once at the page level
 * - Session data is passed as props to ThreadSidebar/GitSection
 * - Adaptive polling reduces network traffic when session is idle
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, RotateCcw, Trash2, Image } from 'lucide-react'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { PromptDisplay } from '@/components/agents/prompt-display'
import { StatusDot } from '@/components/agents/session-primitives'
import { ThreadSidebar } from '@/components/agents/thread-sidebar'
import { OutputRenderer } from '@/components/agents/output-renderer'
import { ImageAttachmentInput } from '@/components/agents/image-attachment-input'
import { Textarea } from '@/components/ui/textarea'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { AgentOutputChunk, SessionStatus, ImageAttachment, AgentSession, AgentSessionMetadata } from '@/lib/agent/types'
import { trpc } from '@/lib/trpc-client'
import { useAudioNotification } from '@/lib/hooks/use-audio-notification'
import { computeSessionHash } from '@/lib/hooks/use-adaptive-polling'

/** Session data with metadata - single source of truth for the page */
export type SessionWithMetadata = AgentSession & { metadata: AgentSessionMetadata | null }

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

  // Compute hash for change detection in adaptive polling
  // Using a ref to track state across renders without causing re-renders
  const pollingStateRef = useRef<{ lastHash: string | null; stableCount: number }>({
    lastHash: null,
    stableCount: 0,
  })

  // Fetch session data from server - single source of truth for the page
  // Uses getSessionWithMetadata to include metadata for ThreadSidebar
  const { data: session, isLoading, error: fetchError } = trpc.agent.getSessionWithMetadata.useQuery(
    { id: sessionId },
    {
      // Retry configuration for error recovery
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
      // Adaptive polling: faster for active sessions, backs off when idle
      refetchInterval: (query) => {
        const data = query.state.data
        if (!data) return 2000 // Default interval while loading

        const status = data.status
        const activeStatuses: SessionStatus[] = ['pending', 'running', 'working', 'waiting_approval', 'waiting_input']

        // Stop polling for terminal states
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
          return false
        }

        // Fast polling for active sessions
        if (activeStatuses.includes(status)) {
          pollingStateRef.current.stableCount = 0
          return 2000
        }

        // Idle state - apply adaptive backoff
        const currentHash = computeSessionHash(data)
        const state = pollingStateRef.current

        if (currentHash === state.lastHash) {
          state.stableCount++
        } else {
          state.stableCount = 0
        }
        state.lastHash = currentHash

        // Backoff: 2s -> 3s -> 4.5s -> 6.75s -> ... -> 30s max
        const backoffMultiplier = Math.min(Math.pow(1.5, Math.floor(state.stableCount / 3)), 15)
        return Math.min(2000 * backoffMultiplier, 30000)
      },
    }
  )

  // Reset polling state when session changes
  useEffect(() => {
    pollingStateRef.current = { lastHash: null, stableCount: 0 }
  }, [sessionId])

  // Audio notification on session completion
  useAudioNotification({
    status: session?.status,
    sessionId,
  })

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
        utils.agent.getSessionWithMetadata.invalidate({ id: sessionId })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [session, isLoading, retryCount, sessionId, utils])

  const [messageInput, setMessageInput, clearMessageDraft] = useTextareaDraft(`agent-message:${sessionId}`)
  const [messageQueue, setMessageQueue] = useState<string[]>([])
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // All output from session
  const allOutput = useMemo((): AgentOutputChunk[] => {
    return session?.output ?? []
  }, [session?.output])

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

  // File drop handlers
  const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const MAX_FILES = 5

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const remainingSlots = MAX_FILES - attachments.length
    const filesToProcess = fileArray.slice(0, remainingSlots)

    const newAttachments: ImageAttachment[] = []
    for (const file of filesToProcess) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_SIZE) continue

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
        const base64Data = dataUrl.split(",")[1]
        if (base64Data) {
          newAttachments.push({
            type: "image",
            mimeType: file.type,
            data: base64Data,
            fileName: file.name,
          })
        }
      } catch {
        // Skip failed files
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments])
    }
  }, [attachments.length])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only leave if we're actually leaving the container (not entering a child)
    const rect = e.currentTarget.getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

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
      utils.agent.getSessionWithMetadata.invalidate({ id: sessionId })
    },
  })

  const deleteMutation = trpc.agent.delete.useMutation({
    onSuccess: () => {
      navigate({ to: '/' })
    },
  })

  const spawnMutation = trpc.agent.spawn.useMutation({
    onMutate: async () => {
      // Cancel outgoing refetches
      await utils.agent.list.cancel()

      // Snapshot for rollback
      const previousList = utils.agent.list.getData()
      return { previousList }
    },
    onSuccess: (data) => {
      navigate({ to: '/agents/$sessionId', params: { sessionId: data.sessionId } })
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.agent.list.setData(undefined, context.previousList)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      utils.agent.list.invalidate()
    },
  })

  const sendMessageMutation = trpc.agent.sendMessage.useMutation({
    onSuccess: () => {
      clearMessageDraft() // Clear persisted draft
      setAttachments([]) // Clear attachments after sending
      setMessageQueue((prevQueue) => prevQueue.length > 0 ? prevQueue.slice(1) : prevQueue)
      utils.agent.getSessionWithMetadata.invalidate({ id: sessionId })
    },
    onError: (error) => {
      console.error('Failed to send message:', error)
    },
  })

  const approveMutation = trpc.agent.approve.useMutation({
    onSuccess: () => {
      utils.agent.getSessionWithMetadata.invalidate({ id: sessionId })
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
    if (!messageInput.trim()) return

    const trimmedMessage = messageInput.trim()

    if (canSendMessage) {
      sendMessageMutation.mutate({
        sessionId,
        message: trimmedMessage,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
    } else {
      setMessageQueue((prev) => [...prev, trimmedMessage])
      setMessageInput('')
    }
  }

  const handleEnqueueMessage = () => {
    if (!messageInput.trim()) return
    const trimmedMessage = messageInput.trim()
    setMessageQueue((prev) => [...prev, trimmedMessage])
    clearMessageDraft()
  }

  useEffect(() => {
    if (canSendMessage && messageQueue.length > 0 && !sendMessageMutation.isPending) {
      const nextMessage = messageQueue[0]
      sendMessageMutation.mutate({ sessionId, message: nextMessage })
    }
  }, [canSendMessage, messageQueue.length, sendMessageMutation.isPending, sessionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-vcr text-sm text-muted-foreground">Loading session...</span>
      </div>
    )
  }

  // Handle fetch errors with retry option
  if (fetchError) {
    const errorMessage = fetchError.message || 'Failed to load session data'
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span className="font-vcr text-sm text-destructive">Error: {errorMessage}</span>
        <p className="text-xs text-muted-foreground max-w-md text-center">
          There was a problem loading the session. The server may be temporarily unavailable.
        </p>
        <button
          onClick={() => utils.agent.getSessionWithMetadata.invalidate({ id: sessionId })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-vcr hover:bg-primary/90 cursor-pointer"
        >
          Retry
        </button>
        <Link
          to="/"
          className="text-sm text-accent hover:underline"
        >
          Return to dashboard
        </Link>
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

    // Exhausted retries - show error state with retry option
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span className="font-vcr text-sm text-destructive">Session not found or failed to load</span>
        <button
          onClick={() => setRetryCount(0)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-vcr hover:bg-primary/90 cursor-pointer"
        >
          Retry
        </button>
        <Link
          to="/"
          className="text-sm text-accent hover:underline"
        >
          Return to dashboard
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
          instructions={session.instructions}
          githubRepo={session.githubRepo}
        />

        {/* Output area */}
        <div ref={outputRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {allOutput.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {isBusy ? 'Waiting for output...' : 'No output'}
            </div>
          ) : (
            <ErrorBoundary
              name="OutputRenderer"
              fallback={
                <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
                  Failed to render agent output
                </div>
              }
            >
              <OutputRenderer chunks={allOutput} />
            </ErrorBoundary>
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
          {/* Textarea with image attachments - only for active sessions */}
          {!isDone && (
            <form
              onSubmit={handleSendMessage}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative"
            >
              {/* Dropzone overlay */}
              {isDragOver && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
                  <div className="flex items-center gap-2 text-primary">
                    <Image className="w-5 h-5" />
                    <span className="text-sm font-medium">Drop images here</span>
                  </div>
                </div>
              )}
              {/* Image attachment preview */}
              {attachments.length > 0 && (
                <div className="px-3 pt-2 border-b border-border/40">
                  <ImageAttachmentInput
                    attachments={attachments}
                    onChange={setAttachments}
                    disabled={isMutating}
                  />
                </div>
              )}
              <div className="flex items-end gap-2 border-b border-border/40">
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (canSendMessage) {
                        handleSendMessage(e)
                      } else {
                        handleEnqueueMessage()
                      }
                    }
                  }}
                  placeholder={canSendMessage ? "Message... (Enter to send)" : messageQueue.length > 0 ? `Queue (${messageQueue.length}) - Enter to queue message` : "Agent working... (Enter to queue message)"}
                  disabled={isMutating}
                  rows={3}
                  className="flex-1 bg-transparent border-0 py-3 min-h-[80px]"
                />
                {/* Compact image attachment button */}
                {attachments.length === 0 && (
                  <div className="pb-3 pr-2">
                    <ImageAttachmentInput
                      attachments={attachments}
                      onChange={setAttachments}
                      disabled={isMutating}
                      compact
                    />
                  </div>
                )}
              </div>
              {/* Hidden file input for programmatic triggers */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
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

            {/* Queue indicator */}
            {messageQueue.length > 0 && (
              <span className="text-accent font-vcr" title={`${messageQueue.length} message${messageQueue.length > 1 ? 's' : ''} queued`}>
                Queue: {messageQueue.length}
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

            {/* Send/Queue button - only when not done */}
            {!isDone && (
              <button
                onClick={canSendMessage ? handleSendMessage : handleEnqueueMessage}
                disabled={!messageInput.trim() || isMutating}
                className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity ${canSendMessage ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
                title={canSendMessage ? "Send message" : "Queue message"}
              >
                <Send className="w-3 h-3" />
                <span className="font-vcr">{canSendMessage ? 'Send' : 'Queue'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar - shows session metadata + git commit panel */}
      <ErrorBoundary
        name="ThreadSidebar"
        fallback={
          <div className="w-72 border-l border-border bg-card p-4">
            <div className="text-sm text-destructive">Sidebar failed to load</div>
          </div>
        }
      >
        <ThreadSidebar sessionId={sessionId} session={session} />
      </ErrorBoundary>
    </div>
  )
}
