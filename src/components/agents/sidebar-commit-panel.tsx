/**
 * Sidebar Commit Panel
 * Git status and commit UI for agent session files
 */

import { useState } from "react"
import { trpc } from "@/lib/trpc-client"
import { GitCommit, Check, X, Loader2, GitBranch, ChevronDown, ChevronRight } from "lucide-react"

interface SidebarCommitPanelProps {
  sessionId: string
}

export function SidebarCommitPanel({ sessionId }: SidebarCommitPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [commitMessage, setCommitMessage] = useState("")
  const utils = trpc.useUtils()

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
  })

  // Changed files from session
  const { data: changedFiles = [] } = trpc.agent.getChangedFiles.useQuery(
    { sessionId },
    { enabled: isExpanded }
  )

  // Commit mutation
  const commitMutation = trpc.git.commitScoped.useMutation({
    onSuccess: () => {
      setSelectedFiles(new Set())
      setCommitMessage("")
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
              <Loader2 className="w-3 h-3 animate-spin" />
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
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="w-full min-h-[60px] px-2 py-1.5 text-xs rounded border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
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
                        <Loader2 className="w-3 h-3 animate-spin" />
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
