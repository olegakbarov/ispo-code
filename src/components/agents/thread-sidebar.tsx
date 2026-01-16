/**
 * ThreadSidebar - Essential agent session monitoring
 *
 * Focused, actionable display:
 * - Status (agent, model, duration)
 * - Context window (with visual warnings)
 * - Changed files (operation breakdown)
 * - Git (branch, status, commit UI)
 * - Errors (when present)
 */

import { useState, useMemo, lazy, Suspense } from 'react'
import { Link } from '@tanstack/react-router'
import { GitCommit, Check, X, Sparkles, FileCode, ExternalLink } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc-client'
import { sessionTrpcOptions } from '@/lib/trpc-session'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import {
  Section,
  InfoRow,
  StatusBadge,
  ProgressBar,
} from '@/components/agents/session-primitives'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AgentSession, EditedFileInfo, SessionWithMetadata } from '@/lib/agent/types'

// Lazy load diff viewer to avoid SSR issues
const MultiFileDiff = lazy(() =>
  import('@pierre/diffs/react').then((mod) => ({ default: mod.MultiFileDiff }))
)

interface ThreadSidebarProps {
  sessionId: string
  /** Session data from parent - single source of truth to avoid duplicate polling */
  session: SessionWithMetadata | null | undefined
}

/** Extract filename from path */
function getFileName(path: string): string {
  return path.split('/').pop() || path
}

