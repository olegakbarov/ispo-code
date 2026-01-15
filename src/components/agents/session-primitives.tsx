/**
 * Shared UI primitives for agent session displays
 * Used by both $sessionId route and ThreadSidebar
 */

import { useState } from 'react'
import type { SessionStatus } from '@/lib/agent/types'
import { Spinner } from '@/components/ui/spinner'

/** Section container with title */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-vcr text-xs text-muted-foreground uppercase tracking-wide">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

/** Collapsible section with expand/collapse state (persisted in localStorage) */
export function CollapsibleSection({
  title,
  summary,
  storageKey,
  defaultCollapsed = false,
  children,
}: {
  title: string
  summary?: string
  storageKey: string
  defaultCollapsed?: boolean
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    return stored !== null ? stored === 'true' : defaultCollapsed
  })

  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem(storageKey, String(newState))
  }

  return (
    <div className="space-y-2">
      <button
        onClick={toggleCollapsed}
        className="w-full flex items-center justify-between font-vcr text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        <span>{title}</span>
        <span className="text-[10px]">{isCollapsed ? '▸' : '▾'}</span>
      </button>
      {isCollapsed && summary && (
        <div className="text-[10px] font-mono text-muted-foreground">{summary}</div>
      )}
      {!isCollapsed && <div className="space-y-1.5">{children}</div>}
    </div>
  )
}

/** Label-value row for metadata display */
export function InfoRow({
  label,
  value,
  className = '',
}: {
  label: string
  value: string | number | undefined
  className?: string
}) {
  if (value === undefined) return null

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-vcr text-muted-foreground">{label}</span>
      <span className={`font-mono ${className || 'text-foreground/70'}`}>{value}</span>
    </div>
  )
}

const statusBadgeConfig: Record<SessionStatus, { color: string; label: string }> = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Starting' },
  running: { color: 'bg-primary/20 text-primary', label: 'Running' },
  working: { color: 'bg-primary/20 text-primary', label: 'Thinking' },
  waiting_approval: { color: 'bg-chart-4/20 text-chart-4', label: 'Needs Approval' },
  waiting_input: { color: 'bg-chart-2/20 text-chart-2', label: 'Your Turn' },
  idle: { color: 'bg-chart-2/20 text-chart-2', label: 'Your Turn' },
  completed: { color: 'bg-secondary text-foreground/70', label: 'Finished' },
  failed: { color: 'bg-destructive/20 text-destructive', label: 'Failed' },
  cancelled: { color: 'bg-muted text-muted-foreground', label: 'Cancelled' },
}

/** Status badge with colored background */
export function StatusBadge({ status }: { status: SessionStatus }) {
  const config = statusBadgeConfig[status] ?? statusBadgeConfig.pending

  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className={`px-2 py-1 rounded text-[10px] font-vcr uppercase tracking-wide ${config.color}`}
      >
        {config.label}
      </span>
    </div>
  )
}

const statusDotConfig: Record<SessionStatus, { color: string; pulse?: boolean; spin?: boolean; label: string }> = {
  pending: { color: 'bg-muted-foreground', label: 'pending' },
  working: { color: 'text-primary', spin: true, label: 'working' },
  waiting_approval: { color: 'bg-destructive', pulse: true, label: 'approval' },
  waiting_input: { color: 'bg-chart-2', label: 'ready' },
  idle: { color: 'bg-chart-2', label: 'idle' },
  completed: { color: 'bg-foreground/50', label: 'done' },
  failed: { color: 'bg-destructive', label: 'failed' },
  cancelled: { color: 'bg-chart-4', label: 'cancelled' },
  running: { color: 'text-primary', spin: true, label: 'working' },
}

/** Compact status indicator with dot and label */
export function StatusDot({ status }: { status: SessionStatus }) {
  const c = statusDotConfig[status] ?? { color: 'bg-muted-foreground', label: status }

  return (
    <div className="flex items-center gap-1">
      {c.spin ? (
        <Spinner size="xs" className={c.color} />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${c.color} ${c.pulse ? 'animate-pulse' : ''}`} />
      )}
      <span className="font-vcr text-muted-foreground">{c.label}</span>
    </div>
  )
}

/** Progress bar for token usage with threshold markers */
export function ProgressBar({
  value,
  max,
  label,
  showThresholds = true,
  showRemaining = false,
}: {
  value: number
  max: number
  label: string
  showThresholds?: boolean
  showRemaining?: boolean
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const remaining = max - value

  // Color based on utilization
  const color = percentage > 80 ? 'bg-destructive' : percentage > 60 ? 'bg-chart-4' : 'bg-chart-1'
  const textColor = percentage > 80 ? 'text-destructive' : percentage > 60 ? 'text-chart-4' : 'text-foreground/70'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-vcr text-muted-foreground">Tokens</span>
        <span className={`font-mono ${textColor}`}>{label}</span>
      </div>
      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        {/* Progress bar */}
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${percentage}%` }} />

        {/* Threshold markers */}
        {showThresholds && (
          <>
            <div className="absolute left-[60%] top-0 bottom-0 w-px bg-border" />
            <div className="absolute left-[80%] top-0 bottom-0 w-px bg-destructive/30" />
          </>
        )}
      </div>
      {showRemaining && remaining > 0 && (
        <div className="flex items-center justify-between text-[9px]">
          <span className="font-vcr text-muted-foreground">Remaining</span>
          <span className="font-mono text-foreground/50">{formatContextNumber(remaining)}</span>
        </div>
      )}
    </div>
  )
}

function formatContextNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}
