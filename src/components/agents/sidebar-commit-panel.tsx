/**
 * Sidebar Commit Panel
 * Git status and commit UI for agent session files
 */

import { useState } from "react"
import { StyledTextarea } from "@/components/ui/styled-textarea"
import { trpc } from "@/lib/trpc-client"
import { sessionTrpcOptions } from "@/lib/trpc-session"
import { useTextareaDraft } from "@/lib/hooks/use-textarea-draft"
import { GitCommit, Check, X, GitBranch, ChevronDown, ChevronRight } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

interface SidebarCommitPanelProps {
  sessionId: string
}

export function SidebarCommitPanel({ sessionId }: SidebarCommitPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage, clearMessageDraft] = useTextareaDraft(`sidebar-commit:${sessionId}`)
  const utils = trpc.useUtils()
  const sessionTrpc = sessionTrpcOptions(sessionId)

  // Fetch session to check for worktree info
  const { data: session } = trpc.agent.get.useQuery(
    { id: sessionId },
    { enabled: isExpanded }
  )

  // Git status query
  // NOTE: When worktree isolation is enabled, pass sessionId via tRPC context
  // to automatically scope git operations to the session's worktree
  const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
    enabled: isExpanded,
    refetchInterval: isExpanded ? 3000 : false,
    ...sessionTrpc,
  })

  // Changed files from session
  const { data: changedFiles = [] } = trpc.agent.getChangedFiles.useQuery(
    { sessionId },
    { enabled: isExpanded }
  )

  // Commit mutation with optimistic updates
  const commitMutation = trpc.git.commitScoped.useMutation({
    ...sessionTrpc,
    onMutate: async ({ files }) => {
      // 1. Cancel outgoing refetches to avoid overwriting optimistic update
      await utils.git.status.cancel()
      await utils.agent.getChangedFiles.cancel()

      // 2. Snapshot current state for rollback
      const previousStatus = utils.git.status.getData()
      const previousChangedFiles = utils.agent.getChangedFiles.getData({ sessionId })
      const previousSelectedFiles = new Set(selectedFiles)
      const previousCommitMessage = commitMessage

      // 3. Build set of paths being committed
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

      // 5. Optimistically update changed files - remove committed files
      if (previousChangedFiles) {
        utils.agent.getChangedFiles.setData(
          { sessionId },
          previousChangedFiles.filter((f) => !commitSet.has(f.path))
        )
      }

      // 6. Clear local state and draft immediately
      setSelectedFiles(new Set())
      clearMessageDraft()

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
        utils.agent.getChangedFiles.setData({ sessionId }, context.previousChangedFiles)
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
      utils.agent.getChangedFiles.invalidate()
    },
  })

  const totalChanges = gitStatus
    ? gitStatus.staged.length + gitStatus.modified.length + gitStatus.untracked.length
    : 0
  const canCommit = selectedFiles.size > 0 && commitMessage.trim().length > 0 && !commitMutation.isPending

  const toggleFile = (filePath: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath)
    } else {
      newSelected.add(filePath)
    }
    setSelectedFiles(newSelected)
  }

  const toggleAll = () => {
    if (selectedFiles.size === changedFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(changedFiles.map((f) => f.path)))
    }
  }

  return (
    <div className="border-t border-border">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-muted-foreground" />
          <span className="font-vcr text-xs text-muted-foreground">Git</span>
        </div>
        <div className="flex items-center gap-2">
          {totalChanges > 0 && (
            <span className="font-mono text-xs text-primary">{totalChanges}</span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Loading state */}
          {!gitStatus && (
            <div className="flex items-center gap-2 text-[10px] font-vcr text-muted-foreground">
              <Spinner size="xs" />
              loading git status...
            </div>
          )}

          {/* Branch and status */}
          {gitStatus && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-vcr text-muted-foreground text-[10px]">Branch</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-foreground/70">{gitStatus.branch || "HEAD"}</span>
                {session?.worktreePath && (
                  <span className="text-[8px] font-vcr text-primary bg-primary/10 px-1 py-0.5 rounded">
                    WT
                  </span>
                )}
              </div>
            </div>
            {gitStatus.staged.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-vcr text-muted-foreground text-[10px]">Staged</span>
                <span className="font-mono text-chart-2">{gitStatus.staged.length}</span>
              </div>
            )}
            {gitStatus.modified.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-vcr text-muted-foreground text-[10px]">Modified</span>
                <span className="font-mono text-primary">{gitStatus.modified.length}</span>
              </div>
            )}
            {gitStatus.untracked.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-vcr text-muted-foreground text-[10px]">Untracked</span>
                <span className="font-mono text-muted-foreground">{gitStatus.untracked.length}</span>
              </div>
            )}
          </div>
          )}

          {/* File list */}
          {changedFiles.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="font-vcr text-[10px] text-muted-foreground">
                  Session Files
                </span>
                <button
                  onClick={toggleAll}
                  className="text-[10px] font-vcr text-muted-foreground hover:text-foreground"
                >
                  {selectedFiles.size === changedFiles.length ? "none" : "all"}
                </button>
              </div>

              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {changedFiles.map((file) => (
                  <label
                    key={file.path}
                    className="flex items-center gap-2 text-xs hover:bg-secondary/60 rounded px-1 py-0.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.path)}
                      onChange={() => toggleFile(file.path)}
                      className="w-3 h-3 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-foreground/70 truncate text-[10px]">
                        {file.relativePath || file.path}
                      </div>
                    </div>
                    <span
                      className={`font-mono text-[9px] ${
                        file.operation === "create"
                          ? "text-chart-2"
                          : file.operation === "edit"
                            ? "text-primary"
                            : "text-destructive"
                      }`}
                    >
                      {file.operation === "create" ? "+" : file.operation === "edit" ? "~" : "−"}
                    </span>
                  </label>
                ))}
              </div>

              {/* Commit form */}
              <div className="space-y-2">
                <StyledTextarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  variant="sm"
                  className="min-h-[60px] font-mono"
                  disabled={commitMutation.isPending}
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-vcr text-muted-foreground">
                    {selectedFiles.size} selected
                  </span>
                  <button
                    onClick={() =>
                      commitMutation.mutate({
                        files: Array.from(selectedFiles),
                        message: commitMessage,
                      })
                    }
                    disabled={!canCommit}
                    className="px-2 py-1 text-[10px] font-vcr rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {commitMutation.isPending ? (
                      <>
                        <Spinner size="xs" />
                        committing...
                      </>
                    ) : (
                      <>
                        <GitCommit className="w-3 h-3" />
                        commit
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status messages */}
              {commitMutation.isSuccess && (
                <div className="flex items-center gap-1.5 text-[10px] font-vcr text-chart-2 bg-chart-2/10 px-2 py-1.5 rounded">
                  <Check className="w-3 h-3" />
                  committed
                  {commitMutation.data.hash && (
                    <span className="font-mono">({commitMutation.data.hash})</span>
                  )}
                </div>
              )}
              {commitMutation.isError && (
                <div className="flex items-center gap-1.5 text-[10px] font-vcr text-destructive bg-destructive/10 px-2 py-1.5 rounded">
                  <X className="w-3 h-3" />
                  {commitMutation.error instanceof Error
                    ? commitMutation.error.message
                    : "commit failed"}
                </div>
              )}
            </>
          )}

          {changedFiles.length === 0 && (
            <div className="text-[10px] font-vcr text-muted-foreground">
              No files changed in session
            </div>
          )}
        </div>
      )}
    </div>
  )
}
