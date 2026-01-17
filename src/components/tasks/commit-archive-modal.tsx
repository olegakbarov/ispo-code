/**
 * Modal for one-click commit and archive workflow
 * Auto-generates commit message, commits all files, archives task
 * Supports optional merge-to-main with QA workflow
 */

import { useState, useEffect, useMemo } from 'react'
import { StyledTextarea } from '@/components/ui/styled-textarea'
import { trpc } from '@/lib/trpc-client'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { taskTrpcOptions } from '@/lib/trpc-task'
import { GitCommit, Archive, RefreshCw, GitMerge, AlertTriangle } from 'lucide-react'
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
  const taskTrpc = taskTrpcOptions(taskPath)

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
    { enabled: isOpen && !!taskPath, ...taskTrpc }
  )
  const changedFiles = reviewData?.changedFiles ?? []
  const uncommittedFiles = reviewData?.uncommittedFiles ?? []

  // Query git status to check if task file is modified
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    enabled: isOpen && !!taskPath,
    ...taskTrpc,
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
    ...taskTrpc,
    onSuccess: (data) => {
      setCommitMessage(data.message)
    },
    onError: (err) => {
      setError(`Failed to generate message: ${err.message}`)
    },
  })

  // Commit mutation
  const commitMutation = trpc.git.commitScoped.useMutation({
    ...taskTrpc,
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
    ...taskTrpc,
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

      // 4. Archive task BEFORE closing modal - only for commit-only mode
      // For commit-merge mode, archive after QA passes
      // We await the archive to ensure it completes before the modal unmounts
      if (commitMode === 'commit-only') {
        try {
          await archiveMutation.mutateAsync({ path: taskPath })
        } catch (archiveErr) {
          // Log error but still close modal - commit succeeded
          console.error('Archive failed:', archiveErr)
          // Continue to close modal - commit was successful
        }
      }

      // 5. Close modal after archive completes (or immediately for merge mode)
      onCommitSuccess()

      // Archive success handler will trigger navigation
    } catch {
      // Error already set by mutation onError
      // Modal stays open on commit error
    }
  }

  // Block on all mutations since archive now runs before modal closes
  const isProcessing = commitMutation.isPending || mergeMutation.isPending || archiveMutation.isPending
  const canConfirm = gitRelativeFiles.length > 0 && commitMessage.trim() && !isProcessing

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-panel border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <GitCommit className="w-4 h-4 text-accent" />
            <span className="font-vcr text-sm text-accent tracking-wide">Commit and Archive</span>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-panel-hover transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-0">
          {/* Task row - no border-b (header already has border above) */}
          <div className="flex items-center gap-3 py-3">
            <span className="font-vcr text-[10px] text-text-muted uppercase tracking-wider w-16 shrink-0">Task</span>
            <span className="text-sm text-text-primary truncate">{taskTitle}</span>
          </div>

          {/* Files row */}
          <div className="py-3 border-b border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-vcr text-[10px] text-text-muted uppercase tracking-wider w-16 shrink-0">Files</span>
              <span className="text-xs text-text-secondary">
                {filesLoading ? '...' : gitRelativeFiles.length} to commit
              </span>
            </div>

            {filesLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-muted ml-[76px]">
                <Spinner size="xs" />
                <span>Loading...</span>
              </div>
            ) : gitRelativeFiles.length === 0 ? (
              <div className="text-xs text-text-muted ml-[76px]">No uncommitted changes</div>
            ) : (
              <div className="ml-[76px] max-h-[134px] overflow-y-auto">
                {gitRelativeFiles.map((file) => (
                  <div key={file} className="text-xs text-text-secondary font-mono truncate py-0.5">
                    {file}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message row */}
          <div className="py-3 border-b border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-vcr text-[10px] text-text-muted uppercase tracking-wider">Message</span>
              <button
                onClick={handleRegenerate}
                disabled={generateMutation.isPending || gitRelativeFiles.length === 0}
                className="flex items-center gap-1.5 text-[10px] text-accent hover:text-accent/80 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                {generateMutation.isPending ? 'Generating' : 'Regenerate'}
              </button>
            </div>

            <StyledTextarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              autoGrowValue={commitMessage}
              disabled={isProcessing}
              placeholder={generateMutation.isPending ? 'Generating...' : 'Enter commit message...'}
              variant="sm"
              className="min-h-[80px]"
            />
          </div>

          {/* Merge options - only if available */}
          {canMerge && (
            <div className="py-3 border-b border-border/50">
              <span className="font-vcr text-[10px] text-text-muted uppercase tracking-wider block mb-3">After commit</span>
              <div className="space-y-1.5">
                <label className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${commitMode === 'commit-only' ? 'bg-panel-hover' : 'hover:bg-panel-hover/50'}`}>
                  <input
                    type="radio"
                    name="commitMode"
                    checked={commitMode === 'commit-only'}
                    onChange={() => setCommitMode('commit-only')}
                    className="accent-accent"
                  />
                  <div className="flex items-center gap-2">
                    <Archive className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-xs text-text-primary">Archive only</span>
                    <span className="text-[10px] text-text-muted">— merge later</span>
                  </div>
                </label>

                <label className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${commitMode === 'commit-merge' ? 'bg-accent/10' : 'hover:bg-accent/5'}`}>
                  <input
                    type="radio"
                    name="commitMode"
                    checked={commitMode === 'commit-merge'}
                    onChange={() => setCommitMode('commit-merge')}
                    className="accent-accent"
                  />
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs text-accent">Merge to main</span>
                    <span className="text-[10px] text-text-muted">— requires QA</span>
                  </div>
                </label>

                {commitMode === 'commit-merge' && (
                  <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-warning">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>QA required after merge. Revert available if QA fails.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status messages */}
          {error && (
            <div className="py-3 text-xs text-error">{error}</div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 py-3 text-sm text-accent">
              <Spinner size="sm" />
              <span>
                {commitMutation.isPending ? 'Committing...' :
                 mergeMutation.isPending ? 'Merging...' :
                 archiveMutation.isPending ? 'Archiving...' : 'Processing...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-1.5 rounded text-xs font-medium bg-accent text-background hover:bg-accent/90 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <Spinner size="xs" />
                Processing
              </>
            ) : commitMode === 'commit-merge' && canMerge ? (
              <>
                <GitMerge className="w-3.5 h-3.5" />
                Commit & Merge
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                Commit & Archive
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
