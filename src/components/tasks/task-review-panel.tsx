/**
 * Task Review Panel Component
 * Shows all files changed across task sessions with diff view and commit functionality
 *
 * SIMPLIFIED: Flat file list, single active file for diff, no selection checkboxes
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { trpc } from "@/lib/trpc-client"
import { taskTrpcOptions } from "@/lib/trpc-task"
import { Spinner } from "@/components/ui/spinner"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { DiffPanel, type GitStatus, type DiffData } from "@/components/git/diff-panel"
import { type GitDiffView } from "@/components/git/file-list"
import { useTheme } from "@/components/theme"
import { AllCommittedState, ArchivedTaskActions } from "./all-committed-state"

interface TaskReviewPanelProps {
  taskPath: string
  taskTitle: string
  taskDescription?: string
  isArchived?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onArchive?: () => void
  onRestore?: () => void
  onUnarchiveWithAgent?: () => void
  /** Pre-generated commit message */
  initialCommitMessage?: string | null
  /** Whether the initial message is still being generated */
  isGeneratingCommitMessage?: boolean
  /** Session ID for tracking merge history */
  sessionId?: string
  /** Worktree branch name if using worktree isolation */
  worktreeBranch?: string
  /** Called after successful archive */
  onArchiveSuccess?: () => void
  /** Called after successful merge */
  onMergeSuccess?: () => void
  /** Selected file from URL (git-relative path) */
  reviewFile?: string
  /** Callback when active file changes (for URL sync) */
  onReviewFileChange?: (file: string | null) => void
}

