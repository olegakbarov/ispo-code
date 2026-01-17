/**
 * Inline Commit and Archive Panel
 * Shows commit message editor and action buttons directly in sidebar
 */

import { useState, useEffect, useMemo } from "react"
import { GitCommit, RefreshCw, Archive, GitMerge, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { trpc } from "@/lib/trpc-client"
import { useTextareaDraft } from "@/lib/hooks/use-textarea-draft"
import { taskTrpcOptions } from "@/lib/trpc-task"

type CommitMode = 'commit-only' | 'commit-merge'

interface CommitActionPanelProps {
  taskPath: string
  taskTitle: string
  taskContent?: string
  fileCount: number
  gitRelativeFiles: string[]
  /** Pre-generated commit message */
  initialMessage?: string | null
  /** Whether the initial message is still being generated */
  isGeneratingInitial?: boolean
  /** Session ID for tracking merge history */
  sessionId?: string
  /** Worktree branch name if using worktree isolation */
  worktreeBranch?: string
  /** Called after successful commit */
  onCommitSuccess?: () => void
  /** Called after successful archive */
  onArchiveSuccess?: () => void
  /** Called after successful merge */
  onMergeSuccess?: () => void
}

export function CommitActionPanel({
  taskPath,
  taskTitle,
  taskContent,
  fileCount,
  gitRelativeFiles,
  initialMessage,
  isGeneratingInitial,
  sessionId,
  worktreeBranch,
  onCommitSuccess,
  onArchiveSuccess,
  onMergeSuccess,
}: CommitActionPanelProps) {
  const utils = trpc.useUtils()
  const taskTrpc = taskTrpcOptions(taskPath)

  // Local state
  const draftKey = taskPath ? `commit-archive:${taskPath}` : ''
  const [commitMessage, setCommitMessage, clearMessageDraft] = useTextareaDraft(draftKey)
  const [error, setError] = useState<string | null>(null)
  const [commitMode, setCommitMode] = useState<CommitMode>('commit-only')

  // Determine if merge is available (worktree isolation enabled)
  const canMerge = !!worktreeBranch && !!sessionId

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

  // Archive mutation
  const archiveMutation = trpc.tasks.archive.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.list.cancel()
      const previousList = utils.tasks.list.getData()
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
      onArchiveSuccess?.()
    },
    onError: (err, _variables, context) => {
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      setError(`Archive failed: ${err.message}`)
    },
  })

  // Merge mutation
  const mergeMutation = trpc.git.mergeBranch.useMutation({
    onError: (err) => {
      setError(`Merge failed: ${err.message}`)
    },
  })

  // Record merge mutation
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
    if (initialMessage && !commitMessage) {
      setCommitMessage(initialMessage)
      return
    }

    if (isGeneratingInitial) return

    if (gitRelativeFiles.length > 0 && !commitMessage && !generateMutation.isPending) {
      generateMutation.mutate({
        taskTitle,
        taskDescription: taskContent,
        files: gitRelativeFiles,
      })
    }
  }, [gitRelativeFiles.length, initialMessage, isGeneratingInitial])

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

      // 2. If merge mode, merge to main
      if (commitMode === 'commit-merge' && worktreeBranch && sessionId) {
        const mergeResult = await mergeMutation.mutateAsync({
          targetBranch: 'main',
          sourceBranch: worktreeBranch,
        })

        if (mergeResult.success && mergeResult.mergeCommitHash) {
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

      // 3. Clear draft
      clearMessageDraft()
      onCommitSuccess?.()

      // 4. Archive (only for commit-only mode)
      if (commitMode === 'commit-only') {
        try {
          await archiveMutation.mutateAsync({ path: taskPath })
        } catch (archiveErr) {
          console.error('Archive failed:', archiveErr)
        }
      }
    } catch {
      // Error already set by mutation onError
    }
  }

  const isProcessing = commitMutation.isPending || mergeMutation.isPending || archiveMutation.isPending
  const isGenerating = generateMutation.isPending || isGeneratingInitial
  const canConfirm = fileCount > 0 && commitMessage.trim() && !isProcessing

  return (
    <div className="shrink-0 border-t border-border bg-card">
      {/* Commit message */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-vcr text-muted-foreground uppercase tracking-wider">
            Commit Message
          </span>
          <button
            onClick={handleRegenerate}
            disabled={isGenerating || fileCount === 0}
            className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating' : 'Regenerate'}
          </button>
        </div>

        <Textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          disabled={isProcessing}
          placeholder={isGenerating ? 'Generating...' : 'Enter commit message...'}
          className="h-16 text-xs bg-background/50 border-border/50 focus:border-accent/50 resize-none"
        />
      </div>

      {/* Mode selection (if merge available) */}
      {canMerge && (
        <div className="px-3 pb-2 space-y-1.5">
          <label className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${commitMode === 'commit-only' ? 'bg-panel-hover' : 'hover:bg-panel-hover/50'}`}>
            <input
              type="radio"
              name="commitMode"
              checked={commitMode === 'commit-only'}
              onChange={() => setCommitMode('commit-only')}
              className="accent-accent w-3 h-3"
            />
            <Archive className="w-3 h-3 text-muted-foreground" />
            <span>Archive only</span>
          </label>

          <label className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${commitMode === 'commit-merge' ? 'bg-accent/10' : 'hover:bg-accent/5'}`}>
            <input
              type="radio"
              name="commitMode"
              checked={commitMode === 'commit-merge'}
              onChange={() => setCommitMode('commit-merge')}
              className="accent-accent w-3 h-3"
            />
            <GitMerge className="w-3 h-3 text-accent" />
            <span className="text-accent">Merge to main</span>
          </label>

          {commitMode === 'commit-merge' && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-warning">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>QA required after merge</span>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-3 pb-2 text-xs text-destructive">{error}</div>
      )}

      {/* Action button */}
      <div className="p-3 pt-0">
        <Button
          onClick={handleConfirm}
          disabled={!canConfirm}
          variant="default"
          size="default"
          className="w-full flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Spinner size="xs" />
              {commitMutation.isPending ? 'Committing...' :
               mergeMutation.isPending ? 'Merging...' :
               archiveMutation.isPending ? 'Archiving...' : 'Processing...'}
            </>
          ) : commitMode === 'commit-merge' && canMerge ? (
            <>
              <GitMerge className="w-4 h-4" />
              Commit & Merge
            </>
          ) : (
            <>
              <GitCommit className="w-4 h-4" />
              Commit & Archive
            </>
          )}
        </Button>
        <div className="text-[10px] text-muted-foreground text-center mt-1.5">
          {fileCount} file{fileCount === 1 ? "" : "s"} to commit
        </div>
      </div>
    </div>
  )
}

// Keep old export for backwards compatibility during transition
export function CommitActionButton({ fileCount, onCommitAndArchive }: { fileCount: number; onCommitAndArchive: () => void }) {
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
