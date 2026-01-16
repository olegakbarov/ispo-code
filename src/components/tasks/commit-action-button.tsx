/**
 * Commit Action Button Component
 * CTA button for committing and archiving task changes
 */

import { GitCommit } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CommitActionButtonProps {
  fileCount: number
  onCommitAndArchive: () => void
}

export function CommitActionButton({ fileCount, onCommitAndArchive }: CommitActionButtonProps) {
  return (
    <div className="shrink-0 border-t border-border p-4 bg-card">
      <Button
        onClick={onCommitAndArchive}
        disabled={fileCount === 0}
        aria-label="Commit all changes and archive this task"
        variant="default"
        size="default"
        className="w-full flex items-center justify-center gap-2"
      >
        <GitCommit className="w-4 h-4" aria-hidden="true" />
        Commit and Archive
      </Button>
      <div className="text-xs text-muted-foreground text-center mt-2">
        {fileCount} file{fileCount === 1 ? "" : "s"} will be committed
      </div>
    </div>
  )
}
