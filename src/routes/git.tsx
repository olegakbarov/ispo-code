/**
 * Git Route - Full git workflow UI with file staging, diffs, and commits
 * Uses tRPC for all git operations
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import {
  StatusPanel,
  FileList,
  FileActions,
  DiffPanel,
  BranchSelect,
  CommitForm,
  type GitDiffView,
  type DiffData,
  type GitStatus as DiffGitStatus,
} from '@/components/git'
import { trpc } from '@/lib/trpc-client'

export const Route = createFileRoute('/git')({
  component: GitPage,
})

// Extended status type for UI
interface GitFileStatus {
  file: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied'
}

interface GitStatus extends DiffGitStatus {
  branch: string
  staged: GitFileStatus[]
  modified: GitFileStatus[]
  untracked: string[]
  ahead: number
  behind: number
}

// Helper to check if working tree is clean
function isClean(status: GitStatus): boolean {
  return status.staged.length === 0 && status.modified.length === 0 && status.untracked.length === 0
}

function GitPage() {
  const { data: workingDir } = trpc.system.workingDir.useQuery()
  const utils = trpc.useUtils()

  // Queries - only enabled when workingDir is set
  const statusQuery = trpc.git.status.useQuery(undefined, {
    enabled: !!workingDir,
    refetchInterval: 5000, // Auto-refresh every 5s
  })
  const branchesQuery = trpc.git.branches.useQuery(undefined, {
    enabled: !!workingDir,
  })

  // Transform status data for UI
  const status: GitStatus | null = statusQuery.data ? {
    branch: statusQuery.data.branch,
    staged: statusQuery.data.staged,
    modified: statusQuery.data.modified,
    untracked: statusQuery.data.untracked,
    ahead: statusQuery.data.ahead,
    behind: statusQuery.data.behind,
  } : null

  // Extract branches array from response
  const branches = branchesQuery.data?.all ?? []
  const isLoading = statusQuery.isLoading || statusQuery.isFetching

  // Mutations
  const stageMutation = trpc.git.stage.useMutation({
    onSuccess: () => utils.git.status.invalidate(),
  })
  const unstageMutation = trpc.git.unstage.useMutation({
    onSuccess: () => utils.git.status.invalidate(),
  })
  const discardMutation = trpc.git.discard.useMutation({
    onSuccess: () => utils.git.status.invalidate(),
  })
  const commitMutation = trpc.git.commit.useMutation({
    onSuccess: () => utils.git.status.invalidate(),
  })
  const checkoutMutation = trpc.git.checkout.useMutation({
    onSuccess: () => {
      utils.git.status.invalidate()
      utils.git.branches.invalidate()
    },
  })
  const createBranchMutation = trpc.git.createBranch.useMutation({
    onSuccess: () => {
      utils.git.status.invalidate()
      utils.git.branches.invalidate()
    },
  })

  // File selection state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Diff panel state
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<GitDiffView>('working')
  const [fileViews, setFileViews] = useState<Record<string, GitDiffView>>({})
  const [diffData, setDiffData] = useState<DiffData | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // Reset state when working dir changes
  useEffect(() => {
    setSelectedFiles(new Set())
    setOpenFiles([])
    setActiveFile(null)
    setDiffData(null)
  }, [workingDir])

  // Refresh status
  const handleRefresh = useCallback(() => {
    utils.git.status.invalidate()
    utils.git.branches.invalidate()
  }, [utils])

  // File click - open in diff panel
  const handleFileClick = useCallback((file: string, view: GitDiffView) => {
    if (!openFiles.includes(file)) {
      setOpenFiles((prev) => [...prev, file])
    }
    setActiveFile(file)
    setActiveView(view)
    setFileViews((prev) => ({ ...prev, [file]: view }))
  }, [openFiles])

  // Fetch diff data for a file
  const handleFetchDiff = useCallback(async (file: string, view: GitDiffView): Promise<DiffData> => {
    const result = await utils.client.git.diff.query({ file, view })
    return {
      oldContent: result.oldContent,
      newContent: result.newContent,
    }
  }, [utils])

  // Diff panel handlers
  const handleSelectFile = useCallback((file: string) => {
    setActiveFile(file)
    const view = fileViews[file] ?? 'working'
    setActiveView(view)
    setDiffLoading(true)
    handleFetchDiff(file, view).then((data) => {
      setDiffData(data)
      setDiffLoading(false)
    }).catch(() => {
      setDiffLoading(false)
    })
  }, [fileViews, handleFetchDiff])

  const handleCloseFile = useCallback((file: string) => {
    setOpenFiles((prev) => prev.filter((f) => f !== file))
    if (activeFile === file) {
      const remaining = openFiles.filter((f) => f !== file)
      setActiveFile(remaining[remaining.length - 1] ?? null)
      setDiffData(null)
    }
  }, [activeFile, openFiles])

  const handleCloseAll = useCallback(() => {
    setOpenFiles([])
    setActiveFile(null)
    setDiffData(null)
  }, [])

  const handleViewChange = useCallback((view: GitDiffView) => {
    setActiveView(view)
    if (activeFile) {
      setFileViews((prev) => ({ ...prev, [activeFile]: view }))
      setDiffLoading(true)
      handleFetchDiff(activeFile, view).then((data) => {
        setDiffData(data)
        setDiffLoading(false)
      }).catch(() => {
        setDiffLoading(false)
      })
    }
  }, [activeFile, handleFetchDiff])

  // Git actions
  const handleStage = useCallback(async (files: string[]) => {
    await stageMutation.mutateAsync({ files })
    setSelectedFiles(new Set())
  }, [stageMutation])

  const handleUnstage = useCallback(async (files: string[]) => {
    await unstageMutation.mutateAsync({ files })
    setSelectedFiles(new Set())
  }, [unstageMutation])

  const handleDiscard = useCallback(async (files: string[]) => {
    await discardMutation.mutateAsync({ files })
    setSelectedFiles(new Set())
  }, [discardMutation])

  const handleStageAll = useCallback(async () => {
    if (!status) return
    const allFiles = [
      ...status.modified.map((f) => f.file),
      ...status.untracked,
    ]
    if (allFiles.length > 0) {
      await handleStage(allFiles)
    }
  }, [status, handleStage])

  const handleUnstageAll = useCallback(async () => {
    if (!status) return
    const allFiles = status.staged.map((f) => f.file)
    if (allFiles.length > 0) {
      await handleUnstage(allFiles)
    }
  }, [status, handleUnstage])

  const handleCheckout = useCallback(async (branch: string) => {
    await checkoutMutation.mutateAsync({ branch })
  }, [checkoutMutation])

  const handleCreateBranch = useCallback(async (name: string) => {
    await createBranchMutation.mutateAsync({ branch: name })
  }, [createBranchMutation])

  const handleCommit = useCallback(async (message: string) => {
    const result = await commitMutation.mutateAsync({ message })
    return { success: result.success, hash: result.hash ?? '' }
  }, [commitMutation])

  // Show message if no working directory set
  if (!workingDir) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="font-vcr text-lg text-foreground mb-2">No Project Selected</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Select a project directory using the folder selector in the sidebar to view git status and make changes.
          </p>
        </div>
      </div>
    )
  }

  // Show error if status query failed
  if (statusQuery.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-error" />
        <div className="text-center">
          <h2 className="font-vcr text-lg text-error mb-2">Git Error</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {statusQuery.error.message || 'Failed to get git status. Make sure the selected directory is a git repository.'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-secondary text-foreground rounded font-vcr text-sm hover:bg-secondary/80"
        >
          Retry
        </button>
      </div>
    )
  }

  // Show loading state
  if (!status) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  const totalChanges = status.staged.length + status.modified.length + status.untracked.length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BranchSelect
            current={status.branch}
            branches={branches}
            onCheckout={handleCheckout}
            onCreate={handleCreateBranch}
          />
          <StatusPanel
            status={status}
            isLoading={isLoading}
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded hover:bg-secondary transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {totalChanges === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground font-vcr text-xs">Working tree clean</p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left panel - File list and actions */}
          <div className="w-80 shrink-0 flex flex-col border-r border-border bg-card">
            <div className="flex-1 min-h-0">
              <FileList
                staged={status.staged}
                modified={status.modified}
                untracked={status.untracked}
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
                onFileClick={handleFileClick}
              />
            </div>

            <FileActions
              selectedFiles={selectedFiles}
              hasStaged={status.staged.length > 0}
              hasModified={status.modified.length > 0}
              hasUntracked={status.untracked.length > 0}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onDiscard={handleDiscard}
              onStageAll={handleStageAll}
              onUnstageAll={handleUnstageAll}
            />

            <CommitForm
              hasStagedChanges={status.staged.length > 0}
              onCommit={handleCommit}
            />
          </div>

          {/* Right panel - Diff viewer */}
          <div className="flex-1 min-w-0">
            <DiffPanel
              status={status}
              openFiles={openFiles}
              activeFile={activeFile}
              activeView={activeView}
              fileViews={fileViews}
              diffData={diffData}
              diffLoading={diffLoading}
              availableAgentTypes={['cerebras', 'opencode']}
              theme="dark"
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
              onCloseAll={handleCloseAll}
              onViewChange={handleViewChange}
              onFetchDiff={handleFetchDiff}
            />
          </div>
        </div>
      )}
    </div>
  )
}
