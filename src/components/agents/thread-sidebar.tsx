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

import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { GitCommit, Loader2, Check, X } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import {
  Section,
  InfoRow,
  StatusBadge,
  ProgressBar,
} from '@/components/agents/session-primitives'
import type { AgentSession, EditedFileInfo } from '@/lib/agent/types'

interface ThreadSidebarProps {
  sessionId: string
}

type EditedFileSummary = {
  displayPath: string
  repoPath: string | null
  operation: EditedFileInfo['operation']
  toolUsed: string
  count: number
  timestamp: string
}

export function ThreadSidebar({ sessionId }: ThreadSidebarProps) {
  // Use combined query for better performance (single query instead of two)
  const { data: sessionWithMetadata } = trpc.agent.getSessionWithMetadata.useQuery(
    { id: sessionId },
    { refetchInterval: 2000 } // Update every 2s for live stats
  )

  // Used to translate workingDir-relative paths into repo-root-relative paths for /git links.
  const { data: cwdPrefix } = trpc.git.cwdPrefix.useQuery(undefined, {
    staleTime: Infinity,
  })

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

  // Group files by operation for improved display
  const filesByOperation = metadata?.editedFiles
    ? groupFilesByOperation(metadata.editedFiles, session.workingDir, cwdPrefix)
    : null

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

        {/* 3. CHANGED FILES - Key actionable information */}
        {filesByOperation && (
          <Section title="Changed Files">
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              {filesByOperation.creates.length > 0 && (
                <span className="text-chart-2">+{filesByOperation.creates.length}</span>
              )}
              {filesByOperation.edits.length > 0 && (
                <span className="text-primary">~{filesByOperation.edits.length}</span>
              )}
              {filesByOperation.deletes.length > 0 && (
                <span className="text-destructive">−{filesByOperation.deletes.length}</span>
              )}
              <span className="text-muted-foreground ml-auto">
                {filesByOperation.totalUnique} files
              </span>
            </div>
            <FilesGroupDisplay files={filesByOperation} />
          </Section>
        )}

        {/* 4. GIT - Always visible, integrated into main flow */}
        <GitSection sessionId={sessionId} />

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

type FilesByOperationType = {
  creates: EditedFileSummary[]
  edits: EditedFileSummary[]
  deletes: EditedFileSummary[]
  totalUnique: number
}

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

function groupFilesByOperation(
  editedFiles: EditedFileInfo[],
  workingDir: string,
  cwdPrefix?: string
): FilesByOperationType {
  const byPath = new Map<string, EditedFileSummary>()

  for (const f of editedFiles) {
    const displayPath = toWorkingRelPath(f.path, workingDir, cwdPrefix)
    const repoPath =
      cwdPrefix !== undefined ? toRepoRelativePath(f.path, workingDir, cwdPrefix) : null

    const existing = byPath.get(displayPath)
    if (!existing) {
      byPath.set(displayPath, {
        displayPath,
        repoPath,
        operation: f.operation,
        toolUsed: f.toolUsed,
        count: 1,
        timestamp: f.timestamp,
      })
      continue
    }

    existing.count++
    if (new Date(f.timestamp).getTime() >= new Date(existing.timestamp).getTime()) {
      existing.operation = f.operation
      existing.toolUsed = f.toolUsed
      existing.timestamp = f.timestamp
      if (!existing.repoPath && repoPath) {
        existing.repoPath = repoPath
      }
    }
  }

  const files = Array.from(byPath.values())
  return {
    creates: files.filter((f) => f.operation === 'create'),
    edits: files.filter((f) => f.operation === 'edit'),
    deletes: files.filter((f) => f.operation === 'delete'),
    totalUnique: files.length,
  }
}

function FilesGroupDisplay({ files }: { files: FilesByOperationType }) {
  const [showAll, setShowAll] = useState(false)
  const allFiles = [...files.creates, ...files.edits, ...files.deletes].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const maxVisible = 10
  const hasMore = allFiles.length > maxVisible
  const filesToShow = showAll || !hasMore ? allFiles : allFiles.slice(0, maxVisible)

  return (
    <div className="space-y-1">
      {filesToShow.map((file) => (
        <FileRow key={`${file.displayPath}-${file.timestamp}`} file={file} />
      ))}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-[10px] font-vcr text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showAll ? '▴ Show less' : `▾ Show ${allFiles.length - maxVisible} more`}
        </button>
      )}
    </div>
  )
}

