/**
 * File Comment Input Component
 * Allows users to add feedback on file changes.
 * When taskPath is provided, comments spawn agent sessions linked to the task.
 */

import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Send } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { trpc } from "@/lib/trpc-client"
import { ImageAttachmentInput } from "@/components/agents/image-attachment-input"
import { useTextareaDraft } from "@/lib/hooks/use-textarea-draft"
import type { ImageAttachment } from "@/lib/agent/types"

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
}

export function FileCommentInput({
  fileName,
  taskPath,
  sourceFile,
  sourceLine,
  onSubmit,
}: FileCommentInputProps) {
  // Draft key includes file and optional line number for unique context
  const draftKey = `file-comment:${fileName}${sourceLine ? `:${sourceLine}` : ''}`
  const [comment, setComment, clearDraft] = useTextareaDraft(draftKey)
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

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
    onSuccess: (data) => {
      // Clear draft on successful submit
      clearDraft()
      // Navigate to the new session
      navigate({
        to: "/agents/$sessionId",
        params: { sessionId: data.sessionId },
      })
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

  return (
    <div className="mt-3 border rounded-lg p-3 bg-muted/30">
      <label htmlFor={`comment-${fileName}`} className="text-sm font-medium block mb-2">
        Add feedback on this file
      </label>
      <Textarea
        id={`comment-${fileName}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your feedback here... (Cmd/Ctrl+Enter to send)"
        className="min-h-[80px] bg-background resize-y"
        disabled={isSubmitting}
      />
      {/* Image attachments */}
      <div className="mt-2">
        <ImageAttachmentInput
          attachments={attachments}
          onChange={setAttachments}
          disabled={isSubmitting}
          maxFiles={3}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {comment.length} characters{attachments.length > 0 ? ` + ${attachments.length} image${attachments.length > 1 ? "s" : ""}` : ""}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!comment.trim() || isSubmitting}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Spinner size="xs" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-3 h-3" />
              Send to Agent
            </>
          )}
        </button>
      </div>
    </div>
  )
}
