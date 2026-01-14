/**
 * ThreadSidebar - Comprehensive metadata display for agent sessions
 *
 * Shows real-time stats from MetadataAnalyzer:
 * - Session overview (status, duration, agent type)
 * - Context window usage
 * - Conversation history
 * - Tool usage statistics
 * - File operations
 * - Output metrics
 */

import { Link } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { Section, InfoRow, StatusBadge, ProgressBar } from '@/components/agents/session-primitives'
import { SidebarCommitPanel } from '@/components/agents/sidebar-commit-panel'
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

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Thread Overview */}
        <Section title="Thread">
          <StatusBadge status={session.status} />
          {session.agentType && <InfoRow label="Agent" value={session.agentType} />}
          {modelLabel && <InfoRow label="Model" value={modelLabel} />}
          <InfoRow
            label="Started"
            value={formatTimeAgo(new Date(session.startedAt))}
          />
          <InfoRow label="Duration" value={formatDuration(metadata?.duration ?? duration)} />
          {(metadata?.taskPath ?? session.taskPath) && (
            <InfoRow label="Task" value={truncatePath(metadata?.taskPath ?? session.taskPath ?? '')} />
          )}
        </Section>

        {/* Context Window */}
        {metadata?.contextWindow && (
          <Section title="Context">
            <ProgressBar
              value={metadata.contextWindow.utilizationPercent}
              max={100}
              label={`${formatNumber(metadata.contextWindow.estimatedTokens)} / ${formatNumber(metadata.contextWindow.modelLimit)}`}
            />
            <InfoRow
              label="Usage"
              value={`${metadata.contextWindow.utilizationPercent.toFixed(1)}%`}
            />
            {(metadata.outputMetrics?.toolResultChunks ?? 0) > 0 && (
              <InfoRow
                label="Tools in ctx"
                value={metadata.contextWindow.includesToolResults ? "yes" : "no"}
              />
            )}
          </Section>
        )}

        {/* Conversation */}
        <Section title="Conversation">
          {metadata?.userMessageCount !== undefined && (
            <InfoRow label="Prompts" value={metadata.userMessageCount} />
          )}
          {metadata?.assistantMessageCount !== undefined && (
            <InfoRow label="Replies" value={metadata.assistantMessageCount} />
          )}
          {metadata?.messageCount !== undefined && (
            <InfoRow label="Messages" value={metadata.messageCount} />
          )}
          {session.tokensUsed && (
            <>
              <InfoRow label="Input" value={`${formatNumber(session.tokensUsed.input)} tok`} />
              <InfoRow label="Output" value={`${formatNumber(session.tokensUsed.output)} tok`} />
              <InfoRow
                label="Total"
                value={`${formatNumber(session.tokensUsed.input + session.tokensUsed.output)} tok`}
                className="font-medium"
              />
            </>
          )}
        </Section>

        {/* Turn Info (simplified) */}
        {(metadata?.currentTurn || metadata?.lastTurn) && (
          <Section title="Turn">
            {metadata?.currentTurn && (
              <InfoRow label="Current Turn" value={`#${metadata.currentTurn.index}`} />
            )}
            {metadata?.lastTurn && (
              <>
                <InfoRow label="Last Turn" value={`#${metadata.lastTurn.index}`} />
                {metadata.lastTurn.toolCalls !== undefined && (
                  <InfoRow label="Tool Calls" value={metadata.lastTurn.toolCalls} />
                )}
              </>
            )}
          </Section>
        )}

        {/* Tools */}
        {metadata?.toolStats && metadata.toolStats.totalCalls > 0 && (
          <Section title="Tools">
            <InfoRow label="Total calls" value={metadata.toolStats.totalCalls} />
            <div className="mt-2 space-y-1">
              <ToolTypeRow label="Read" value={metadata.toolStats.byType.read} />
              <ToolTypeRow label="Write" value={metadata.toolStats.byType.write} />
              <ToolTypeRow label="Execute" value={metadata.toolStats.byType.execute} />
              {metadata.toolStats.byType.other > 0 && (
                <ToolTypeRow label="Other" value={metadata.toolStats.byType.other} />
              )}
            </div>

            {/* Top tools */}
            <div className="mt-3 space-y-1">
              <div className="font-vcr text-[10px] text-muted-foreground mb-1">Top Tools</div>
              {Object.entries(metadata.toolStats.byTool)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([tool, count]) => (
                  <ToolRow key={tool} name={tool} count={count} />
                ))}
            </div>
          </Section>
        )}

        {/* Edited Files */}
        {metadata?.editedFiles && metadata.editedFiles.length > 0 && (
          <Section title="Edited Files">
            {(() => {
              const editedFiles = metadata.editedFiles
              const totalEdits = editedFiles.length
              const byPath = new Map<string, EditedFileSummary>()

              for (const f of editedFiles) {
                const displayPath = toWorkingRelPath(f.path, session.workingDir, cwdPrefix)
                const repoPath = cwdPrefix !== undefined
                  ? toRepoRelativePath(f.path, session.workingDir, cwdPrefix)
                  : null

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

              const uniqueFiles = byPath.size
              const maxRows = 20
              const uniqueSorted = Array.from(byPath.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )
              const filesToShow =
                uniqueFiles > maxRows ? uniqueSorted.slice(-maxRows) : uniqueSorted

              return (
                <>
                  <InfoRow label="Unique" value={uniqueFiles} />
                  <InfoRow label="Total" value={totalEdits} />
                  {uniqueFiles > maxRows && (
                    <InfoRow label="Showing" value={`${maxRows} latest`} />
                  )}
                  <div className="space-y-1.5 mt-2">
                    {filesToShow.map((file) => (
                      <FileRow key={`${file.displayPath}-${file.timestamp}`} file={file} />
                    ))}
                  </div>
                </>
              )
            })()}
          </Section>
        )}

        {/* Output Metrics */}
        {metadata?.outputMetrics && (
          <Section title="Output">
            <InfoRow label="Text" value={`${metadata.outputMetrics.textChunks} chunks`} />
            <InfoRow
              label="Text chars"
              value={formatNumber(metadata.outputMetrics.totalCharacters)}
            />
            <InfoRow
              label="Text est tok"
              value={formatNumber(metadata.outputMetrics.estimatedOutputTokens)}
            />
            {(metadata.outputMetrics.toolResultChunks ?? 0) > 0 && (
              <>
                <InfoRow
                  label="Tool results"
                  value={`${metadata.outputMetrics.toolResultChunks} chunks`}
                />
                {metadata.outputMetrics.toolResultCharacters !== undefined && (
                  <InfoRow
                    label="Tool chars"
                    value={formatNumber(metadata.outputMetrics.toolResultCharacters)}
                  />
                )}
                {metadata.outputMetrics.estimatedToolResultTokens !== undefined && (
                  <InfoRow
                    label="Tool est tok"
                    value={formatNumber(metadata.outputMetrics.estimatedToolResultTokens)}
                  />
                )}
              </>
            )}
            {metadata.outputMetrics.thinkingChunks > 0 && (
              <InfoRow
                label="Thinking"
                value={`${metadata.outputMetrics.thinkingChunks} chunks`}
              />
            )}
            {metadata.outputMetrics.errorChunks > 0 && (
              <InfoRow
                label="Errors"
                value={metadata.outputMetrics.errorChunks}
                className="text-destructive"
              />
            )}
          </Section>
        )}

        {/* Error State */}
        {session.error && (
          <Section title="Error">
            <div className="text-xs text-destructive font-mono break-words">{session.error}</div>
          </Section>
        )}
      </div>

      {/* Git Commit Panel - fixed at bottom */}
      <div className="flex-shrink-0">
        <SidebarCommitPanel sessionId={sessionId} />
      </div>
    </div>
  )
}

// === Sub-components ===

function ToolTypeRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-vcr text-muted-foreground text-[10px]">{label}</span>
      <span className="font-mono text-foreground/70">{value}</span>
    </div>
  )
}

function ToolRow({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-muted-foreground text-[10px] truncate">{name}</span>
      <span className="font-mono text-foreground/70 ml-2">{count}×</span>
    </div>
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

function formatNumber(num: number): string {
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
