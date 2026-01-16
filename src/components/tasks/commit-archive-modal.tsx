/**
 * Modal for one-click commit and archive workflow
 * Auto-generates commit message, commits all files, archives task
 * Supports optional merge-to-main with QA workflow
 */

import { useState, useEffect, useMemo } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { trpc } from '@/lib/trpc-client'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { GitCommit, Archive, FileText, RefreshCw, GitMerge, AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

type CommitMode = 'commit-only' | 'commit-merge'

interface CommitArchiveModalProps {
  isOpen: boolean
  taskPath: string
  taskTitle: string
  taskContent?: string
  /** Pre-generated commit message (from completion detection) */
  initialMessage?: string | null
  /** Whether the initial message is still being generated */
  isGeneratingInitial?: boolean
  /** Session ID for tracking merge history */
  sessionId?: string
  /** Worktree branch name if using worktree isolation */
  worktreeBranch?: string
  onClose: () => void
  /** Called after commit succeeds (modal closes immediately) */
  onCommitSuccess: () => void
  /** Called after archive completes in background */
  onArchiveSuccess: () => void
  /** Called after merge succeeds */
  onMergeSuccess?: () => void
}

export function CommitArchiveModal({
  isOpen,
  taskPath,
  taskTitle,
  taskContent,
  initialMessage,
  isGeneratingInitial,
  sessionId,
  worktreeBranch,
  onClose,
  onCommitSuccess,
  onArchiveSuccess,
  onMergeSuccess,
}: CommitArchiveModalProps) {
  const utils = trpc.useUtils()

  // Local state - use task path for scoped draft key
  const draftKey = taskPath ? `commit-archive:${taskPath}` : ''
  const [commitMessage, setCommitMessage, clearMessageDraft] = useTextareaDraft(draftKey)
  const [error, setError] = useState<string | null>(null)
  const [commitMode, setCommitMode] = useState<CommitMode>('commit-only')

  // Determine if merge is available (worktree isolation enabled)
  const canMerge = !!worktreeBranch && !!sessionId

  // OPTIMIZED: Use combined review data endpoint (same as review panel)
  const { data: reviewData, isLoading: filesLoading } = trpc.tasks.getReviewData.useQuery(
    { path: taskPath },
    { enabled: isOpen && !!taskPath }
  )
  const changedFiles = reviewData?.changedFiles ?? []
  const uncommittedFiles = reviewData?.uncommittedFiles ?? []

  // Query git status to check if task file is modified
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    enabled: isOpen && !!taskPath,
  })

  // Git-relative paths for commit (only uncommitted files, include task file if modified)
  const gitRelativeFiles = useMemo(() => {
    // Filter to only files that have uncommitted changes (same as review panel sidebar)
    const uncommittedSet = new Set(uncommittedFiles)
    const files = changedFiles
      .map(f => f.repoRelativePath || f.relativePath || f.path)
      .filter(gitPath => uncommittedSet.has(gitPath))

    // Check if task file is in git status (staged/modified/untracked)
    if (gitStatus && taskPath) {
      const taskFileModified =
        gitStatus.staged.some(f => f.file === taskPath) ||
        gitStatus.modified.some(f => f.file === taskPath) ||
        gitStatus.untracked.includes(taskPath)

      // Add task file to commit list if modified and not already included
      if (taskFileModified && !files.includes(taskPath)) {
        files.push(taskPath)
      }
    }

    return files
  }, [changedFiles, uncommittedFiles, gitStatus, taskPath])

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

  // Archive mutation - runs in background after modal closes
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
      utils.tasks.getReviewData.invalidate()
      onArchiveSuccess()
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      // Note: Modal is already closed, error handling is silent for now
      console.error('Archive failed after modal close:', err.message)
    },
  })

  // Merge mutation - merges worktree branch to main
  const mergeMutation = trpc.git.mergeBranch.useMutation({
    onError: (err) => {
      setError(`Merge failed: ${err.message}`)
    },
  })

  // Record merge mutation - stores merge info in task
  const recordMergeMutation = trpc.tasks.recordMerge.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
      onMergeSuccess?.()
    },
    onError: (err) => {
      console.error('Failed to record merge:', err.message)
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
    clearMessageDraft()
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

      // 2. If merge mode and we have a worktree branch, merge to main
      if (commitMode === 'commit-merge' && worktreeBranch && sessionId) {
        const mergeResult = await mergeMutation.mutateAsync({
          targetBranch: 'main',
          sourceBranch: worktreeBranch,
        })

        if (mergeResult.success && mergeResult.mergeCommitHash) {
          // Record the merge in task metadata (sets QA to pending)
          recordMergeMutation.mutate({
            path: taskPath,
            sessionId,
            commitHash: mergeResult.mergeCommitHash,
          })
        } else if (!mergeResult.success) {
          setError(mergeResult.error || 'Merge failed')
          return
        }
      }

      // 3. Clear draft on successful commit
      clearMessageDraft()

      // 4. Close modal immediately after successful commit (and merge if applicable)
      onCommitSuccess()

      // 5. Archive task in background (don't await) - only for commit-only mode
      // For commit-merge mode, archive after QA passes
      if (commitMode === 'commit-only') {
        archiveMutation.mutate({ path: taskPath })
      }

      // Archive success handler will trigger navigation
    } catch {
      // Error already set by mutation onError
      // Modal stays open on commit error
    }
  }

  // Only block on commit/merge mutations (archive runs in bg after modal closes)
  const isProcessing = commitMutation.isPending || mergeMutation.isPending
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
                <Spinner size="sm" />
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

            <Textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              disabled={isProcessing}
              placeholder={generateMutation.isPending ? 'Generating commit message...' : 'Enter commit message...'}
              className="h-24 bg-background"
            />
          </div>

          {/* Commit Mode Selection - only show if merge is available */}
          {canMerge && (
            <div className="border-t border-border pt-4">
              <div className="font-vcr text-xs text-text-muted mb-3">After commit:</div>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-2 rounded border border-border hover:bg-panel-hover cursor-pointer">
                  <input
                    type="radio"
                    name="commitMode"
                    value="commit-only"
                    checked={commitMode === 'commit-only'}
                    onChange={() => setCommitMode('commit-only')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs font-vcr text-text-primary">
                      <Archive className="w-3 h-3" />
                      Commit Only
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      Commit to worktree and archive task. Merge manually later.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2 rounded border border-accent/30 hover:bg-accent/5 cursor-pointer">
                  <input
                    type="radio"
                    name="commitMode"
                    value="commit-merge"
                    checked={commitMode === 'commit-merge'}
                    onChange={() => setCommitMode('commit-merge')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs font-vcr text-accent">
                      <GitMerge className="w-3 h-3" />
                      Commit & Merge to Main
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      Commit, merge to main, then QA. Archive after QA passes.
                    </div>
                  </div>
                </label>

                {commitMode === 'commit-merge' && (
                  <div className="flex items-start gap-2 p-2 bg-warning/10 border border-warning/30 rounded text-[10px] text-warning">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>
                      Merge will require manual QA. If QA fails, you can revert the merge.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
              {error}
            </div>
          )}

          {/* Processing status */}
          {isProcessing && (
            <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded text-sm text-accent">
              <Spinner size="sm" />
              {commitMutation.isPending ? 'Committing changes...' :
               mergeMutation.isPending ? 'Merging to main...' :
               'Processing...'}
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
                <Spinner size="xs" />
                Processing...
              </>
            ) : commitMode === 'commit-merge' && canMerge ? (
              <>
                <GitMerge className="w-3 h-3" />
                Commit & Merge
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
