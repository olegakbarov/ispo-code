/**
 * Task Commit Panel Component
 * Allows committing files scoped to a specific task
 */

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc-client"
import { sessionTrpcOptions } from "@/lib/trpc-session"
import { useTextareaDraft } from "@/lib/hooks/use-textarea-draft"
import { GitCommit, Check, X, Loader2, FileCheck } from "lucide-react"

interface TaskCommitPanelProps {
  sessionId: string | undefined
  taskTitle?: string
}

export function TaskCommitPanel({ sessionId, taskTitle }: TaskCommitPanelProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  // Use sessionId in draft key to scope per session
  const draftKey = sessionId ? `task-commit:${sessionId}` : ''
  const [commitMessage, setCommitMessage, clearMessageDraft] = useTextareaDraft(draftKey)
  const utils = trpc.useUtils()
  const sessionTrpc = sessionTrpcOptions(sessionId)

  // Query for changed files
  const { data: files = [], isLoading } = trpc.agent.getChangedFiles.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId }
  )

  // Commit mutation
  const commitMutation = trpc.git.commitScoped.useMutation({
    ...sessionTrpc,
    onSuccess: () => {
      // Clear selections and draft
      setSelectedFiles(new Set())
      clearMessageDraft()
      // Invalidate git status and changed files
      utils.git.status.invalidate()
      utils.agent.getChangedFiles.invalidate()
    },
  })

  if (!sessionId) {
    return null
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading files...</span>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <div className="text-sm text-muted-foreground">
          No files changed yet
        </div>
      </div>
    )
  }

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
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map((f) => f.path)))
    }
  }

  const canCommit = selectedFiles.size > 0 && commitMessage.trim().length > 0 && !commitMutation.isPending

  // Auto-populate commit message with task title if empty
  const handleFocus = () => {
    if (!commitMessage && taskTitle) {
      setCommitMessage(`${taskTitle}`)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCommit className="w-5 h-5" />
          <h3 className="font-medium">Commit Task Changes</h3>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {selectedFiles.size === files.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* File list with checkboxes */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {files.map((file) => (
          <label
            key={file.path}
            className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedFiles.has(file.path)}
              onChange={() => toggleFile(file.path)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono truncate">
                {file.relativePath || file.path}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
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
            {file.linesChanged !== undefined && (
              <span className="text-xs text-muted-foreground">
                {file.linesChanged} lines
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Commit message */}
      <div className="space-y-2">
        <label htmlFor="commit-message" className="text-sm font-medium block">
          Commit Message
        </label>
        <Textarea
          id="commit-message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onFocus={handleFocus}
          placeholder="Describe your changes..."
          className="min-h-[80px] bg-background resize-y"
          disabled={commitMutation.isPending}
        />
      </div>

      {/* Commit button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedFiles.size} of {files.length} files selected
        </div>
        <button
          onClick={() => commitMutation.mutate({ files: Array.from(selectedFiles), message: commitMessage })}
          disabled={!canCommit}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {commitMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Committing...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              Commit Selected Files
            </>
          )}
        </button>
      </div>

      {/* Success/Error messages */}
      {commitMutation.isSuccess && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-3 py-2 rounded">
          <Check className="w-4 h-4" />
          Successfully committed changes
          {commitMutation.data.hash && <span className="font-mono">({commitMutation.data.hash})</span>}
        </div>
      )}
      {commitMutation.isError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          <X className="w-4 h-4" />
          {commitMutation.error instanceof Error ? commitMutation.error.message : "Failed to commit"}
        </div>
      )}
    </div>
  )
}
