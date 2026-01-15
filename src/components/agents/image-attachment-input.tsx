/**
 * Image Attachment Input Component
 * Provides file input, drag-drop, and preview functionality for image attachments
 */

import { useRef, useState, useCallback } from "react"
import { Image, X, Plus } from "lucide-react"
import type { ImageAttachment } from "@/lib/agent/types"

interface ImageAttachmentInputProps {
  attachments: ImageAttachment[]
  onChange: (attachments: ImageAttachment[]) => void
  maxFiles?: number
  maxSizeBytes?: number
  disabled?: boolean
  compact?: boolean
}

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
      // Extract base64 data from data URL (format: "data:image/png;base64,...")
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

export function ImageAttachmentInput({
  attachments,
  onChange,
  maxFiles = 5,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  disabled = false,
  compact = false,
}: ImageAttachmentInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null)
    const fileArray = Array.from(files)

    // Validate file count
    const remainingSlots = maxFiles - attachments.length
    if (fileArray.length > remainingSlots) {
      setError(`Can only add ${remainingSlots} more image${remainingSlots !== 1 ? "s" : ""}`)
      return
    }

    // Process each file
    const newAttachments: ImageAttachment[] = []
    for (const file of fileArray) {
      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`${file.name}: Unsupported type. Use PNG, JPEG, GIF, or WebP.`)
        continue
      }

      // Validate size
      if (file.size > maxSizeBytes) {
        const maxMB = Math.round(maxSizeBytes / 1024 / 1024)
        setError(`${file.name}: File too large. Max ${maxMB}MB.`)
        continue
      }

      try {
        const attachment = await fileToAttachment(file)
        newAttachments.push(attachment)
      } catch (err) {
        setError(`${file.name}: Failed to process file.`)
      }
    }

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments])
    }
  }, [attachments, onChange, maxFiles, maxSizeBytes])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [disabled, handleFiles])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input so same file can be selected again
    e.target.value = ""
  }, [handleFiles])

  const removeAttachment = useCallback((index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index)
    onChange(newAttachments)
    setError(null)
  }, [attachments, onChange])

  const canAddMore = attachments.length < maxFiles && !disabled

  // Compact mode: inline button only
  if (compact && attachments.length === 0) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Attach images"
        >
          <Image className="w-4 h-4" />
        </button>
      </>
    )
  }

  return (
    <div className="space-y-2">
      {/* Preview thumbnails */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="relative group w-16 h-16 rounded border border-border bg-muted overflow-hidden"
            >
              <img
                src={`data:${att.mimeType};base64,${att.data}`}
                alt={att.fileName || `Image ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="absolute top-0 right-0 p-0.5 bg-background/80 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
              {att.fileName && (
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-background/80 text-[8px] text-muted-foreground truncate">
                  {att.fileName}
                </div>
              )}
            </div>
          ))}

          {/* Add more button */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded border border-dashed border-border bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              title="Add more images"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Drop zone (only when no attachments or in expanded mode) */}
      {attachments.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => canAddMore && fileInputRef.current?.click()}
          className={`
            flex items-center justify-center gap-2 px-3 py-2 rounded border border-dashed
            transition-colors cursor-pointer
            ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <Image className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {isDragOver ? "Drop images here" : "Click or drag to attach images"}
          </span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
    </div>
  )
}

/**
 * Preview component for displaying attached images in output
 */
export function ImageAttachmentPreview({ attachments }: { attachments?: ImageAttachment[] }) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att, i) => (
        <div
          key={i}
          className="w-20 h-20 rounded border border-border bg-muted overflow-hidden"
        >
          <img
            src={`data:${att.mimeType};base64,${att.data}`}
            alt={att.fileName || `Image ${i + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  )
}
