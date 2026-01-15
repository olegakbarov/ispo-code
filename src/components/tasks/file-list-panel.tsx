/**
 * File List Panel Component
 * Displays changed files grouped by session with selection checkboxes
 */

import { ChevronRight, ChevronDown } from "lucide-react"
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
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-vcr text-sm text-foreground">Changed Files</h3>
          <button
            onClick={onToggleAll}
            aria-label={selectedFiles.size === files.length ? "Deselect all files" : "Select all files"}
            aria-pressed={selectedFiles.size === files.length}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {selectedFiles.size === files.length ? "Deselect All" : "Select All"}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"} • {filesBySession.size} session{filesBySession.size === 1 ? "" : "s"}
        </div>
      </div>

      {/* File list grouped by session */}
      <div className="flex-1 overflow-y-auto">
        {Array.from(filesBySession.entries()).map(([sessionId, sessionFiles]) => (
          <div key={sessionId} className="border-b border-border">
            <button
              onClick={() => onToggleSession(sessionId)}
              aria-expanded={expandedSessions.has(sessionId)}
              aria-label={`Session ${sessionId.slice(0, 8)}, ${sessionFiles.length} file${sessionFiles.length === 1 ? "" : "s"}`}
              className="w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-accent text-left"
            >
              {expandedSessions.has(sessionId) ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="text-xs font-mono text-muted-foreground flex-1">
                Session {sessionId.slice(0, 8)}
              </span>
              <span className="text-xs text-muted-foreground">
                {sessionFiles.length} file{sessionFiles.length === 1 ? "" : "s"}
              </span>
            </button>

            {expandedSessions.has(sessionId) && (
              <div className="pb-1">
                {sessionFiles.map((file) => (
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
        ))}
      </div>
    </div>
  )
}

interface FileListItemProps {
  file: ChangedFile
  isSelected: boolean
  onToggle: (absolutePath: string, gitPath: string) => void
  onFileClick: (file: string, view: GitDiffView) => void
}

function FileListItem({ file, isSelected, onToggle, onFileClick }: FileListItemProps) {
  const gitPath = file.repoRelativePath || file.relativePath || file.path

  return (
    <div className="px-2 pl-8">
      <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(file.path, gitPath)}
          className="w-3.5 h-3.5 rounded border-gray-300"
        />
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onFileClick(gitPath, "working")
          }}
        >
          <div className="text-xs font-mono truncate">
            {file.relativePath || file.path}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
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
  )
}