export function ThreadSidebar({ sessionId, session: sessionWithMetadata }: ThreadSidebarProps) {
  // Session data is passed from parent component (single source of truth)
  // This eliminates duplicate polling - parent handles all fetching

  if (!sessionWithMetadata) {
    return (
      <div className="w-72 border-l border-border bg-card p-4">
        <div className="text-sm text-muted-foreground font-vcr">Loading...</div>
      </div>
    )
  }

  // sessionWithMetadata is the session object with metadata property
  const session = sessionWithMetadata
  const metadata = sessionWithMetadata.metadata ?? null
  const modelLabel = inferSessionModel(session)

  // Calculate duration from session start time
  const duration = session.completedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : Date.now() - new Date(session.startedAt).getTime()

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 1. STATUS - Most important, always visible */}
        <Section title="Status">
          <StatusBadge status={session.status} />
          <div className="flex items-center justify-between text-xs">
            <span className="font-vcr text-muted-foreground">
              {session.agentType}
              {modelLabel && ` · ${modelLabel}`}
            </span>
            <span className="font-mono text-foreground/70">
              {formatDuration(metadata?.duration ?? duration)}
            </span>
          </div>
          {session.status === 'running' && (
            <InfoRow label="Last activity" value={formatTimeAgo(new Date(session.startedAt))} />
          )}
          {(metadata?.taskPath ?? session.taskPath) && (
            <InfoRow label="Task" value={truncatePath(metadata?.taskPath ?? session.taskPath ?? '')} />
          )}
        </Section>

        {/* Source Context - For comment-originated sessions */}
        {session.sourceFile && (
          <Section title="Source">
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-accent/10 border border-accent/20">
                <FileCode className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-xs font-mono text-accent truncate" title={session.sourceFile}>
                  {getFileName(session.sourceFile)}
                  {session.sourceLine && `:${session.sourceLine}`}
                </span>
              </div>
              {session.taskPath && (
                <Link
                  to="/tasks/$"
                  params={{ _splat: encodeTaskPath(session.taskPath) }}
                  search={{ archiveFilter: 'active' }}
                  className="flex items-center gap-1.5 text-[10px] font-vcr text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View task
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* 2. CONTEXT WINDOW - Critical for monitoring agent health */}
        {metadata?.contextWindow && (
          <Section title="Context">
            <ProgressBar
              value={metadata.contextWindow.estimatedTokens}
              max={metadata.contextWindow.modelLimit}
              label={`${formatNumber(metadata.contextWindow.estimatedTokens)} / ${formatNumber(metadata.contextWindow.modelLimit)}`}
              showThresholds={true}
              showRemaining={true}
            />
            <InfoRow
              label="Utilization"
              value={`${(metadata.contextWindow.utilizationPercent ?? 0).toFixed(1)}%`}
            />
          </Section>
        )}

        {/* 3. GIT + CHANGED FILES - Consolidated view */}
        <GitSection sessionId={sessionId} session={session} />

        {/* Error State */}
        {session.error && (
          <Section title="Error">
            <div className="text-xs text-destructive font-mono break-words">{session.error}</div>
          </Section>
        )}
      </div>
    </div>
  )
}

// === Sub-components ===

/**
 * Deduplicate edited files by path, keeping the most recent entry.
 * Returns unique EditedFileInfo[] for use in commit selection, etc.
 */
function dedupeEditedFiles(editedFiles: EditedFileInfo[]): EditedFileInfo[] {
  const byPath = new Map<string, EditedFileInfo>()

  for (const f of editedFiles) {
    const existing = byPath.get(f.path)
    if (!existing || new Date(f.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      byPath.set(f.path, f)
    }
  }

  return Array.from(byPath.values())
}

function GitSection({ sessionId, session }: { sessionId: string; session: SessionWithMetadata }) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage, clearMessageDraft] = useTextareaDraft(`thread-sidebar-commit:${sessionId}`)
  const [diffFile, setDiffFile] = useState<string | null>(null)
  const utils = trpc.useUtils()
  const sessionTrpc = sessionTrpcOptions(sessionId)

  // Session data is passed from parent - no need to fetch here
  // This eliminates the duplicate trpc.agent.get call

  // Git status query - automatically scoped to session's worktree via tRPC context
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    refetchInterval: 3000,
    ...sessionTrpc,
  })

  // Changed files from session - dedupe to get unique files
  const { data: rawChangedFiles = [] } = trpc.agent.getChangedFiles.useQuery({ sessionId })
  const changedFiles = useMemo(() => dedupeEditedFiles(rawChangedFiles), [rawChangedFiles])

  // Diff query for modal - only fetch when a file is selected
  const { data: diffData, isLoading: diffLoading, error: diffError } = trpc.git.diff.useQuery(
    { file: diffFile!, view: 'working' },
    { enabled: !!diffFile, ...sessionTrpc }
  )

  // Commit mutation with optimistic updates
  const commitMutation = trpc.git.commitScoped.useMutation({
    ...sessionTrpc,
    onMutate: async ({ files }) => {
      // 1. Cancel outgoing refetches
      await utils.git.status.cancel()
      await utils.agent.getChangedFiles.cancel()

      // 2. Snapshot current state for rollback
      const previousStatus = utils.git.status.getData()
      const previousChangedFiles = utils.agent.getChangedFiles.getData({ sessionId })
      const previousSelectedFiles = new Set(selectedFiles)
      const previousCommitMessage = commitMessage

      // 3. Build set of paths being committed
      const commitSet = new Set(files)

      // 4. Optimistically update git status cache
      if (previousStatus) {
        utils.git.status.setData(undefined, {
          ...previousStatus,
          staged: previousStatus.staged.filter((f) => !commitSet.has(f.file)),
          modified: previousStatus.modified.filter((f) => !commitSet.has(f.file)),
          untracked: previousStatus.untracked.filter((f) => !commitSet.has(f)),
        })
      }

      // 5. Optimistically update changed files - remove committed files
      if (previousChangedFiles) {
        utils.agent.getChangedFiles.setData(
          { sessionId },
          previousChangedFiles.filter((f) => !commitSet.has(f.path))
        )
      }

      // 6. Clear local state and draft immediately
      setSelectedFiles(new Set())
      clearMessageDraft()

      // 7. Return rollback context
      return {
        previousStatus,
        previousChangedFiles,
        previousSelectedFiles,
        previousCommitMessage,
      }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        utils.git.status.setData(undefined, context.previousStatus)
      }
      if (context?.previousChangedFiles) {
        utils.agent.getChangedFiles.setData({ sessionId }, context.previousChangedFiles)
      }
      if (context?.previousSelectedFiles) {
        setSelectedFiles(context.previousSelectedFiles)
      }
      if (context?.previousCommitMessage) {
        setCommitMessage(context.previousCommitMessage)
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      utils.git.status.invalidate()
      utils.agent.getChangedFiles.invalidate()
    },
  })

  // Generate commit message mutation
  const generateCommitMutation = trpc.git.generateCommitMessage.useMutation({
    ...sessionTrpc,
    onSuccess: (result) => {
      setCommitMessage(result.message)
    },
  })

  const canCommit = selectedFiles.size > 0 && commitMessage.trim().length > 0 && !commitMutation.isPending

  // Helper to extract task title from taskPath
  const taskTitle = useMemo(() => {
    const taskPath = session?.taskPath
    if (!taskPath) return undefined
    // Extract title from path like "tasks/my-feature.md" -> "my-feature"
    const filename = taskPath.split('/').pop()?.replace('.md', '') ?? ''
    // Convert kebab-case to Title Case
    return filename.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }, [session?.taskPath])

  const handleGenerateCommitMessage = () => {
    if (selectedFiles.size === 0) return

    generateCommitMutation.mutate({
      taskTitle,
      files: Array.from(selectedFiles),
    })
  }

  const toggleFile = (filePath: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath)
    } else {
      newSelected.add(filePath)
    }
    setSelectedFiles(newSelected)
  }

  const toggleAll = () => {
    if (selectedFiles.size === changedFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(changedFiles.map((f) => f.path)))
    }
  }

  return (
    <Section title="Git">
      {/* Loading state */}
      {!gitStatus && (
        <div className="flex items-center gap-2 text-[10px] font-vcr text-muted-foreground">
          <Spinner size="xs" />
          loading git status...
        </div>
      )}

      {/* Branch and status */}
      {gitStatus && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-vcr text-muted-foreground text-[10px]">Branch</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-foreground/70">{gitStatus.branch || "HEAD"}</span>
              {session?.worktreePath && (
                <span className="text-[8px] font-vcr text-primary bg-primary/10 px-1 py-0.5 rounded">
                  WT
                </span>
              )}
            </div>
          </div>
          {gitStatus.staged.length > 0 && (
            <InfoRow label="Staged" value={gitStatus.staged.length} />
          )}
          {gitStatus.modified.length > 0 && (
            <InfoRow label="Modified" value={gitStatus.modified.length} />
          )}
          {gitStatus.untracked.length > 0 && (
            <InfoRow label="Untracked" value={gitStatus.untracked.length} />
          )}
        </div>
      )}

      {/* File list */}
      {changedFiles.length > 0 && (
        <div className="space-y-2 mt-3">
          <div className="flex items-center justify-between">
            <span className="font-vcr text-[10px] text-muted-foreground">
              Session Files
            </span>
            <button
              onClick={toggleAll}
              aria-label={selectedFiles.size === changedFiles.length ? "Deselect all files" : "Select all files"}
              aria-pressed={selectedFiles.size === changedFiles.length}
              className="text-[10px] font-vcr text-muted-foreground hover:text-foreground"
            >
              {selectedFiles.size === changedFiles.length ? "none" : "all"}
            </button>
          </div>

          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {changedFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-2 text-xs hover:bg-secondary/60 rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFile(file.path)}
                  className="w-3 h-3 rounded cursor-pointer"
                />
                <button
                  onClick={() => setDiffFile(file.repoRelativePath || file.relativePath || file.path)}
                  className="flex-1 min-w-0 text-left cursor-pointer hover:underline"
                  title="View diff"
                >
                  <div className="font-mono text-foreground/70 truncate text-[10px]">
                    {file.relativePath || file.path}
                  </div>
                </button>
                <span
                  className={`font-mono text-[9px] ${
                    file.operation === "create"
                      ? "text-chart-2"
                      : file.operation === "edit"
                        ? "text-primary"
                        : "text-destructive"
                  }`}
                >
                  {file.operation === "create" ? "+" : file.operation === "edit" ? "~" : "−"}
                </span>
              </div>
            ))}
          </div>

          {/* Commit form */}
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                variant="sm"
                className="min-h-[60px] bg-background font-mono"
                disabled={commitMutation.isPending || generateCommitMutation.isPending}
              />
              {selectedFiles.size > 0 && (
                <button
                  onClick={handleGenerateCommitMessage}
                  disabled={generateCommitMutation.isPending}
                  aria-label="Generate commit message with AI"
                  className="absolute top-1 right-1 px-1.5 py-1 text-[9px] font-vcr rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  title="Generate commit message with AI"
                >
                  {generateCommitMutation.isPending ? (
                    <Spinner size="xs" />
                  ) : (
                    <>
                      <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>AI</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-vcr text-muted-foreground">
                {selectedFiles.size} selected
              </span>
              <button
                onClick={() =>
                  commitMutation.mutate({
                    files: Array.from(selectedFiles),
                    message: commitMessage,
                  })
                }
                disabled={!canCommit}
                aria-label={commitMutation.isPending ? "Committing changes" : "Commit selected files"}
                className="px-2 py-1 text-[10px] font-vcr rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {commitMutation.isPending ? (
                  <>
                    <Spinner size="xs" />
                    committing...
                  </>
                ) : (
                  <>
                    <GitCommit className="w-3 h-3" aria-hidden="true" />
                    commit
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status messages */}
          {generateCommitMutation.isError && (
            <div className="flex items-center gap-1.5 text-[10px] font-vcr text-destructive bg-destructive/10 px-2 py-1.5 rounded">
              <X className="w-3 h-3" />
              {generateCommitMutation.error instanceof Error
                ? generateCommitMutation.error.message
                : "AI generation failed"}
            </div>
          )}
          {commitMutation.isSuccess && (
            <div className="flex items-center gap-1.5 text-[10px] font-vcr text-chart-2 bg-chart-2/10 px-2 py-1.5 rounded">
              <Check className="w-3 h-3" />
              committed
              {commitMutation.data.hash && (
                <span className="font-mono">({commitMutation.data.hash})</span>
              )}
            </div>
          )}
          {commitMutation.isError && (
            <div className="flex items-center gap-1.5 text-[10px] font-vcr text-destructive bg-destructive/10 px-2 py-1.5 rounded">
              <X className="w-3 h-3" />
              {commitMutation.error instanceof Error
                ? commitMutation.error.message
                : "commit failed"}
            </div>
          )}
        </div>
      )}

      {changedFiles.length === 0 && gitStatus && (
        <div className="text-[10px] font-vcr text-muted-foreground">
          No files changed in session
        </div>
      )}

      {/* Diff Modal */}
      <Dialog open={!!diffFile} onOpenChange={(open) => !open && setDiffFile(null)}>
        <DialogContent className="!flex !flex-col max-w-4xl h-[80vh] overflow-hidden p-0">
          <DialogHeader className="p-4 pb-2 shrink-0">
            <DialogTitle className="font-mono text-sm truncate">{diffFile}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto mx-4 mb-4 border border-border rounded bg-background">
            {diffLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Spinner size="md" className="mr-2" />
                Loading diff...
              </div>
            ) : diffError ? (
              <div className="p-4 text-destructive text-sm">
                Error loading diff: {diffError.message}
              </div>
            ) : diffData ? (
              diffData.oldContent === diffData.newContent ? (
                <div className="p-4 text-muted-foreground text-sm">No changes detected</div>
              ) : (
                <Suspense fallback={<div className="p-4 text-muted-foreground text-sm">Loading diff viewer...</div>}>
                  <MultiFileDiff
                    className="block w-full min-w-0"
                    oldFile={{ name: diffFile || '', contents: diffData.oldContent }}
                    newFile={{ name: diffFile || '', contents: diffData.newContent }}
                    options={{
                      diffStyle: 'unified',
                      themeType: 'dark',
                      theme: { dark: 'pierre-dark', light: 'pierre-light' },
                      diffIndicators: 'bars',
                      overflow: 'scroll',
                      disableFileHeader: true,
                    }}
                  />
                </Suspense>
              )
            ) : (
              <div className="p-4 text-muted-foreground text-sm">No diff available</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  )
}

// === Utility Functions ===

function inferSessionModel(session: AgentSession & { model?: string }): string | undefined {
  if ('model' in session && session.model) return session.model
  if (session.agentType !== 'cerebras') return undefined

  for (const chunk of session.output) {
    if (chunk.type !== 'system') continue
    const match = chunk.content.match(/Starting Cerebras GLM agent \(([^)]+)\)/)
    if (match?.[1]) return match[1]
  }
  return undefined
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatNumber(num: number | undefined | null): string {
  if (num == null) return '—'
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

function truncatePath(path: string, maxLength = 30): string {
  if (path.length <= maxLength) return path

  const parts = path.split('/')
  if (parts.length <= 2) return `...${path.slice(-maxLength + 3)}`

  // Show first and last parts
  const first = parts[0]
  const last = parts[parts.length - 1]
  const middle = parts.slice(1, -1).join('/')

  if (middle.length > maxLength - first.length - last.length - 6) {
    return `${first}/.../${last}`
  }

  return path
}
