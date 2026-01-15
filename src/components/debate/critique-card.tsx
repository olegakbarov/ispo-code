/**
 * Critique Card Component
 * Displays a single agent's critique with issues list
 */

import type { Critique, CritiqueIssue } from '@/lib/debate/types'
import { PERSONA_LABELS, SEVERITY_COLORS } from '@/lib/debate/types'
import { agentTypeLabel } from '@/lib/agent/config'

interface CritiqueCardProps {
  critique: Critique
  /** Whether to show expanded details */
  expanded?: boolean
}

function IssueItem({ issue }: { issue: CritiqueIssue }) {
  const colorClass = SEVERITY_COLORS[issue.severity]

  return (
    <div className={`p-2 rounded border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-vcr uppercase">{issue.severity}</span>
        <span className="text-xs font-medium">{issue.title}</span>
      </div>
      <p className="text-xs text-text-secondary">{issue.description}</p>
      {issue.suggestion && (
        <p className="text-xs text-text-muted mt-1 italic">
          Suggestion: {issue.suggestion}
        </p>
      )}
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: Critique['verdict'] }) {
  const colors = {
    approve: 'bg-success/20 text-success border-success/30',
    'needs-changes': 'bg-warning/20 text-warning border-warning/30',
    reject: 'bg-error/20 text-error border-error/30',
  }

  const labels = {
    approve: 'Approved',
    'needs-changes': 'Needs Changes',
    reject: 'Rejected',
  }

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-vcr border ${colors[verdict]}`}>
      {labels[verdict]}
    </span>
  )
}

export function CritiqueCard({ critique, expanded = true }: CritiqueCardProps) {
  const personaLabel = PERSONA_LABELS[critique.persona]
  const agentLabel = agentTypeLabel[critique.agentType]

  const issuesBySeverity = {
    critical: critique.issues.filter(i => i.severity === 'critical'),
    major: critique.issues.filter(i => i.severity === 'major'),
    minor: critique.issues.filter(i => i.severity === 'minor'),
    suggestion: critique.issues.filter(i => i.severity === 'suggestion'),
  }

  const issueCounts = `${issuesBySeverity.critical.length}C ${issuesBySeverity.major.length}M ${issuesBySeverity.minor.length}m ${issuesBySeverity.suggestion.length}S`

  return (
    <div className="bg-panel border border-border rounded">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-vcr text-xs text-accent">{personaLabel}</span>
          <span className="text-[10px] text-text-muted">via {agentLabel}</span>
          {critique.model && (
            <span className="text-[10px] text-text-muted">({critique.model})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">{issueCounts}</span>
          <VerdictBadge verdict={critique.verdict} />
        </div>
      </div>

      {/* Summary */}
      <div className="p-3 border-b border-border">
        <p className="text-xs text-text-secondary">{critique.summary}</p>
      </div>

      {/* Issues */}
      {expanded && critique.issues.length > 0 && (
        <div className="p-3 space-y-2">
          {issuesBySeverity.critical.map((issue, i) => (
            <IssueItem key={`critical-${i}`} issue={issue} />
          ))}
          {issuesBySeverity.major.map((issue, i) => (
            <IssueItem key={`major-${i}`} issue={issue} />
          ))}
          {issuesBySeverity.minor.map((issue, i) => (
            <IssueItem key={`minor-${i}`} issue={issue} />
          ))}
          {issuesBySeverity.suggestion.map((issue, i) => (
            <IssueItem key={`suggestion-${i}`} issue={issue} />
          ))}
        </div>
      )}

      {/* Footer with timing */}
      {critique.durationMs && (
        <div className="px-3 py-1.5 border-t border-border">
          <span className="text-[10px] text-text-muted">
            Completed in {(critique.durationMs / 1000).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  )
}
