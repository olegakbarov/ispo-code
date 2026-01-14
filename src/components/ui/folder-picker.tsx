/**
 * Folder Picker Component
 *
 * Dialog-based folder browser for selecting working directories.
 * Lists directories within the user's home directory tree.
 */

import { useState } from "react"
import { Folder, FolderOpen, ChevronUp, Home, Check, Loader2 } from "lucide-react"
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

interface FolderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FolderPicker({ open, onOpenChange }: FolderPickerProps) {
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Working Directory</DialogTitle>
        </DialogHeader>

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
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
      </DialogContent>
    </Dialog>
  )
}
