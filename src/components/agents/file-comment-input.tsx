/**
 * File Comment Input Component
 * Allows users to add feedback on file changes
 */

import { useState } from "react"
import { Send, Loader2 } from "lucide-react"

interface FileCommentInputProps {
  fileName: string
  onSubmit: (comment: string) => Promise<void>
}

export function FileCommentInput({ fileName, onSubmit }: FileCommentInputProps) {
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!comment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(comment)
      setComment("") // Clear input after successful submission
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
      <textarea
        id={`comment-${fileName}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your feedback here... (Cmd/Ctrl+Enter to send)"
        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">
          {comment.length} characters
        </span>
        <button
          onClick={handleSubmit}
          disabled={!comment.trim() || isSubmitting}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
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