function GitSection({ sessionId }: { sessionId: string }) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = useState("")
  const utils = trpc.useUtils()

  // Fetch session to check for worktree info
  const { data: session } = trpc.agent.get.useQuery({ id: sessionId })

  // Git status query - automatically scoped to session's worktree via tRPC context
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    refetchInterval: 3000,
  })

  // Changed files from session - dedupe to get unique files
  const { data: rawChangedFiles = [] } = trpc.agent.getChangedFiles.useQuery({ sessionId })
  const changedFiles = useMemo(() => dedupeEditedFiles(rawChangedFiles), [rawChangedFiles])

  // Commit mutation
  const commitMutation = trpc.git.commitScoped.useMutation({
    onSuccess: () => {
      setSelectedFiles(new Set())
      setCommitMessage("")
      utils.git.status.invalidate()
      utils.agent.getChangedFiles.invalidate()
    },
  })

  const canCommit = selectedFiles.size > 0 && commitMessage.trim().length > 0 && !commitMutation.isPending

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
          <Loader2 className="w-3 h-3 animate-spin" />
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
              className="text-[10px] font-vcr text-muted-foreground hover:text-foreground"
            >
              {selectedFiles.size === changedFiles.length ? "none" : "all"}
            </button>
          </div>

          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {changedFiles.map((file) => (
              <label
                key={file.path}
                className="flex items-center gap-2 text-xs hover:bg-secondary/60 rounded px-1 py-0.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFile(file.path)}
                  className="w-3 h-3 rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-foreground/70 truncate text-[10px]">
                    {file.relativePath || file.path}
                  </div>
                </div>
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
              </label>
            ))}
          </div>

          {/* Commit form */}
          <div className="space-y-2">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              className="w-full min-h-[60px] px-2 py-1.5 text-xs rounded border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              disabled={commitMutation.isPending}
            />

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
                className="px-2 py-1 text-[10px] font-vcr rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {commitMutation.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    committing...
                  </>
                ) : (
                  <>
                    <GitCommit className="w-3 h-3" />
                    commit
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status messages */}
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
    </Section>
  )
}

function FileRow({ file }: { file: EditedFileSummary }) {
  const operationColors = {
    create: 'text-chart-2',
    edit: 'text-primary',
    delete: 'text-destructive',
  }

  const operationIcons = {
    create: '+',
    edit: '~',
    delete: '−',
  }

  const toolLabel = file.count > 1 ? `${file.toolUsed} · ${file.count}×` : file.toolUsed

  const row = (
    <div className="flex items-start gap-1.5 text-xs hover:bg-secondary/60 rounded px-1 py-0.5 transition-colors">
      <span
        className={`font-mono font-bold mt-0.5 ${operationColors[file.operation as keyof typeof operationColors]}`}
      >
        {operationIcons[file.operation as keyof typeof operationIcons]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-foreground/70 truncate text-[10px]">{truncatePath(file.displayPath)}</div>
        <div className="font-vcr text-muted-foreground text-[9px]">{toolLabel}</div>
      </div>
    </div>
  )

  if (!file.repoPath) return row

  return (
    <Link
      to="/git"
      search={{ file: file.repoPath, view: 'working' }}
      title={`Open diff: ${file.repoPath}`}
      className="block"
    >
      {row}
    </Link>
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

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, '/')
}

function trimLeadingDotSlash(path: string): string {
  return path.replace(/^\.\/+/, '')
}

function trimTrailingSlash(path: string): string {
  return path.replace(/\/+$/, '')
}

function toWorkingRelPath(path: string, workingDir: string, cwdPrefix?: string): string {
  const cleaned = trimLeadingDotSlash(normalizeSlashes(path))
  const wd = trimTrailingSlash(normalizeSlashes(workingDir))
  const prefix = trimTrailingSlash(normalizeSlashes(cwdPrefix ?? ''))

  if (cleaned.startsWith(wd + '/')) {
    return cleaned.slice(wd.length + 1)
  }
  if (prefix && (cleaned === prefix || cleaned.startsWith(prefix + '/'))) {
    return cleaned.slice(prefix.length).replace(/^\/+/, '')
  }
  return cleaned
}

function toRepoRelativePath(path: string, workingDir: string, cwdPrefix: string): string | null {
  const cleaned = trimLeadingDotSlash(normalizeSlashes(path))
  const prefix = trimTrailingSlash(normalizeSlashes(cwdPrefix))
  const wd = trimTrailingSlash(normalizeSlashes(workingDir))

  if (cleaned.startsWith('/')) {
    if (!cleaned.startsWith(wd + '/')) return null
    const relToWorkingDir = cleaned.slice(wd.length + 1)
    return prefix ? `${prefix}/${relToWorkingDir}` : relToWorkingDir
  }

  if (prefix && (cleaned === prefix || cleaned.startsWith(prefix + '/'))) {
    return cleaned
  }

  const rel = cleaned.replace(/^\/+/, '')
  return prefix ? `${prefix}/${rel}` : rel
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
