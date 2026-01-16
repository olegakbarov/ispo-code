/**
 * Task Sessions Component
 * Displays all agent sessions related to a task, with active session prominently displayed
 */

import { useMemo } from 'react'
import { match, P } from 'ts-pattern'
import type { AgentType, SessionStatus } from '@/lib/agent/types'
import { Spinner } from '@/components/ui/spinner'

export interface TaskSession {
  sessionId: string
  agentType: AgentType
  title: string
  status: SessionStatus
  timestamp: string
  sessionType: 'planning' | 'review' | 'verify' | 'execution' | 'rewrite' | 'comment' | 'orchestrator'
  model?: string
  /** Source file if session originated from a file comment */
  sourceFile?: string
  /** Source line number if session originated from an inline comment */
  sourceLine?: number
  /** Output chunks for showing progress */
  output?: Array<{ type: string; content: string }>
  /** Debug run ID for grouping debug sessions */
  debugRunId?: string
}

/**
 * Grouped task sessions by type for sidebar display
 */
export interface TaskSessionsGrouped {
  planning: TaskSession[]
  review: TaskSession[]
  verify: TaskSession[]
  execution: TaskSession[]
  rewrite: TaskSession[]
  comment: TaskSession[]
  orchestrator: TaskSession[]
}

interface TaskSessionsProps {
  planning: TaskSession[]
  review: TaskSession[]
  verify: TaskSession[]
  execution: TaskSession[]
  rewrite: TaskSession[]
  comment: TaskSession[]
  orchestrator: TaskSession[]
  onCancelSession?: (sessionId: string) => void
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  pending: 'text-text-muted',
  running: 'text-accent',
  working: 'text-accent',
  waiting_approval: 'text-warning',
  waiting_input: 'text-warning',
  idle: 'text-text-muted',
  completed: 'text-success',
  failed: 'text-error',
  cancelled: 'text-text-muted',
}

