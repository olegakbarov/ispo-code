/**
 * Shared Task Input Component
 * Unified input UI for both task page (rewrite) and thread page (messaging)
 *
 * Composes StyledTextarea for consistent styling foundation.
 */

import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TaskInputProps {
  // Input state
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number

  // Submit handling
  onSubmit: () => void
  canSubmit: boolean
  submitLabel: string
  submitIcon?: ReactNode
  isSubmitting?: boolean

  // Optional slots for custom content
  toolbarLeft?: ReactNode
  toolbarRight?: ReactNode
  attachmentsSlot?: ReactNode
  dropzoneOverlay?: ReactNode

  // Container styling - absolute positioned (task page) or inline (thread page)
  containerClassName?: string
  // Inner wrapper styling (for max-width, centering, etc.)
  innerClassName?: string
}

/**
 * TaskInput - Full-featured input with toolbar, submit button, and slots
 *
 * Uses the same styling foundation as StyledTextarea but adds:
 * - Bottom toolbar with submit button
 * - Keyboard hint (↵ to send)
 * - Slots for dropzone, attachments, left/right toolbar items
 * - Shadow and backdrop blur
 */
export function TaskInput({
  value,
  onChange,
  placeholder = 'Type your message...',
  disabled = false,
  rows = 6,
  onSubmit,
  canSubmit,
  submitLabel,
  submitIcon,
  isSubmitting = false,
  toolbarLeft,
  toolbarRight,
  attachmentsSlot,
  dropzoneOverlay,
  containerClassName,
  innerClassName = 'w-full max-w-[800px]',
}: TaskInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className={containerClassName}>
      {/* Main input container - matches StyledTextarea base styling with additions */}
      <div className={`relative ${innerClassName} bg-background/95 backdrop-blur-sm border border-border rounded-xl focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-all shadow-lg`}>
        {/* Dropzone overlay (for thread page drag-drop) */}
        {dropzoneOverlay}

        {/* Attachment preview slot (for thread page image attachments) */}
        {attachmentsSlot}

        {/* Textarea with grow-wrap for auto-height - uses StyledTextarea styling foundation */}
        <div className="grow-wrap w-full" data-replicated-value={value}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className={cn(
              // StyledTextarea base classes (without border/focus - container handles those)
              'w-full bg-transparent',
              'text-foreground placeholder:text-muted-foreground/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all resize-none leading-relaxed',
              // TaskInput-specific padding (extra bottom for toolbar)
              'px-5 pt-4 pb-14 text-sm',
              'focus:outline-none'
            )}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-4">
          {/* Left side - custom controls (agent picker, split button, etc.) */}
          <div className="flex items-center gap-2">
            {toolbarLeft}
          </div>

          {/* Right side - submit + custom controls */}
          <div className="flex items-center gap-3">
            {toolbarRight}
            {value.trim() && (
              <span className="text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 rounded bg-panel border border-border text-[10px] font-mono">↵</kbd>
                <span className="ml-1.5">to send</span>
              </span>
            )}
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-vcr transition-all ${
                canSubmit
                  ? 'bg-accent text-background hover:opacity-90 cursor-pointer shadow-sm'
                  : 'bg-panel border border-border text-muted-foreground/50 cursor-not-allowed'
              }`}
              title={isSubmitting ? 'Sending...' : submitLabel}
            >
              {submitIcon && <span className={isSubmitting ? 'animate-pulse' : ''}>{submitIcon}</span>}
              <span>{isSubmitting ? 'Sending...' : submitLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
