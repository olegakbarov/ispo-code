/**
 * Resume history display for agent sessions
 * Shows history of resume attempts with success/failure indicators
 */

import { CheckCircle2, Circle } from 'lucide-react'
import type { ResumeHistoryEntry } from '@/lib/agent/types'

/** Resume history display */
export function ResumeHistory({ history }: { history: ResumeHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {history.map((entry, i) => (
        <div key={i} className="text-[10px] border-l-2 pl-2 py-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            {entry.success ? (
              <CheckCircle2 className="w-3 h-3 text-chart-2" />
            ) : (
              <Circle className="w-3 h-3 text-destructive" />
            )}
            <span className="text-muted-foreground">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-foreground/70 truncate">
            {entry.message.slice(0, 50)}{entry.message.length > 50 ? '...' : ''}
          </div>
          {entry.error && (
            <div className="text-destructive mt-0.5 truncate">
              {entry.error}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
