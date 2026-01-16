/**
 * File List Panel Component
 * Displays changed files grouped by session with selection checkboxes
 */

import { memo, useCallback, useMemo } from "react"
import { ChevronRight, ChevronDown, FilePlus, FileEdit, FileX, Folder } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import type { GitDiffView } from "@/components/git/file-list"

export interface ChangedFile {
  path: string
  relativePath?: string
  repoRelativePath?: string
  sessionId: string
  operation: "create" | "edit" | "delete"
  toolUsed: string
}

interface FileListPanelProps {
  files: ChangedFile[]
  filesBySession: Map<string, ChangedFile[]>
  selectedFiles: Map<string, string>
  expandedSessions: Set<string>
  onToggleFile: (absolutePath: string, gitPath: string) => void
  onToggleAll: () => void
  onToggleSession: (sessionId: string) => void
  onFileClick: (file: string, view: GitDiffView) => void
}

export function FileListPanel({
  files,
  filesBySession,
  selectedFiles,
  expandedSessions,
  onToggleFile,
  onToggleAll,
  onToggleSession,
  onFileClick,
}: FileListPanelProps) {
  const allSelected = files.length > 0 && selectedFiles.size === files.length
  const someSelected = selectedFiles.size > 0 && selectedFiles.size < files.length

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={onToggleAll}
              size="sm"
              aria-label={allSelected ? "Deselect all files" : "Select all files"}
            />
            <div>
              <h3 className="text-sm font-medium text-foreground">Changed Files</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedFiles.size > 0 ? (
                  <span>{selectedFiles.size} of {files.length} selected</span>
                ) : (
                  <span>{files.length} file{files.length === 1 ? "" : "s"} • {filesBySession.size} session{filesBySession.size === 1 ? "" : "s"}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* File list grouped by session */}
      <div className="flex-1 overflow-y-auto">
        {Array.from(filesBySession.entries()).map(([sessionId, sessionFiles]) => (
          <SessionGroup
            key={sessionId}
            sessionId={sessionId}
            files={sessionFiles}
            selectedFiles={selectedFiles}
            isExpanded={expandedSessions.has(sessionId)}
            onToggleSession={onToggleSession}
            onToggleFile={onToggleFile}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  )
}

interface SessionGroupProps {
  sessionId: string
  files: ChangedFile[]
  selectedFiles: Map<string, string>
  isExpanded: boolean
  onToggleSession: (sessionId: string) => void
  onToggleFile: (absolutePath: string, gitPath: string) => void
  onFileClick: (file: string, view: GitDiffView) => void
}

const SessionGroup = memo(function SessionGroup({
  sessionId,
  files,
  selectedFiles,
  isExpanded,
  onToggleSession,
  onToggleFile,
  onFileClick,
}: SessionGroupProps) {
  const selectedCount = useMemo(
    () => files.filter(f => selectedFiles.has(f.path)).length,
    [files, selectedFiles]
  )

  return (
    <div className="border-b border-border/30">
      <button
        onClick={() => onToggleSession(sessionId)}
        aria-expanded={isExpanded}
        className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left group"
      >
        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
        <Folder className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-mono text-foreground/80 flex-1">
          {sessionId.slice(0, 8)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {selectedCount > 0 && selectedCount < files.length && (
            <span className="text-primary mr-1">{selectedCount}/</span>
          )}
          {files.length}
        </span>
      </button>

      {isExpanded && (
        <div className="pb-1">
          {files.map((file) => (
            <FileListItem
              key={file.path}
              file={file}
              isSelected={selectedFiles.has(file.path)}
              onToggle={onToggleFile}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface FileListItemProps {
  file: ChangedFile
  isSelected: boolean
  onToggle: (absolutePath: string, gitPath: string) => void
  onFileClick: (file: string, view: GitDiffView) => void
}

const FileListItem = memo(function FileListItem({
  file,
  isSelected,
  onToggle,
  onFileClick,
}: FileListItemProps) {
  const gitPath = file.repoRelativePath || file.relativePath || file.path
  const displayPath = file.relativePath || file.path

  const handleRowClick = useCallback(() => {
    // Open file diff view when clicking on the row
    onFileClick(gitPath, "working")
  }, [gitPath, onFileClick])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Enter opens the file
      onFileClick(gitPath, "working")
    } else if (e.key === " ") {
      // Space toggles selection
      e.preventDefault()
      onToggle(file.path, gitPath)
    }
  }, [file.path, gitPath, onToggle, onFileClick])

  const OperationIcon = file.operation === "create" ? FilePlus
    : file.operation === "delete" ? FileX
    : FileEdit

  const operationColor = file.operation === "create"
    ? "text-emerald-500"
    : file.operation === "delete"
    ? "text-red-500"
    : "text-blue-500"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={`
        group mx-2 px-3 py-2 rounded-md cursor-pointer
        flex items-center gap-3 transition-all
        ${isSelected
          ? "bg-primary/10 hover:bg-primary/15"
          : "hover:bg-muted/50"
        }
      `}
    >
      <div data-checkbox onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onChange={() => onToggle(file.path, gitPath)}
          size="sm"
          aria-label={`Select ${displayPath}`}
        />
      </div>

      <OperationIcon className={`w-4 h-4 flex-shrink-0 ${operationColor}`} />

      <div className="flex-1 min-w-0">
        <span className="text-sm font-mono truncate block text-foreground/90 group-hover:text-foreground">
          {displayPath}
        </span>
      </div>
    </div>
  )
})
