/**
 * Files Section Component
 * Container for changed files list with expandable diffs
 */

import { useState } from "react"
import { trpc } from "@/lib/trpc-client"
import type { EditedFileInfo } from "@/lib/agent/types"
import { ChangedFilesList } from "./changed-files-list"
import { InlineDiffViewer } from "./inline-diff-viewer"
import { FileCommentInput } from "./file-comment-input"
import { Loader2 } from "lucide-react"

interface FilesSectionProps {
  sessionId: string
}

export function FilesSection({ sessionId }: FilesSectionProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // Query for changed files
  const { data: files = [], isLoading } = trpc.agent.getChangedFiles.useQuery(
    { sessionId },
    { refetchInterval: 2000 } // Poll every 2 seconds
  )

  // Mutation for sending messages to agent
  const sendMessage = trpc.agent.sendMessage.useMutation()

  const handleFileClick = (file: EditedFileInfo) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(file.path)) {
      newExpanded.delete(file.path)
    } else {
      newExpanded.add(file.path)
    }
    setExpandedFiles(newExpanded)
  }

  const handleCommentSubmit = async (file: EditedFileInfo, comment: string) => {
    const displayPath = file.relativePath || file.path
    const formattedMessage = `Feedback on ${displayPath}:\n\n${comment}`
    await sendMessage.mutateAsync({ sessionId, message: formattedMessage })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading files...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Changed Files</h3>
        <span className="text-xs text-muted-foreground">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
      </div>

      <ChangedFilesList
        files={files}
        onFileClick={handleFileClick}
        expandedFiles={expandedFiles}
      />

      {/* Expanded file diffs */}
      {Array.from(expandedFiles).map((filePath) => {
        const file = files.find((f) => f.path === filePath)
        if (!file) return null

        return (
          <ExpandedFileDiff
            key={filePath}
            file={file}
            onCommentSubmit={(comment) => handleCommentSubmit(file, comment)}
          />
        )
      })}
    </div>
  )
}

interface ExpandedFileDiffProps {
  file: EditedFileInfo
  onCommentSubmit: (comment: string) => Promise<void>
}

function ExpandedFileDiff({ file, onCommentSubmit }: ExpandedFileDiffProps) {
  const displayPath = file.repoRelativePath || file.relativePath || file.path

  // Query for file diff
  const { data: diff, isLoading } = trpc.git.diff.useQuery({
    file: displayPath,
    view: "working",
  })

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <InlineDiffViewer
        file={displayPath}
        diff={diff || null}
        loading={isLoading}
        onViewInGit={() => {
          // Navigate to git UI with this file
          window.location.href = `/git?file=${encodeURIComponent(displayPath)}`
        }}
      />
      <FileCommentInput
        fileName={displayPath}
        onSubmit={onCommentSubmit}
      />
    </div>
  )
}
