/**
 * MarkdownEditor - Click-to-edit markdown component
 *
 * Renders markdown by default. Clicking switches to raw textarea.
 * Blurring returns to rendered view.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { StreamingMarkdown } from './streaming-markdown'
import { StyledTextarea, type StyledTextareaProps } from './styled-textarea'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps extends Omit<StyledTextareaProps, 'value' | 'onChange'> {
  /** Current markdown content */
  value: string
  /** Called when content changes */
  onChange: (value: string) => void
  /** Placeholder shown when empty in display mode */
  placeholder?: string
  /** Additional class for the rendered markdown container */
  displayClassName?: string
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Click to edit...',
  className,
  displayClassName,
  variant = 'sm',
  containerClassName,
  ...textareaProps
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Move cursor to end
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  const handleClick = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  // Edit mode - show textarea
  if (isEditing) {
    return (
      <StyledTextarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        autoGrowValue={value}
        variant={variant}
        containerClassName={containerClassName}
        className={cn('font-mono border-none focus:ring-0 focus:border-none', className)}
        {...textareaProps}
      />
    )
  }

  // Display mode - show rendered markdown (no border)
  const isEmpty = !value.trim()

  return (
    <div className={cn('w-full', containerClassName)}>
      <div
        onClick={handleClick}
        className={cn(
          'cursor-text min-h-[60px] w-full',
          // Padding to match textarea
          variant === 'sm' ? 'px-3 py-2' : 'px-4 py-3',
          displayClassName
        )}
      >
        {isEmpty ? (
          <span className="text-muted-foreground/50 text-sm italic">
            {placeholder}
          </span>
        ) : (
          <StreamingMarkdown
            content={value}
            className={cn(
              'prose prose-sm prose-invert max-w-none',
              // Match text size to variant
              variant === 'sm' ? 'text-xs' : 'text-sm'
            )}
          />
        )}
      </div>
    </div>
  )
}
