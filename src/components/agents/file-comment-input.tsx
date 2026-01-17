/**
 * File Comment Input Component
 * Allows users to add feedback on file changes.
 * When taskPath is provided, comments spawn agent sessions linked to the task.
 */

import { useState, useRef } from "react"
import { MessageSquare, Paperclip, Send, X, Plus } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { StyledTextarea } from "@/components/ui/styled-textarea"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc-client"
import { useTextareaDraft } from "@/lib/hooks/use-textarea-draft"
import type { ImageAttachment } from "@/lib/agent/types"

/** Accepted image MIME types */
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]

/** Default max file size: 10MB */
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024

/**
 * Convert a File to an ImageAttachment (base64 encoded)
 */
async function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64Data = dataUrl.split(",")[1]
      if (!base64Data) {
        reject(new Error("Failed to read file as base64"))
        return
      }
      resolve({
        type: "image",
        mimeType: file.type,
        data: base64Data,
        fileName: file.name,
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface FileCommentInputProps {
  fileName: string
  /** If provided, comments will spawn agent sessions linked to this task */
  taskPath?: string
  /** Source file for comment context (used for thread backlinks) */
  sourceFile?: string
  /** Line number if this is an inline comment */
  sourceLine?: number
  /** Legacy handler - used when taskPath not provided */
  onSubmit?: (comment: string) => Promise<void>
  /** Optional close handler - shows close button when provided */
  onClose?: () => void
}

export function FileCommentInput({
  fileName,
  taskPath,
  sourceFile,
  sourceLine,
  onSubmit,
  onClose,
}: FileCommentInputProps) {
  // Draft key includes file and optional line number for unique context
  const draftKey = `file-comment:${fileName}${sourceLine ? `:${sourceLine}` : ''}`
  const [comment, setComment, clearDraft] = useTextareaDraft(draftKey)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxFiles = 3
  const maxSizeBytes = DEFAULT_MAX_SIZE

  // Handle file selection
  const handleFiles = async (files: FileList | File[]) => {
    setAttachError(null)
    const fileArray = Array.from(files)

    const remainingSlots = maxFiles - attachments.length
    if (fileArray.length > remainingSlots) {
      setAttachError(`Can only add ${remainingSlots} more image${remainingSlots !== 1 ? "s" : ""}`)
      return
    }

    const newAttachments: ImageAttachment[] = []
    for (const file of fileArray) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setAttachError(`${file.name}: Unsupported type. Use PNG, JPEG, GIF, or WebP.`)
        continue
      }
      if (file.size > maxSizeBytes) {
        const maxMB = Math.round(maxSizeBytes / 1024 / 1024)
        setAttachError(`${file.name}: File too large. Max ${maxMB}MB.`)
        continue
      }
      try {
        const attachment = await fileToAttachment(file)
        newAttachments.push(attachment)
      } catch {
        setAttachError(`${file.name}: Failed to process file.`)
      }
    }

    if (newAttachments.length > 0) {
      setAttachments([...attachments, ...newAttachments])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    e.target.value = ""
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
    setAttachError(null)
  }

  const utils = trpc.useUtils()

  // Spawn mutation for creating comment threads with optimistic updates
  const spawnMutation = trpc.agent.spawn.useMutation({
    onMutate: async () => {
      // Cancel outgoing refetches
      await utils.agent.list.cancel()

      // Snapshot for rollback
      const previousList = utils.agent.list.getData()
      const previousComment = comment

      // Optimistically clear comment and attachments
      setComment("")
      setAttachments([])

      return { previousList, previousComment }
    },
    onSuccess: () => {
      // Clear draft on successful submit
      clearDraft()
      // Stay on current page - session will be visible in task sidebar
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousList) {
        utils.agent.list.setData(undefined, context.previousList)
      }
      if (context?.previousComment) {
        setComment(context.previousComment)
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      utils.agent.list.invalidate()
    },
  })

  const handleSubmit = async () => {
    if (!comment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // If taskPath is provided, spawn an agent session
      if (taskPath) {
        const title = sourceLine
          ? `Comment: ${fileName}:${sourceLine}`
          : `Comment: ${fileName}`

        const prompt = sourceLine
          ? `File comment on ${fileName} at line ${sourceLine}:\n\n${comment.trim()}\n\nPlease review and address this feedback.`
          : `File comment on ${fileName}:\n\n${comment.trim()}\n\nPlease review and address this feedback.`

        await spawnMutation.mutateAsync({
          prompt,
          title,
          taskPath,
          sourceFile: sourceFile || fileName,
          sourceLine,
          attachments: attachments.length > 0 ? attachments : undefined,
        })
      } else if (onSubmit) {
        // Legacy behavior - use callback
        await onSubmit(comment)
        clearDraft()
      }
    } catch (error) {
      console.error("Failed to submit comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canAddMore = attachments.length < maxFiles && !isSubmitting

  return (
    <div className="mt-3 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-lg overflow-hidden transition-all focus-within:ring-1 focus-within:ring-primary/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">Add feedback</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Textarea - borderless, blends into container (uses StyledTextarea base styling) */}
      <StyledTextarea
        id={`comment-${fileName}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Share your feedback..."
        className="border-0 focus:border-0 focus:ring-0 min-h-[100px] rounded-none"
        variant="md"
        disabled={isSubmitting}
      />

      {/* Toolbar row */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border/30 bg-muted/20">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={isSubmitting}
        />

        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAddMore}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Attach images"
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Attach</span>
        </button>

        {/* Inline thumbnails */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-1.5">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="relative group w-8 h-8 rounded border border-border bg-muted overflow-hidden"
              >
                <img
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt={att.fileName || `Image ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Remove"
                >
                  <X className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))}
            {canAddMore && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                title="Add more"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Error message */}
        {attachError && (
          <span className="text-xs text-destructive truncate">{attachError}</span>
        )}

        {/* Spacer + char count */}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {comment.length}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/30">
        <kbd className="text-[10px] text-muted-foreground font-mono">
          {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+↵ to send
        </kbd>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!comment.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner size="xs" className="mr-1.5" />
              Sending
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
