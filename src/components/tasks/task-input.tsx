/**
 * Shared Task Input Component
 * Unified input UI for both task page (rewrite) and thread page (messaging)
 */

import { useRef, type ReactNode } from 'react'

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
      {/* Main input container */}
      <div className={`relative ${innerClassName} bg-background/95 backdrop-blur-sm border border-border rounded-xl focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-all shadow-lg`}>
        {/* Dropzone overlay (for thread page drag-drop) */}
        {dropzoneOverlay}

        {/* Attachment preview slot (for thread page image attachments) */}
        {attachmentsSlot}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className="w-full px-5 pt-4 pb-14 bg-transparent text-sm leading-relaxed resize-none focus:outline-none placeholder:text-text-muted/50 disabled:opacity-50"
        />

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
              <span className="text-xs text-text-muted">
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
                  : 'bg-panel border border-border text-text-muted/50 cursor-not-allowed'
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
