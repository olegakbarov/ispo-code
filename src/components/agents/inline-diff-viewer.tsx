/**
 * Inline Diff Viewer Component
 * Displays file diffs with syntax highlighting
 */

import { useState } from "react"
import type { FileDiff } from "@/lib/agent/git-service"
import { parseDiff, Diff, Hunk } from "react-diff-view"
import { ExternalLink, GitBranch, Loader2 } from "lucide-react"
import "react-diff-view/style/index.css"

interface InlineDiffViewerProps {
  file: string
  diff: FileDiff | null
  loading?: boolean
  onViewInGit?: () => void
  onStage?: () => void
  onDiscard?: () => void
}

export function InlineDiffViewer({
  file,
  diff,
  loading,
  onViewInGit,
  onStage,
  onDiscard,
}: InlineDiffViewerProps) {
  const [viewType] = useState<"split" | "unified">("unified")

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading diff...
      </div>
    )
  }

  if (!diff) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No diff available
      </div>
    )
  }

  if (diff.isBinary) {
    return (
      <div className="text-sm text-muted-foreground p-4 flex items-center gap-2">
        <GitBranch className="w-4 h-4" />
        Binary file - no diff available
      </div>
    )
  }

  // Generate unified diff format
  const diffText = generateUnifiedDiff(file, diff)

  try {
    const [parsedFile] = parseDiff(diffText)

    if (!parsedFile) {
      return (
        <div className="text-sm text-muted-foreground p-4">
          No changes to display
        </div>
      )
    }

    return (
      <div className="border rounded-lg overflow-hidden bg-background">
        {/* Header */}
        <div className="border-b bg-muted/50 px-4 py-2 flex items-center justify-between">
          <div className="text-sm font-mono">
            {diff.isNew && <span className="text-green-600 dark:text-green-400 mr-2">New file</span>}
            {diff.isDeleted && <span className="text-red-600 dark:text-red-400 mr-2">Deleted</span>}
            <span className="text-muted-foreground">{file}</span>
          </div>
          <div className="flex items-center gap-2">
            {onViewInGit && (
              <button
                onClick={onViewInGit}
                className="text-xs px-2 py-1 rounded hover:bg-accent flex items-center gap-1"
                title="View in Git UI"
              >
                <ExternalLink className="w-3 h-3" />
                View in Git
              </button>
            )}
            {onStage && (
              <button
                onClick={onStage}
                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Stage File
              </button>
            )}
            {onDiscard && (
              <button
                onClick={onDiscard}
                className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Discard
              </button>
            )}
          </div>
        </div>

        {/* Diff Content */}
        <div className="overflow-x-auto text-xs">
          <Diff
            viewType={viewType}
            diffType={parsedFile.type}
            hunks={parsedFile.hunks || []}
          >
            {(hunks) =>
              hunks.map((hunk) => (
                <Hunk key={`${hunk.oldStart}-${hunk.newStart}`} hunk={hunk} />
              ))
            }
          </Diff>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Failed to parse diff:", error)
    return (
      <div className="text-sm text-destructive p-4">
        Failed to parse diff: {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }
}

/**
 * Generate unified diff format from FileDiff
 */
function generateUnifiedDiff(filename: string, diff: FileDiff): string {
  const oldContent = diff.oldContent
  const newContent = diff.newContent

  // Create a unified diff header
  const header = [
    `diff --git a/${filename} b/${filename}`,
    diff.isNew ? "new file mode 100644" : diff.isDeleted ? "deleted file mode 100644" : "",
    `--- ${diff.isNew ? "/dev/null" : `a/${filename}`}`,
    `+++ ${diff.isDeleted ? "/dev/null" : `b/${filename}`}`,
  ].filter(Boolean).join("\n")

  // Simple line-by-line diff
  const oldLines = oldContent.split("\n")
  const newLines = newContent.split("\n")

  // Generate hunks
  const hunks: string[] = []
  let currentHunk: string[] = []
  let oldLineNum = 1
  let newLineNum = 1
  let hunkOldStart = 1
  let hunkNewStart = 1
  let hunkOldCount = 0
  let hunkNewCount = 0

  const maxLen = Math.max(oldLines.length, newLines.length)

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]

    if (oldLine === newLine && oldLine !== undefined) {
      // Context line
      currentHunk.push(` ${oldLine}`)
      hunkOldCount++
      hunkNewCount++
      oldLineNum++
      newLineNum++
    } else {
      // Start new hunk if needed
      if (currentHunk.length === 0) {
        hunkOldStart = oldLineNum
        hunkNewStart = newLineNum
      }

      if (oldLine !== undefined && (newLine === undefined || oldLine !== newLine)) {
        currentHunk.push(`-${oldLine}`)
        hunkOldCount++
        oldLineNum++
      }
      if (newLine !== undefined && (oldLine === undefined || oldLine !== newLine)) {
        currentHunk.push(`+${newLine}`)
        hunkNewCount++
        newLineNum++
      }
    }

    // Close hunk after some context
    if (currentHunk.length > 0 && (i === maxLen - 1 || (oldLine === newLine && currentHunk.length > 50))) {
      const hunkHeader = `@@ -${hunkOldStart},${hunkOldCount} +${hunkNewStart},${hunkNewCount} @@`
      hunks.push(hunkHeader + "\n" + currentHunk.join("\n"))
      currentHunk = []
      hunkOldCount = 0
      hunkNewCount = 0
    }
  }

  return header + "\n" + hunks.join("\n")
}