/** Flow type labels and colors for active session display */
const FLOW_TYPE_CONFIG: Record<TaskSession['sessionType'], { label: string; color: string }> = {
  planning: { label: 'PLAN', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  execution: { label: 'IMPL', color: 'bg-accent/20 text-accent border-accent/30' },
  review: { label: 'REVIEW', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  verify: { label: 'VERIFY', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  rewrite: { label: 'REWRITE', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  comment: { label: 'COMMENT', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  orchestrator: { label: 'ORCH', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
}

const STATUS_ICONS: Record<SessionStatus, string | null> = {
  pending: '⏳',
  running: null, // Use spinner
  working: null, // Use spinner
  waiting_approval: '⏸',
  waiting_input: '⌨',
  idle: '💤',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
}

/** Statuses that indicate an active session */
const ACTIVE_STATUSES: SessionStatus[] = ['running', 'working', 'pending', 'waiting_approval', 'waiting_input', 'idle']

/** Statuses that should show a spinner instead of an icon */
const SPINNER_STATUSES: SessionStatus[] = ['running', 'working']

/** Extract filename from path */
function getFileName(path: string): string {
  return path.split('/').pop() || path
}

/** Get label for session status */
function getStatusLabel(status: SessionStatus): string {
  return match(status)
    .with('waiting_approval', () => 'Needs approval')
    .with('waiting_input', () => 'Waiting for input')
    .with(P.union('running', 'working'), () => 'Running')
    .with('pending', () => 'Pending')
    .with('idle', () => 'Idle')
    .with('completed', () => 'Completed')
    .with('failed', () => 'Failed')
    .with('cancelled', () => 'Cancelled')
    .otherwise(() => status)
}

/** Active Session Card - prominent display for running sessions */
function ActiveSessionCard({
  session,
  onCancel
}: {
  session: TaskSession
  onCancel?: () => void
}) {
  const statusColor = STATUS_COLORS[session.status]
  const showSpinner = SPINNER_STATUSES.includes(session.status)

  // Count tool uses for progress indication
  const toolUseCount = useMemo(() => {
    return (session.output ?? []).filter((o) => o.type === 'tool_use').length
  }, [session.output])

  // Get last meaningful output for display
  const lastOutput = useMemo(() => {
    const outputs = session.output ?? []
    for (let i = outputs.length - 1; i >= 0; i--) {
      const chunk = outputs[i]
      if (chunk.type === 'text' || chunk.type === 'tool_use' || chunk.type === 'system') {
        const content = chunk.content.slice(0, 80)
        return content + (chunk.content.length > 80 ? '...' : '')
      }
    }
    return null
  }, [session.output])

  const handleClick = () => {
    // Session is already visible in current task UI - no navigation needed
    // TODO: Could add visual feedback or expand session details in sidebar
  }

  return (
    <div className={`rounded-lg border ${statusColor === 'text-accent' ? 'border-accent/50 bg-accent/5' : 'border-warning/50 bg-warning/5'}`}>
      <button
        onClick={handleClick}
        className="w-full text-left p-3 hover:bg-white/5 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2 mb-1">
          {showSpinner ? (
            <Spinner size="sm" className={statusColor} />
          ) : (
            <span className={`text-sm ${statusColor}`}>
              {STATUS_ICONS[session.status]}
            </span>
          )}
          <span className={`text-xs font-vcr ${statusColor}`}>
            {getStatusLabel(session.status)}
          </span>
          <span className={`text-[9px] font-vcr px-1.5 py-0.5 rounded border ${FLOW_TYPE_CONFIG[session.sessionType].color}`}>
            {FLOW_TYPE_CONFIG[session.sessionType].label}
          </span>
          {toolUseCount > 0 && (
            <span className="text-[10px] text-text-muted">
              ({toolUseCount} ops)
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-secondary font-mono truncate">
          {session.model || session.agentType}
        </div>
        {lastOutput && (
          <div className="mt-1 text-[10px] text-text-muted truncate font-mono">
            {lastOutput}
          </div>
        )}
      </button>
      {onCancel && SPINNER_STATUSES.includes(session.status) && (
        <div className="border-t border-current/20 px-3 py-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCancel()
            }}
            className={`w-full px-2 py-1 rounded text-[10px] font-vcr border border-current/30 hover:bg-current/10 cursor-pointer transition-colors ${statusColor}`}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

/** Compact session card for completed sessions */
function SessionCard({ session }: { session: TaskSession }) {
  const statusColor = STATUS_COLORS[session.status]
  const statusIcon = STATUS_ICONS[session.status]
  const showSpinner = SPINNER_STATUSES.includes(session.status)

  const handleClick = () => {
    // Session is already visible in current task UI - no navigation needed
    // TODO: Could add visual feedback or expand session details in sidebar
  }

  // Format timestamp to relative time
  const getRelativeTime = (timestamp: string) => {
    const now = new Date().getTime()
    const then = new Date(timestamp).getTime()
    const diffMs = now - then
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    return `${diffDays}d`
  }

  // Build source location label for comment sessions
  const sourceLabel = session.sourceFile
    ? session.sourceLine
      ? `${getFileName(session.sourceFile)}:${session.sourceLine}`
      : getFileName(session.sourceFile)
    : null

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-2 py-1.5 rounded hover:bg-panel-hover transition-colors group"
      title={session.title}
    >
      <div className="flex items-center gap-2">
        {showSpinner ? (
          <Spinner size="xs" className={`shrink-0 ${statusColor}`} />
        ) : (
          <span className={`shrink-0 text-xs ${statusColor}`} title={session.status}>
            {statusIcon}
          </span>
        )}
        <span className="flex-1 min-w-0 text-[11px] font-mono text-text-secondary truncate group-hover:text-text-primary">
          {session.model || session.agentType}
        </span>
        <span className="shrink-0 text-[10px] text-text-muted tabular-nums">
          {getRelativeTime(session.timestamp)}
        </span>
      </div>
      {sourceLabel && (
        <div className="ml-5 mt-0.5 text-[10px] text-accent truncate" title={session.sourceFile}>
          📄 {sourceLabel}
        </div>
      )}
    </button>
  )
}

function SessionGroup({ title, sessions }: { title: string; sessions: TaskSession[] }) {
  if (sessions.length === 0) return null

  return (
    <div className="mb-2">
      <h4 className="text-[10px] font-vcr text-text-muted mb-1 uppercase tracking-wider">
        {title} ({sessions.length})
      </h4>
      <div className="space-y-0.5">
        {sessions.map((session) => (
          <SessionCard key={session.sessionId} session={session} />
        ))}
      </div>
    </div>
  )
}

export function TaskSessions({
  planning,
  review,
  verify,
  execution,
  rewrite,
  comment,
  orchestrator,
  onCancelSession
}: TaskSessionsProps) {
  const allSessions = [...planning, ...review, ...verify, ...execution, ...rewrite, ...comment, ...orchestrator]

  // Find active sessions
  const activeSessions = allSessions.filter(s => ACTIVE_STATUSES.includes(s.status))

  // Get completed/inactive sessions by group
  const completedPlanning = planning.filter(s => !ACTIVE_STATUSES.includes(s.status))
  const completedReview = review.filter(s => !ACTIVE_STATUSES.includes(s.status))
  const completedVerify = verify.filter(s => !ACTIVE_STATUSES.includes(s.status))
  const completedExecution = execution.filter(s => !ACTIVE_STATUSES.includes(s.status))
  const completedRewrite = rewrite.filter(s => !ACTIVE_STATUSES.includes(s.status))
  const completedComment = comment.filter(s => !ACTIVE_STATUSES.includes(s.status))
  const completedOrchestrator = orchestrator.filter(s => !ACTIVE_STATUSES.includes(s.status))

  const hasCompletedSessions = completedPlanning.length + completedReview.length +
    completedVerify.length + completedExecution.length + completedRewrite.length +
    completedComment.length + completedOrchestrator.length > 0

  if (allSessions.length === 0) {
    return (
      <div className="p-4 border border-border/40 rounded text-center">
        <p className="text-xs text-text-muted">No sessions yet</p>
        <p className="text-[10px] text-text-muted mt-1">
          Sessions will appear here when you run an agent
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Active Sessions - Prominent Display */}
      {activeSessions.length > 0 && (
        <div className="space-y-2">
          {activeSessions.map((session) => (
            <ActiveSessionCard
              key={session.sessionId}
              session={session}
              onCancel={onCancelSession ? () => onCancelSession(session.sessionId) : undefined}
            />
          ))}
        </div>
      )}

      {/* Completed Sessions - Grouped */}
      {hasCompletedSessions && (
        <div className="space-y-1">
          <SessionGroup title="Orchestrator" sessions={completedOrchestrator} />
          <SessionGroup title="Planning" sessions={completedPlanning} />
          <SessionGroup title="Rewrite" sessions={completedRewrite} />
          <SessionGroup title="Execution" sessions={completedExecution} />
          <SessionGroup title="Review" sessions={completedReview} />
          <SessionGroup title="Verify" sessions={completedVerify} />
          <SessionGroup title="Comments" sessions={completedComment} />
        </div>
      )}
    </div>
  )
}
