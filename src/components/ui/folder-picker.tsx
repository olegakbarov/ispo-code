/**
 * Folder Picker Component
 *
 * Dialog-based folder browser for selecting working directories.
 * Lists directories within the user's home directory tree.
 */

import { useState } from "react"
import { Folder, FolderOpen, ChevronUp, Home, Check } from "lucide-react"
import { Spinner } from "./spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./dialog"
import { Button } from "./button"
import { trpc } from "@/lib/trpc-client"
import { useWorkingDirStore } from "@/lib/stores/working-dir"
import { ReposList } from "@/components/github/repos-list"

interface FolderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FolderPicker({ open, onOpenChange }: FolderPickerProps) {
  const [tab, setTab] = useState<"local" | "github">("local")
  const [browsePath, setBrowsePath] = useState<string | undefined>(undefined)
  const { workingDir, setWorkingDir } = useWorkingDirStore()

  const { data, isLoading, error } = trpc.system.listDirectories.useQuery(
    { path: browsePath },
    { enabled: open }
  )

  const handleSelect = () => {
    if (data?.currentPath) {
      setWorkingDir(data.currentPath)
      onOpenChange(false)
      // Reset browse path for next open
      setBrowsePath(undefined)
    }
  }

  const handleNavigate = (path: string) => {
    setBrowsePath(path)
  }

  const handleGoUp = () => {
    if (data?.parentPath) {
      setBrowsePath(data.parentPath)
    }
  }

  const handleGoHome = () => {
    setBrowsePath(undefined)
  }

  const isCurrentlySelected = workingDir === data?.currentPath

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Working Directory</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab("local")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === "local"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Folder className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            Local Folders
          </button>
          <button
            onClick={() => setTab("github")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === "github"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="inline-block w-4 h-4 mr-1 -mt-0.5"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub Repos
          </button>
        </div>

        {tab === "local" ? (
          <>
            {/* Current path display */}
            <div className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-mono">
                {data?.currentPath ?? "Loading..."}
              </span>
            </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoHome}
            disabled={data?.isHome}
          >
            <Home className="mr-1 h-3 w-3" />
            Home
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoUp}
            disabled={!data?.parentPath}
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            Up
          </Button>
        </div>

        {/* Directory listing */}
        <div className="h-64 overflow-y-auto rounded border border-border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="md" className="text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive">
              {error.message}
            </div>
          ) : data?.directories.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No subdirectories
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data?.directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => handleNavigate(dir.path)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{dir.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSelect} disabled={!data?.currentPath}>
                {isCurrentlySelected ? (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Selected
                  </>
                ) : (
                  "Select This Folder"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="h-96 overflow-y-auto">
            <ReposList onClose={() => onOpenChange(false)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