export function TaskReviewPanel({
  taskPath,
  taskTitle,
  taskDescription,
  isArchived = false,
  isArchiving = false,
  isRestoring = false,
  onArchive,
  onRestore,
  onUnarchiveWithAgent,
  initialCommitMessage,
  isGeneratingCommitMessage,
  sessionId,
  worktreeBranch,
  onArchiveSuccess,
  onMergeSuccess,
  reviewFile,
  onReviewFileChange,
}: TaskReviewPanelProps) {
  const { theme } = useTheme()
  const utils = trpc.useUtils()
  const { data: workingDir } = trpc.system.workingDir.useQuery()
  const taskTrpc = taskTrpcOptions(taskPath)

  // OPTIMIZED: Use combined endpoint for review data (changed files + uncommitted status)
  const { data: reviewData, isLoading: filesLoading } = trpc.tasks.getReviewData.useQuery(
    { path: taskPath },
    { enabled: !!taskPath, ...taskTrpc }
  )
  const changedFiles = reviewData?.changedFiles ?? []

  // Query git status for the repo
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    enabled: !!workingDir,
    ...taskTrpc,
  })

  // Simplified state - single active file for diff viewing
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<DiffData | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  // Track session working directory for active file (for worktree diff queries)
  const [activeFileWorkingDir, setActiveFileWorkingDir] = useState<string | undefined>(undefined)

  // Resolve theme for diff viewer
  const resolvedTheme = theme === "system"
    ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme

  // Uncommitted status from getReviewData
  const uncommittedStatus = reviewData ? {
    hasUncommitted: reviewData.hasUncommitted,
    uncommittedCount: reviewData.uncommittedCount,
    uncommittedFiles: reviewData.uncommittedFiles,
  } : undefined

  // Derive "all committed" state
  const allCommitted = changedFiles.length > 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted

  // Filter to only uncommitted files (excluding task file) - flat list, no session grouping
  const uncommittedFiles = useMemo(() => {
    if (!uncommittedStatus?.uncommittedFiles) return changedFiles
    const uncommittedSet = new Set(uncommittedStatus.uncommittedFiles)
    return changedFiles.filter(f => {
      const gitPath = f.repoRelativePath || f.relativePath || f.path
      if (gitPath === taskPath) return false
      return uncommittedSet.has(gitPath)
    })
  }, [changedFiles, uncommittedStatus, taskPath])

  // Transform git status for DiffPanel
  const diffPanelStatus: GitStatus | undefined = gitStatus ? {
    staged: gitStatus.staged,
    modified: gitStatus.modified,
    untracked: gitStatus.untracked,
  } : undefined

  // Track previous reviewFile to detect external changes (e.g., sidebar clicks)
  const prevReviewFileRef = useRef<string | undefined>(reviewFile)
  const autoOpenedRef = useRef(false)

  // Helper to fetch diff for a file
  const fetchDiff = useCallback((gitPath: string, sessionWorkingDir?: string) => {
    setDiffLoading(true)
    utils.client.git.diff.query({ file: gitPath, view: "working", workingDir: sessionWorkingDir })
      .then((data) => {
        setDiffData({
          oldContent: data.oldContent,
          newContent: data.newContent,
        })
        setDiffLoading(false)
      })
      .catch(() => {
        setDiffData(null)
        setDiffLoading(false)
      })
  }, [utils])

  // Sync reviewFile prop to local activeFile state (handles sidebar clicks and URL changes)
  useEffect(() => {
    const prevReviewFile = prevReviewFileRef.current
    prevReviewFileRef.current = reviewFile

    // Skip if reviewFile hasn't changed
    if (reviewFile === prevReviewFile) return
    // Skip if no reviewFile provided
    if (!reviewFile) return
    // Skip if files not loaded yet
    if (uncommittedFiles.length === 0) return

    const matchingFile = uncommittedFiles.find(f => {
      const gitPath = f.repoRelativePath || f.relativePath || f.path
      return gitPath === reviewFile
    })

    if (matchingFile) {
      const gitPath = matchingFile.repoRelativePath || matchingFile.relativePath || matchingFile.path
      setActiveFile(gitPath)
      setActiveFileWorkingDir(matchingFile.sessionWorkingDir)
      fetchDiff(gitPath, matchingFile.sessionWorkingDir)
    }
  }, [reviewFile, uncommittedFiles, fetchDiff])

  // Auto-open first file when entering review with no reviewFile
  useEffect(() => {
    if (autoOpenedRef.current) return
    if (reviewFile) return
    if (activeFile) return
    if (uncommittedFiles.length === 0) return

    const firstFile = uncommittedFiles[0]
    const gitPath = firstFile.repoRelativePath || firstFile.relativePath || firstFile.path
    autoOpenedRef.current = true

    setActiveFile(gitPath)
    setActiveFileWorkingDir(firstFile.sessionWorkingDir)
    fetchDiff(gitPath, firstFile.sessionWorkingDir)
  }, [reviewFile, activeFile, uncommittedFiles, fetchDiff])

  // Sync activeFile changes to URL (when user interacts with diff panel)
  const prevActiveFileRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevActiveFileRef.current
    prevActiveFileRef.current = activeFile
    if (prev === activeFile) return
    // Only sync to URL if this change didn't come from reviewFile prop
    if (activeFile === reviewFile) return
    onReviewFileChange?.(activeFile)
  }, [activeFile, reviewFile, onReviewFileChange])

  // DiffPanel handlers (simplified - no multi-file support needed)
  const handleSelectFile = useCallback((file: string) => {
    // Re-fetch diff for the same file (should rarely be called)
    fetchDiff(file, activeFileWorkingDir)
  }, [fetchDiff, activeFileWorkingDir])

  const handleCloseFile = useCallback(() => {
    setActiveFile(null)
    setDiffData(null)
    setActiveFileWorkingDir(undefined)
  }, [])

  const handleViewChange = useCallback(() => {
    // View change not needed for task review (always working)
  }, [])

  const handleFetchDiff = useCallback(async (file: string, view: GitDiffView): Promise<DiffData> => {
    const result = await utils.client.git.diff.query({ file, view })
    return {
      oldContent: result.oldContent,
      newContent: result.newContent,
    }
  }, [utils])

  if (filesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    )
  }

  if (uncommittedFiles.length === 0 && !allCommitted) {
    if (isArchived) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
            <div className="w-full rounded-lg border border-border bg-card p-4">
              <div className="text-base font-medium text-foreground">
                This task is archived
              </div>
              <div className="text-sm text-muted-foreground">
                No files changed yet. Unarchive to resume work.
              </div>
            </div>
            <ArchivedTaskActions
              isRestoring={isRestoring}
              onRestore={onRestore}
              onUnarchiveWithAgent={onUnarchiveWithAgent}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
        No files changed yet
      </div>
    )
  }

  if (allCommitted) {
    return (
      <AllCommittedState
        isArchived={isArchived}
        isArchiving={isArchiving}
        isRestoring={isRestoring}
        onArchive={onArchive}
        onRestore={onRestore}
        onUnarchiveWithAgent={onUnarchiveWithAgent}
      />
    )
  }

  return (
    <div className="h-full">
      {/* Diff viewer only - file list is now in sidebar */}
      {diffPanelStatus ? (
        <ErrorBoundary
          name="DiffPanel"
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
                Failed to load diff viewer
              </div>
            </div>
          }
        >
          <DiffPanel
            status={diffPanelStatus}
            openFiles={activeFile ? [activeFile] : []}
            activeFile={activeFile}
            activeView="working"
            fileViews={activeFile ? { [activeFile]: "working" } : {}}
            diffData={diffData}
            diffLoading={diffLoading}
            theme={resolvedTheme}
            onSelectFile={handleSelectFile}
            onCloseFile={handleCloseFile}
            onCloseAll={handleCloseFile}
            onViewChange={handleViewChange}
            onFetchDiff={handleFetchDiff}
            reviewMode
            taskPath={taskPath}
          />
        </ErrorBoundary>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Loading git status...
        </div>
      )}
    </div>
  )
}
