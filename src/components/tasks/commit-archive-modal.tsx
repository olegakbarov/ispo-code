/**
 * Modal for one-click commit and archive workflow
 * Auto-generates commit message, commits all files, archives task
 */

import { useState, useEffect } from 'react'
import { trpc } from '@/lib/trpc-client'
import { Loader2, GitCommit, Archive, FileText, RefreshCw } from 'lucide-react'

interface CommitArchiveModalProps {
  isOpen: boolean
  taskPath: string
  taskTitle: string
  taskContent?: string
  /** Pre-generated commit message (from completion detection) */
  initialMessage?: string | null
  /** Whether the initial message is still being generated */
  isGeneratingInitial?: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CommitArchiveModal({
  isOpen,
  taskPath,
  taskTitle,
  taskContent,
  initialMessage,
  isGeneratingInitial,
  onClose,
  onSuccess,
}: CommitArchiveModalProps) {
  const utils = trpc.useUtils()

  // Local state
  const [commitMessage, setCommitMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch changed files for this task
  const { data: changedFiles = [], isLoading: filesLoading } = trpc.tasks.getChangedFilesForTask.useQuery(
    { path: taskPath },
    { enabled: isOpen && !!taskPath }
  )

  // Git-relative paths for commit
  const gitRelativeFiles = changedFiles.map(f => f.repoRelativePath || f.relativePath || f.path)

  // Generate commit message mutation
  const generateMutation = trpc.git.generateCommitMessage.useMutation({
    onSuccess: (data) => {
      setCommitMessage(data.message)
    },
    onError: (err) => {
      setError(`Failed to generate message: ${err.message}`)
    },
  })

  // Commit mutation
  const commitMutation = trpc.git.commitScoped.useMutation({
    onError: (err) => {
      setError(`Commit failed: ${err.message}`)
    },
  })

  // Archive mutation
  const archiveMutation = trpc.tasks.archive.useMutation({
    onMutate: async ({ path }) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel()

      // Snapshot for rollback
      const previousList = utils.tasks.list.getData()

      // Optimistically mark task as archived
      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === path
            ? { ...task, archived: true, archivedAt: new Date().toISOString() }
            : task
        ))
      }

      return { previousList, path }
    },
    onSuccess: () => {
      utils.tasks.list.invalidate()
      utils.tasks.getChangedFilesForTask.invalidate()
      utils.tasks.hasUncommittedChanges.invalidate()
      onSuccess()
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      setError(`Archive failed: ${err.message}`)
    },
  })

  // Use initial message if provided, otherwise auto-generate
  useEffect(() => {
    if (!isOpen) return

    // If we have a pre-generated message, use it
    if (initialMessage && !commitMessage) {
      setCommitMessage(initialMessage)
      return
    }

    // Skip auto-generation if initial message is still being generated
    if (isGeneratingInitial) return

    // Auto-generate only if no message yet and not already generating
    if (gitRelativeFiles.length > 0 && !commitMessage && !generateMutation.isPending) {
      generateMutation.mutate({
        taskTitle,
        taskDescription: taskContent,
        files: gitRelativeFiles,
      })
    }
  }, [isOpen, gitRelativeFiles.length, initialMessage, isGeneratingInitial])

  // Reset state when modal closes
  const handleClose = () => {
    setCommitMessage('')
    setError(null)
    onClose()
  }

  // Handle regenerate
  const handleRegenerate = () => {
    setError(null)
    generateMutation.mutate({
      taskTitle,
      taskDescription: taskContent,
      files: gitRelativeFiles,
    })
  }

  // Handle commit and archive
  const handleConfirm = async () => {
    setError(null)

    try {
      // 1. Commit all files
      await commitMutation.mutateAsync({
        files: gitRelativeFiles,
        message: commitMessage,
      })

      // 2. Archive task
      await archiveMutation.mutateAsync({ path: taskPath })

      // Success callback handles navigation
    } catch {
      // Error already set by mutation onError
    }
  }

  const isProcessing = commitMutation.isPending || archiveMutation.isPending
  const canConfirm = gitRelativeFiles.length > 0 && commitMessage.trim() && !isProcessing

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg bg-panel border border-border rounded shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-accent" />
            <div className="font-vcr text-sm text-accent">Commit and Archive</div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Task info */}
          <div>
            <div className="font-vcr text-xs text-text-muted mb-1">Task:</div>
            <div className="text-sm text-text-primary truncate">{taskTitle}</div>
          </div>

          {/* Files list */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-text-muted" />
              <div className="font-vcr text-xs text-text-muted">
                Files to commit ({filesLoading ? '...' : gitRelativeFiles.length}):
              </div>
            </div>

            {filesLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-muted p-3 border border-border rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading files...
              </div>
            ) : gitRelativeFiles.length === 0 ? (
              <div className="text-sm text-text-muted p-3 border border-border rounded">
                No uncommitted changes found
              </div>
            ) : (
              <div className="max-h-[150px] overflow-y-auto border border-border rounded p-2 space-y-1 bg-background">
                {gitRelativeFiles.map((file) => (
                  <div key={file} className="text-xs text-text-secondary font-mono truncate">
                    {file}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commit message */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-vcr text-xs text-text-muted">Commit message:</div>
              <button
                onClick={handleRegenerate}
                disabled={generateMutation.isPending || gitRelativeFiles.length === 0}
                className="flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RefreshCw className={`w-3 h-3 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                {generateMutation.isPending ? 'Generating...' : 'Regenerate'}
              </button>
            </div>

            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={isProcessing}
              placeholder={generateMutation.isPending ? 'Generating commit message...' : 'Enter commit message...'}
              className="w-full h-24 p-2 text-sm bg-background border border-border rounded resize-none focus:outline-none focus:border-accent/50 disabled:opacity-50"
            />
          </div>

          {/* Error display */}
          {error && (
            <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
              {error}
            </div>
          )}

          {/* Processing status */}
          {isProcessing && (
            <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded text-sm text-accent">
              <Loader2 className="w-4 h-4 animate-spin" />
              {commitMutation.isPending ? 'Committing changes...' : 'Archiving task...'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Archive className="w-3 h-3" />
                Commit and Archive
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
