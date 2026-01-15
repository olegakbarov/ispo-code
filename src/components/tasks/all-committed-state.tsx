/**
 * All Committed State Component
 * Success UI shown when all task changes have been committed
 */

import { Loader2, Check, Archive, RotateCcw } from "lucide-react"

interface AllCommittedStateProps {
  isArchived: boolean
  isArchiving: boolean
  isRestoring: boolean
  onArchive?: () => void
  onRestore?: () => void
}

export function AllCommittedState({
  isArchived,
  isArchiving,
  isRestoring,
  onArchive,
  onRestore,
}: AllCommittedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-4 p-6 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 w-full">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
          <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <div className="font-medium text-green-700 dark:text-green-300 text-lg">
            All Changes Committed
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">
            This task's files have been committed to git
          </div>
        </div>
      </div>

      {/* Archive/Restore button */}
      {isArchived ? (
        onRestore && (
          <button
            onClick={onRestore}
            disabled={isRestoring}
            aria-label={isRestoring ? "Restoring task" : "Restore this task"}
            className="w-full px-4 py-3 rounded-md text-sm font-medium border border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isRestoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Restore Task
              </>
            )}
          </button>
        )
      ) : (
        onArchive && (
          <button
            onClick={onArchive}
            disabled={isArchiving}
            aria-label={isArchiving ? "Archiving task" : "Archive this task"}
            className="w-full px-4 py-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isArchiving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Archiving...
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" aria-hidden="true" />
                Archive Task
              </>
            )}
          </button>
        )
      )}
    </div>
  )
}
