/**
 * Changed Files List Component
 * Displays files modified by an agent session
 */

import { memo } from "react"
import type { EditedFileInfo } from "@/lib/agent/types"
import { Clock, FileEdit, FilePlus, FileX, ChevronDown, ChevronRight } from "lucide-react"

// Module-level constant to avoid creating new Set on every render
const DEFAULT_EXPANDED_FILES = new Set<string>()

interface ChangedFilesListProps {
  files: EditedFileInfo[]
  onFileClick?: (file: EditedFileInfo) => void
  expandedFiles?: Set<string>
}

export function ChangedFilesList({
  files,
  onFileClick,
  expandedFiles = DEFAULT_EXPANDED_FILES,
}: ChangedFilesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No files changed yet
      </div>
    )
  }

  // Group files by operation
  const grouped = files.reduce((acc, file) => {
    const op = file.operation
    if (!acc[op]) acc[op] = []
    acc[op].push(file)
    return acc
  }, {} as Record<string, EditedFileInfo[]>)

  return (
    <div className="space-y-4">
      {grouped.create && grouped.create.length > 0 && (
        <FileGroup
          title="Created"
          icon={<FilePlus className="w-4 h-4" />}
          files={grouped.create}
          onFileClick={onFileClick}
          expandedFiles={expandedFiles}
          color="text-green-600 dark:text-green-400"
        />
      )}
      {grouped.edit && grouped.edit.length > 0 && (
        <FileGroup
          title="Modified"
          icon={<FileEdit className="w-4 h-4" />}
          files={grouped.edit}
          onFileClick={onFileClick}
          expandedFiles={expandedFiles}
          color="text-blue-600 dark:text-blue-400"
        />
      )}
      {grouped.delete && grouped.delete.length > 0 && (
        <FileGroup
          title="Deleted"
          icon={<FileX className="w-4 h-4" />}
          files={grouped.delete}
          onFileClick={onFileClick}
          expandedFiles={expandedFiles}
          color="text-red-600 dark:text-red-400"
        />
      )}
    </div>
  )
}

interface FileGroupProps {
  title: string
  icon: React.ReactNode
  files: EditedFileInfo[]
  onFileClick?: (file: EditedFileInfo) => void
  expandedFiles: Set<string>
  color: string
}

const FileGroup = memo(function FileGroup({ title, icon, files, onFileClick, expandedFiles, color }: FileGroupProps) {
  return (
    <div>
      <div className={`flex items-center gap-2 text-sm font-medium mb-2 ${color}`}>
        {icon}
        <span>{title}</span>
        <span className="text-muted-foreground">({files.length})</span>
      </div>
      <div className="space-y-1">
        {files.map((file) => (
          <FileItem
            key={file.path}
            file={file}
            onClick={() => onFileClick?.(file)}
            isExpanded={expandedFiles.has(file.path)}
          />
        ))}
      </div>
    </div>
  )
})

interface FileItemProps {
  file: EditedFileInfo
  onClick: () => void
  isExpanded: boolean
}

const FileItem = memo(function FileItem({ file, onClick, isExpanded }: FileItemProps) {
  const displayPath = file.relativePath || file.path
  const timestamp = new Date(file.timestamp).toLocaleTimeString()

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm group"
      title={file.path}
    >
      <div className="flex items-center gap-2">
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        )}
        <span className="flex-1 truncate font-mono">{displayPath}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          <Clock className="w-3 h-3" />
          <span>{timestamp}</span>
        </div>
      </div>
      <div className="ml-5 flex items-center gap-2 mt-1">
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {file.toolUsed}
        </span>
        {file.linesChanged !== undefined && (
          <span className="text-xs text-muted-foreground">
            {file.linesChanged} lines
          </span>
        )}
      </div>
    </button>
  )
})
