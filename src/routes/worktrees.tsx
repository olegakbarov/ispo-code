/**
 * Worktrees Route - View and select git worktrees
 */

import { createFileRoute } from "@tanstack/react-router"
import { GitBranch, Folder, Check, Loader2 } from "lucide-react"
import { trpc } from "@/lib/trpc-client"
import { useWorkingDirStore } from "@/lib/stores/working-dir"

export const Route = createFileRoute("/worktrees")({
  component: WorktreesPage,
})

function WorktreesPage() {
  const { workingDir, setWorkingDir } = useWorkingDirStore()
  const { data: serverDir } = trpc.system.workingDir.useQuery()
  const { data: worktrees, isLoading, error } = trpc.git.worktrees.useQuery()

  // Current effective working dir
  const effectiveDir = workingDir ?? serverDir

  const handleSelect = (path: string) => {
    setWorkingDir(path)
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border h-12 px-4 flex items-center">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-bold">Worktrees</h1>
        </div>
      </header>

      <div className="p-4 max-w-2xl">
        <p className="text-xs text-muted-foreground mb-4">
          Select a git worktree to set as the active working directory. Changes will apply to all operations.
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading worktrees...
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-xs text-destructive">
            Failed to load worktrees: {error.message}
          </div>
        )}

        {worktrees && worktrees.length === 0 && (
          <div className="p-3 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground">
            No worktrees found. This repository has only the main working directory.
          </div>
        )}

        {worktrees && worktrees.length > 0 && (
          <div className="space-y-2">
            {worktrees.map((wt) => {
              const isSelected = effectiveDir === wt.path
              return (
                <button
                  key={wt.path}
                  onClick={() => handleSelect(wt.path)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-foreground/30 hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">
                      {wt.isMain ? "Main Worktree" : wt.branch ?? "Detached HEAD"}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>

                  <div className="mt-1 ml-6 space-y-0.5">
                    <div className="text-[10px] text-muted-foreground truncate" title={wt.path}>
                      {wt.path}
                    </div>
                    {wt.branch && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <GitBranch className="w-3 h-3" />
                        <span>{wt.branch}</span>
                      </div>
                    )}
                    {wt.head && (
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {wt.head.substring(0, 7)}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
