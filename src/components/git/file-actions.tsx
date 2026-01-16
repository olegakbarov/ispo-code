/**
 * FileActions - Action buttons for staging, unstaging, and discarding files
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface FileActionsProps {
  selectedFiles: Set<string>
  hasStaged: boolean
  hasModified: boolean
  hasUntracked: boolean
  onStage: (files: string[]) => Promise<void>
  onUnstage: (files: string[]) => Promise<void>
  onDiscard: (files: string[]) => Promise<void>
  onStageAll: () => Promise<void>
  onUnstageAll: () => Promise<void>
}

export function FileActions({
  selectedFiles,
  hasStaged,
  hasModified,
  hasUntracked,
  onStage,
  onUnstage,
  onDiscard,
  onStageAll,
  onUnstageAll,
}: FileActionsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const selectedArray = Array.from(selectedFiles)
  const hasSelection = selectedArray.length > 0

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setIsLoading(action)
    try {
      await fn()
    } finally {
      setIsLoading(null)
    }
  }

  const handleDiscard = async () => {
    setShowDiscardConfirm(false)
    await handleAction('discard', () => onDiscard(selectedArray))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-border bg-card">
      {/* Selected file actions */}
      {hasSelection && (
        <>
          <Button
            onClick={() => handleAction('stage', () => onStage(selectedArray))}
            disabled={!!isLoading}
            variant="outline"
            size="xs"
          >
            {isLoading === 'stage' ? 'Working...' : 'Stage Selected'}
          </Button>
          <Button
            onClick={() => handleAction('unstage', () => onUnstage(selectedArray))}
            disabled={!!isLoading}
            variant="outline"
            size="xs"
          >
            {isLoading === 'unstage' ? 'Working...' : 'Unstage Selected'}
          </Button>
          <Button
            onClick={() => setShowDiscardConfirm(true)}
            disabled={!!isLoading}
            variant="destructive"
            size="xs"
          >
            Discard Selected
          </Button>
        </>
      )}

      {/* Bulk actions */}
      {!hasSelection && (
        <>
          {(hasModified || hasUntracked) && (
            <Button
              onClick={() => handleAction('stage-all', onStageAll)}
              disabled={!!isLoading}
              variant="outline"
              size="xs"
            >
              {isLoading === 'stage-all' ? 'Working...' : 'Stage All'}
            </Button>
          )}
          {hasStaged && (
            <Button
              onClick={() => handleAction('unstage-all', onUnstageAll)}
              disabled={!!isLoading}
              variant="outline"
              size="xs"
            >
              {isLoading === 'unstage-all' ? 'Working...' : 'Unstage All'}
            </Button>
          )}
        </>
      )}

      {/* Discard confirmation modal */}
      {showDiscardConfirm && (
        <DiscardConfirmModal
          fileCount={selectedArray.length}
          onConfirm={handleDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  )
}

interface DiscardConfirmModalProps {
  fileCount: number
  onConfirm: () => void
  onCancel: () => void
}

function DiscardConfirmModal({
  fileCount,
  onConfirm,
  onCancel,
}: DiscardConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md">
        <h3 className="font-vcr text-lg text-destructive mb-2">Discard Changes?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This will permanently discard changes in {fileCount} file
          {fileCount !== 1 ? 's' : ''}. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            size="sm"
          >
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}
