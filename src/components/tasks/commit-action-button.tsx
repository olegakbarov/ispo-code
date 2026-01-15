/**
 * Commit Action Button Component
 * CTA button for committing and archiving task changes
 */

import { GitCommit } from "lucide-react"

interface CommitActionButtonProps {
  fileCount: number
  onCommitAndArchive: () => void
}

export function CommitActionButton({ fileCount, onCommitAndArchive }: CommitActionButtonProps) {
  return (
    <div className="border-t border-border p-4">
      <button
        onClick={onCommitAndArchive}
        disabled={fileCount === 0}
        aria-label="Commit all changes and archive this task"
        className="w-full px-4 py-3 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <GitCommit className="w-4 h-4" aria-hidden="true" />
        Commit and Archive
      </button>
      <div className="text-xs text-muted-foreground text-center mt-2">
        {fileCount} file{fileCount === 1 ? "" : "s"} will be committed
      </div>
    </div>
  )
}
