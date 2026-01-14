/**
 * FileActions - Action buttons for staging, unstaging, and discarding files
 */

import { useState } from 'react'

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
          <ActionButton
            onClick={() => handleAction('stage', () => onStage(selectedArray))}
            loading={isLoading === 'stage'}
            disabled={!!isLoading}
          >
            Stage Selected
          </ActionButton>
          <ActionButton
            onClick={() => handleAction('unstage', () => onUnstage(selectedArray))}
            loading={isLoading === 'unstage'}
            disabled={!!isLoading}
          >
            Unstage Selected
          </ActionButton>
          <ActionButton
            onClick={() => setShowDiscardConfirm(true)}
            variant="danger"
            disabled={!!isLoading}
          >
            Discard Selected
          </ActionButton>
        </>
      )}

      {/* Bulk actions */}
      {!hasSelection && (
        <>
          {(hasModified || hasUntracked) && (
            <ActionButton
              onClick={() => handleAction('stage-all', onStageAll)}
              loading={isLoading === 'stage-all'}
              disabled={!!isLoading}
            >
              Stage All
            </ActionButton>
          )}
          {hasStaged && (
            <ActionButton
              onClick={() => handleAction('unstage-all', onUnstageAll)}
              loading={isLoading === 'unstage-all'}
              disabled={!!isLoading}
            >
              Unstage All
            </ActionButton>
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

interface ActionButtonProps {
  children: React.ReactNode
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'danger'
}

function ActionButton({
  children,
  onClick,
  loading,
  disabled,
  variant = 'default',
}: ActionButtonProps) {
  const baseStyles =
    'px-2 py-1 font-vcr text-[10px] rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    default: 'bg-secondary text-foreground hover:bg-border',
    danger: 'bg-destructive/20 text-destructive hover:bg-destructive/30',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]}`}
    >
      {loading ? 'Working...' : children}
    </button>
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
          <button
            onClick={onCancel}
            className="px-4 py-2 font-vcr text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 font-vcr text-xs bg-destructive text-white rounded cursor-pointer hover:opacity-90"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  )
}
