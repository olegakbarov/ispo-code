/**
 * File List Panel Component
 * Displays changed files as a flat list (no session grouping, no checkboxes)
 */

import { memo, useCallback } from "react"
import { FilePlus, FileEdit, FileX } from "lucide-react"
import type { GitDiffView } from "@/components/git/file-list"

export interface ChangedFile {
  path: string
  relativePath?: string
  repoRelativePath?: string
  sessionId: string
  operation: "create" | "edit" | "delete"
  toolUsed: string
  /** Working directory for this session (worktree path if applicable) */
  sessionWorkingDir?: string
}

interface FileListPanelProps {
  files: ChangedFile[]
  activeFile?: string | null
  onFileClick: (file: string, view: GitDiffView, sessionWorkingDir?: string) => void
}

export function FileListPanel({
  files,
  activeFile,
  onFileClick,
}: FileListPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border/50">
        <h3 className="text-xs font-vcr text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"} changed
        </h3>
      </div>

      {/* Flat file list */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((file) => {
          const gitPath = file.repoRelativePath || file.relativePath || file.path
          const isActive = activeFile === gitPath
          return (
            <FileListItem
              key={file.path}
              file={file}
              isActive={isActive}
              onFileClick={onFileClick}
            />
          )
        })}
      </div>
    </div>
  )
}

interface FileListItemProps {
  file: ChangedFile
  isActive: boolean
  onFileClick: (file: string, view: GitDiffView, sessionWorkingDir?: string) => void
}

const FileListItem = memo(function FileListItem({
  file,
  isActive,
  onFileClick,
}: FileListItemProps) {
  const gitPath = file.repoRelativePath || file.relativePath || file.path
  const displayPath = file.relativePath || file.path

  const handleClick = useCallback(() => {
    onFileClick(gitPath, "working", file.sessionWorkingDir)
  }, [gitPath, onFileClick, file.sessionWorkingDir])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onFileClick(gitPath, "working", file.sessionWorkingDir)
    }
  }, [gitPath, onFileClick, file.sessionWorkingDir])

  const OperationIcon = file.operation === "create" ? FilePlus
    : file.operation === "delete" ? FileX
    : FileEdit

  const operationColor = file.operation === "create"
    ? "text-emerald-500"
    : file.operation === "delete"
    ? "text-red-500"
    : "text-muted-foreground"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        group mx-1 px-2 py-1.5 rounded cursor-pointer
        flex items-center gap-2 transition-all
        ${isActive
          ? "bg-primary/20 border-l-2 border-primary"
          : "hover:bg-muted/50"
        }
      `}
    >
      <OperationIcon className={`w-3.5 h-3.5 flex-shrink-0 ${operationColor}`} />

      <div className="flex-1 min-w-0">
        <span className="text-xs font-mono truncate block text-foreground/90 group-hover:text-foreground">
          {displayPath}
        </span>
      </div>
    </div>
  )
})
