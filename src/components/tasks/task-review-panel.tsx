/**
 * Task Review Panel Component
 * Shows all files changed across task sessions with diff view and commit functionality
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc-client"
import { Spinner } from "@/components/ui/spinner"
import { DiffPanel, type GitStatus, type DiffData } from "@/components/git/diff-panel"
import { type GitDiffView } from "@/components/git/file-list"
import { useTheme } from "@/components/theme"
import type { AgentType } from "@/lib/agent/types"
import { FileListPanel, type ChangedFile } from "./file-list-panel"
import { CommitActionButton } from "./commit-action-button"
import { AllCommittedState } from "./all-committed-state"

interface TaskReviewPanelProps {
  taskPath: string
  taskTitle: string
  taskDescription?: string
  isArchived?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onArchive?: () => void
  onRestore?: () => void
  onCommitAndArchive?: () => void
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
  onCommitAndArchive,
  reviewFile,
  onReviewFileChange,
}: TaskReviewPanelProps) {
  const { theme } = useTheme()
  const utils = trpc.useUtils()
  const navigate = useNavigate()
  const { data: workingDir } = trpc.system.workingDir.useQuery()

  // Spawn agent mutation with optimistic list update
  const spawnMutation = trpc.agent.spawn.useMutation({
    onMutate: async () => {
      // Cancel outgoing refetches
      await utils.agent.list.cancel()

      // Snapshot for rollback (in case spawn fails)
      const previousList = utils.agent.list.getData()
      return { previousList }
    },
    onSuccess: (data) => {
      navigate({ to: '/agents/$sessionId', params: { sessionId: data.sessionId } })
    },
    onError: (_err, _variables, context) => {
      // Rollback list on error
      if (context?.previousList) {
        utils.agent.list.setData(undefined, context.previousList)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      utils.agent.list.invalidate()
    },
  })

  const handleSpawnAgent = useCallback((params: { prompt: string; agentType: AgentType; model?: string }) => {
    spawnMutation.mutate({
      prompt: params.prompt,
      agentType: params.agentType,
      model: params.model,
    })
  }, [spawnMutation])

  // Available agent types
  const { data: availableAgentTypes = [] } = trpc.agent.availableTypes.useQuery()

  // Query for changed files across all task sessions
  const { data: changedFiles = [], isLoading: filesLoading } = trpc.tasks.getChangedFilesForTask.useQuery(
    { path: taskPath },
    { enabled: !!taskPath }
  )

  // Query git status for the repo
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    enabled: !!workingDir,
  })

  // Local state
  // Map absolute path -> git-relative path for selected files
  const [selectedFiles, setSelectedFiles] = useState<Map<string, string>>(new Map())
  const [expandedSessions, setExpandedSessions] = useState<Set<string> | null>(null)

  // Diff panel state
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [activeView] = useState<GitDiffView>("working")
  const [fileViews, setFileViews] = useState<Record<string, GitDiffView>>({})
  const [diffData, setDiffData] = useState<DiffData | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // Resolve theme for diff viewer
  const resolvedTheme = theme === "system"
    ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme

  // Query uncommitted status to distinguish "no changes yet" vs "all committed"
  const { data: uncommittedStatus } = trpc.tasks.hasUncommittedChanges.useQuery(
    { path: taskPath },
    { enabled: !!taskPath }
  )

  // Derive "all committed" state:
  // - changedFiles.length > 0 (sessions have produced files - work was done)
  // - uncommittedStatus.hasUncommitted is false (all those files are now committed)
  const allCommitted = changedFiles.length > 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted

  // Filter changedFiles to only show uncommitted files in the UI
  const uncommittedFiles = useMemo(() => {
    if (!uncommittedStatus?.uncommittedFiles) return changedFiles
    const uncommittedSet = new Set(uncommittedStatus.uncommittedFiles)
    return changedFiles.filter(f => {
      const gitPath = f.repoRelativePath || f.relativePath || f.path
      return uncommittedSet.has(gitPath)
    })
  }, [changedFiles, uncommittedStatus])

  // Group files by session (only uncommitted files)
  const filesBySession = useMemo(() => {
    const grouped = new Map<string, typeof uncommittedFiles>()
    for (const file of uncommittedFiles) {
      const existing = grouped.get(file.sessionId) || []
      grouped.set(file.sessionId, [...existing, file])
    }
    return grouped
  }, [uncommittedFiles])

  // Derive effective expanded sessions (default all expanded)
  const effectiveExpandedSessions = useMemo(() => {
    if (expandedSessions !== null) return expandedSessions
    return new Set(filesBySession.keys())
  }, [expandedSessions, filesBySession])

  // Transform git status for DiffPanel
  const diffPanelStatus: GitStatus | undefined = gitStatus ? {
    staged: gitStatus.staged,
    modified: gitStatus.modified,
    untracked: gitStatus.untracked,
  } : undefined

  // Track whether we've initialized from URL reviewFile (to avoid re-triggering on state updates)
  const initializedFromUrlRef = useRef(false)

  // Initialize activeFile and openFiles from reviewFile URL param on mount
  useEffect(() => {
    // Skip if already initialized or no reviewFile in URL
    if (initializedFromUrlRef.current || !reviewFile) return
    // Skip if files haven't loaded yet
    if (uncommittedFiles.length === 0) return

    // Find the file in uncommittedFiles that matches the reviewFile git path
    const matchingFile = uncommittedFiles.find(f => {
      const gitPath = f.repoRelativePath || f.relativePath || f.path
      return gitPath === reviewFile
    })

    if (matchingFile) {
      const gitPath = matchingFile.repoRelativePath || matchingFile.relativePath || matchingFile.path
      initializedFromUrlRef.current = true

      // Open the file and set it as active
      setOpenFiles([gitPath])
      setActiveFile(gitPath)
      setFileViews({ [gitPath]: "working" })

      // Fetch diff for the file
      setDiffLoading(true)
      utils.client.git.diff.query({ file: gitPath, view: "working" })
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
    }
  }, [reviewFile, uncommittedFiles, utils])

  // Sync activeFile changes to URL
  const prevActiveFileRef = useRef<string | null>(null)
  useEffect(() => {
    // Skip during initial load from URL
    if (!initializedFromUrlRef.current && reviewFile) return

    const prev = prevActiveFileRef.current
    prevActiveFileRef.current = activeFile

    // Only update URL if activeFile actually changed (not on initial render)
    if (prev === activeFile) return

    // Notify parent to update URL
    onReviewFileChange?.(activeFile)
  }, [activeFile, reviewFile, onReviewFileChange])

  const toggleFile = (absolutePath: string, gitPath: string) => {
    const newSelected = new Map(selectedFiles)
    if (newSelected.has(absolutePath)) {
      newSelected.delete(absolutePath)
    } else {
      newSelected.set(absolutePath, gitPath)
    }
    setSelectedFiles(newSelected)
  }

  const toggleAll = () => {
    if (selectedFiles.size === uncommittedFiles.length) {
      setSelectedFiles(new Map())
    } else {
      const allFiles = new Map<string, string>()
      for (const file of uncommittedFiles) {
        const gitPath = file.repoRelativePath || file.relativePath || file.path
        allFiles.set(file.path, gitPath)
      }
      setSelectedFiles(allFiles)
    }
  }

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(effectiveExpandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  // Diff panel handlers
  const handleFileClick = useCallback((file: string, view: GitDiffView) => {
    setOpenFiles((prev) => {
      if (prev.includes(file)) return prev
      return [...prev, file]
    })
    setActiveFile(file)
    setFileViews((prev) => ({ ...prev, [file]: view }))

    setDiffLoading(true)
    utils.client.git.diff.query({ file, view })
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

  const handleSelectFile = useCallback((file: string) => {
    setActiveFile(file)
    const view = fileViews[file] ?? "working"
    setDiffLoading(true)
    utils.client.git.diff.query({ file, view })
      .then((data) => {
        setDiffData({
          oldContent: data.oldContent,
          newContent: data.newContent,
        })
        setDiffLoading(false)
      })
      .catch(() => {
        setDiffLoading(false)
      })
  }, [fileViews, utils])

  const handleCloseFile = useCallback((file: string) => {
    setOpenFiles((prev) => {
      const remaining = prev.filter((f) => f !== file)
      if (activeFile === file) {
        const nextFile = remaining[remaining.length - 1] ?? null
        setActiveFile(nextFile)
        setDiffData(null)
      }
      return remaining
    })
  }, [activeFile])

  const handleCloseAll = useCallback(() => {
    setOpenFiles([])
    setActiveFile(null)
    setDiffData(null)
    setFileViews({})
  }, [])

  const handleViewChange = useCallback((_view: GitDiffView) => {
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

  // Show "No files changed yet" only when truly empty (not when all committed)
  if (uncommittedFiles.length === 0 && !allCommitted) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
        No files changed yet
      </div>
    )
  }

  // Show "All Changes Committed" success state with archive button
  if (allCommitted) {
    return (
      <AllCommittedState
        isArchived={isArchived}
        isArchiving={isArchiving}
        isRestoring={isRestoring}
        onArchive={onArchive}
        onRestore={onRestore}
      />
    )
  }

  // Cast uncommittedFiles to ChangedFile[] for the FileListPanel
  const typedFiles: ChangedFile[] = uncommittedFiles

  return (
    <div className="h-full flex">
      {/* Left panel - File list and commit controls */}
      <div className="w-96 shrink-0 flex flex-col h-full border-r border-border bg-card">
        <FileListPanel
          files={typedFiles}
          filesBySession={filesBySession}
          selectedFiles={selectedFiles}
          expandedSessions={effectiveExpandedSessions}
          onToggleFile={toggleFile}
          onToggleAll={toggleAll}
          onToggleSession={toggleSession}
          onFileClick={handleFileClick}
        />

        {/* Commit and Archive button */}
        {onCommitAndArchive && (
          <CommitActionButton
            fileCount={uncommittedFiles.length}
            onCommitAndArchive={onCommitAndArchive}
          />
        )}
      </div>

      {/* Right panel - Diff viewer */}
      <div className="flex-1 min-w-0">
        {diffPanelStatus ? (
          <DiffPanel
            status={diffPanelStatus}
            openFiles={openFiles}
            activeFile={activeFile}
            activeView={activeView}
            fileViews={fileViews}
            diffData={diffData}
            diffLoading={diffLoading}
            theme={resolvedTheme}
            availableAgentTypes={availableAgentTypes}
            onSelectFile={handleSelectFile}
            onCloseFile={handleCloseFile}
            onCloseAll={handleCloseAll}
            onViewChange={handleViewChange}
            onFetchDiff={handleFetchDiff}
            onSpawnAgent={handleSpawnAgent}
            isSpawning={spawnMutation.isPending}
            spawnError={spawnMutation.error?.message}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading git status...
          </div>
        )}
      </div>
    </div>
  )
}
