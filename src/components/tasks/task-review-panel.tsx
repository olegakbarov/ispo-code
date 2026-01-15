/**
 * Task Review Panel Component
 * Shows all files changed across task sessions with diff view and commit functionality
 */

import { useState, useMemo, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc-client"
import { GitCommit, Loader2, Check, X, ChevronRight, ChevronDown, History, FileText, Archive, RotateCcw } from "lucide-react"
import { DiffPanel, type GitStatus, type DiffData } from "@/components/git/diff-panel"
import { type GitDiffView } from "@/components/git/file-list"
import { useTheme } from "@/components/theme"
import type { AgentType } from "@/lib/agent/types"

interface TaskReviewPanelProps {
  taskPath: string
  taskTitle: string
  taskDescription?: string
  isArchived?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onArchive?: () => void
  onRestore?: () => void
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
  const [commitMessage, setCommitMessage] = useState("")
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [showCommitHistory, setShowCommitHistory] = useState(false)
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set())

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

  // Commit mutation with optimistic updates
  const commitMutation = trpc.git.commitScoped.useMutation({
    onMutate: async ({ files }) => {
      // 1. Cancel outgoing refetches to avoid overwriting optimistic update
      await utils.git.status.cancel()
      await utils.tasks.getChangedFilesForTask.cancel()

      // 2. Snapshot current state for rollback
      const previousStatus = utils.git.status.getData()
      const previousChangedFiles = utils.tasks.getChangedFilesForTask.getData({ path: taskPath })
      const previousSelectedFiles = new Map(selectedFiles)
      const previousCommitMessage = commitMessage

      // 3. Build set of git-relative paths being committed
      const commitSet = new Set(files)

      // 4. Optimistically update git status cache - remove committed files
      if (previousStatus) {
        utils.git.status.setData(undefined, {
          ...previousStatus,
          staged: previousStatus.staged.filter((f) => !commitSet.has(f.file)),
          modified: previousStatus.modified.filter((f) => !commitSet.has(f.file)),
          untracked: previousStatus.untracked.filter((f) => !commitSet.has(f)),
        })
      }

      // 5. Optimistically update changed files cache - remove committed files
      if (previousChangedFiles) {
        utils.tasks.getChangedFilesForTask.setData(
          { path: taskPath },
          previousChangedFiles.filter((f) => {
            const gitPath = f.repoRelativePath || f.relativePath || f.path
            return !commitSet.has(gitPath)
          })
        )
      }

      // 6. Clear local selection state immediately
      setSelectedFiles(new Map())
      setCommitMessage("")

      // 7. Return rollback context
      return {
        previousStatus,
        previousChangedFiles,
        previousSelectedFiles,
        previousCommitMessage,
      }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousStatus) {
        utils.git.status.setData(undefined, context.previousStatus)
      }
      if (context?.previousChangedFiles) {
        utils.tasks.getChangedFilesForTask.setData({ path: taskPath }, context.previousChangedFiles)
      }
      if (context?.previousSelectedFiles) {
        setSelectedFiles(context.previousSelectedFiles)
      }
      if (context?.previousCommitMessage) {
        setCommitMessage(context.previousCommitMessage)
      }
    },
    onSettled: () => {
      // Always refetch to ensure consistency after mutation settles
      utils.git.status.invalidate()
      utils.tasks.getChangedFilesForTask.invalidate()
      utils.tasks.hasUncommittedChanges.invalidate()
    },
  })

  // Generate commit message mutation
  const generateMessageMutation = trpc.git.generateCommitMessage.useMutation()

  // Group files by session
  const filesBySession = useMemo(() => {
    const grouped = new Map<string, typeof changedFiles>()
    for (const file of changedFiles) {
      const existing = grouped.get(file.sessionId) || []
      grouped.set(file.sessionId, [...existing, file])
    }
    return grouped
  }, [changedFiles])

  // Get git-relative paths for all changed files
  const gitRelativeFiles = useMemo(() => {
    return changedFiles.map(f => f.repoRelativePath || f.relativePath || f.path)
  }, [changedFiles])

  // Query commits for the changed files (for commit history panel)
  const { data: commits = [], isLoading: commitsLoading } = trpc.git.commitsForFiles.useQuery(
    { files: gitRelativeFiles, limit: 50 },
    { enabled: gitRelativeFiles.length > 0 && showCommitHistory }
  )

  // Query uncommitted status to distinguish "no changes yet" vs "all committed"
  const { data: uncommittedStatus } = trpc.tasks.hasUncommittedChanges.useQuery(
    { path: taskPath },
    { enabled: !!taskPath }
  )

  // Derive "all committed" state:
  // - changedFiles.length === 0 (no uncommitted changes in session)
  // - uncommittedStatus exists and hasUncommitted is false
  // - This means task had sessions but all changes are committed
  const allCommitted = changedFiles.length === 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted

  // Transform git status for DiffPanel
  const diffPanelStatus: GitStatus | undefined = gitStatus ? {
    staged: gitStatus.staged,
    modified: gitStatus.modified,
    untracked: gitStatus.untracked,
  } : undefined

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
    if (selectedFiles.size === changedFiles.length) {
      setSelectedFiles(new Map())
    } else {
      const allFiles = new Map<string, string>()
      for (const file of changedFiles) {
        const gitPath = file.repoRelativePath || file.relativePath || file.path
        allFiles.set(file.path, gitPath)
      }
      setSelectedFiles(allFiles)
    }
  }

  const toggleSession = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  const toggleCommit = (commitHash: string) => {
    const newExpanded = new Set(expandedCommits)
    if (newExpanded.has(commitHash)) {
      newExpanded.delete(commitHash)
    } else {
      newExpanded.add(commitHash)
    }
    setExpandedCommits(newExpanded)
  }

  const handleGenerateMessage = async () => {
    if (selectedFiles.size === 0) return

    setIsGeneratingMessage(true)
    try {
      // Get git-relative paths for the selected files
      const gitPaths = Array.from(selectedFiles.values())
      const result = await generateMessageMutation.mutateAsync({
        taskTitle,
        taskDescription,
        files: gitPaths,
      })
      setCommitMessage(result.message)
    } catch (error) {
      console.error("Failed to generate commit message:", error)
    } finally {
      setIsGeneratingMessage(false)
    }
  }

  const handleCommit = async () => {
    if (selectedFiles.size === 0 || !commitMessage.trim()) return

    // Get git-relative paths for the selected files
    const gitPaths = Array.from(selectedFiles.values())
    await commitMutation.mutateAsync({
      files: gitPaths,
      message: commitMessage,
    })
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

  const canCommit = selectedFiles.size > 0 && commitMessage.trim().length > 0 && !commitMutation.isPending

  if (filesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show "No files changed yet" only when truly empty (not when all committed)
  if (changedFiles.length === 0 && !allCommitted) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
        No files changed yet
      </div>
    )
  }

  // Show "All Changes Committed" success state with archive button
  if (allCommitted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-4 p-6 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 w-full">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
            <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="font-medium text-green-700 dark:text-green-300 text-lg">
              All Changes Committed
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">
              This task's files have been committed to git
            </div>
          </div>
        </div>

        {/* Archive/Restore button */}
        {isArchived ? (
          onRestore && (
            <button
              onClick={onRestore}
              disabled={isRestoring}
              className="w-full px-4 py-3 rounded-md text-sm font-medium border border-primary/50 text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Restore Task
                </>
              )}
            </button>
          )
        ) : (
          onArchive && (
            <button
              onClick={onArchive}
              disabled={isArchiving}
              className="w-full px-4 py-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isArchiving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Archive Task
                </>
              )}
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* Left panel - File list and commit controls */}
      <div className="w-96 shrink-0 flex flex-col border-r border-border bg-card">
        {/* File list header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-vcr text-sm text-foreground">Changed Files</h3>
            <button
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {selectedFiles.size === changedFiles.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            {changedFiles.length} file{changedFiles.length === 1 ? "" : "s"} • {filesBySession.size} session{filesBySession.size === 1 ? "" : "s"}
          </div>
        </div>

        {/* File list grouped by session */}
        <div className="flex-1 overflow-y-auto">
          {Array.from(filesBySession.entries()).map(([sessionId, files]) => (
            <div key={sessionId} className="border-b border-border">
              <button
                onClick={() => toggleSession(sessionId)}
                className="w-full px-4 py-2 flex items-center gap-2 hover:bg-accent text-left"
              >
                {expandedSessions.has(sessionId) ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-xs font-mono text-muted-foreground flex-1">
                  Session {sessionId.slice(0, 8)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
              </button>

              {expandedSessions.has(sessionId) && (
                <div className="space-y-1 pb-2">
                  {files.map((file) => (
                    <div key={file.path} className="px-4 pl-10">
                      <label className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.path)}
                          onChange={() => {
                            const gitPath = file.repoRelativePath || file.relativePath || file.path
                            toggleFile(file.path, gitPath)
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            // Use repoRelativePath for git operations, fallback to relativePath or path
                            const gitPath = file.repoRelativePath || file.relativePath || file.path
                            handleFileClick(gitPath, "working")
                          }}
                        >
                          <div className="text-sm font-mono truncate">
                            {file.relativePath || file.path}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className={`${
                              file.operation === "create" ? "text-green-600 dark:text-green-400" :
                              file.operation === "edit" ? "text-blue-600 dark:text-blue-400" :
                              "text-red-600 dark:text-red-400"
                            }`}>
                              {file.operation}
                            </span>
                            <span>•</span>
                            <span>{file.toolUsed}</span>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Commit History Section */}
          <div className="border-t border-border">
            <button
              onClick={() => setShowCommitHistory(!showCommitHistory)}
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-accent text-left"
            >
              {showCommitHistory ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground flex-1">
                Commit History
              </span>
              {commits.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {commits.length} commit{commits.length === 1 ? "" : "s"}
                </span>
              )}
            </button>

            {showCommitHistory && (
              <div className="pb-4">
                {commitsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : commits.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                    No commits found for these files
                  </div>
                ) : (
                  <div className="space-y-1">
                    {commits.map((commit) => (
                      <div key={commit.hash} className="px-4">
                        <button
                          onClick={() => toggleCommit(commit.hash)}
                          className="w-full text-left p-2 rounded hover:bg-accent"
                        >
                          <div className="flex items-start gap-2">
                            {expandedCommits.has(commit.hash) ? (
                              <ChevronDown className="w-3 h-3 mt-1 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 mt-1 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-primary">
                                  {commit.hash}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {commit.date}
                                </span>
                              </div>
                              <div className="text-sm text-foreground line-clamp-2">
                                {commit.message}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {commit.author}
                              </div>
                            </div>
                          </div>
                        </button>

                        {expandedCommits.has(commit.hash) && (
                          <div className="pl-7 pr-2 pb-2 space-y-1">
                            <div className="text-xs text-muted-foreground mb-1">
                              Files changed:
                            </div>
                            {commit.files.map((file) => (
                              <div
                                key={file}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleFileClick(file, "working")
                                }}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/50 text-xs font-mono cursor-pointer"
                              >
                                <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="truncate">{file}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Commit controls */}
        <div className="border-t border-border p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Commit Message</label>
              <button
                onClick={handleGenerateMessage}
                disabled={selectedFiles.size === 0 || isGeneratingMessage}
                className="text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingMessage ? "Generating..." : "Generate with AI"}
              </button>
            </div>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={commitMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedFiles.size} of {changedFiles.length} files selected
            </div>
            <button
              onClick={handleCommit}
              disabled={!canCommit}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {commitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <GitCommit className="w-4 h-4" />
                  Commit
                </>
              )}
            </button>
          </div>

          {/* Success/Error messages */}
          {commitMutation.isSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-3 py-2 rounded">
              <Check className="w-4 h-4" />
              Successfully committed changes
            </div>
          )}
          {commitMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              <X className="w-4 h-4" />
              {commitMutation.error instanceof Error ? commitMutation.error.message : "Failed to commit"}
            </div>
          )}
        </div>
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
