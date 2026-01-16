/**
 * StyledTextarea - Unified textarea styling matching TaskInput aesthetic
 *
 * Features:
 * - Auto-grow via CSS `grow-wrap` pattern (needs data-replicated-value + .grow-wrap)
 * - Rounded corners, accent border on focus
 * - Transparent background with subtle border
 * - Consistent sizing and padding
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StyledTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Value for auto-grow calculation (typically same as value prop) */
  autoGrowValue?: string
  /** Size variant - affects padding and font size */
  variant?: 'sm' | 'md'
  /** Container className for the grow-wrap wrapper */
  containerClassName?: string
}

/**
 * StyledTextarea with TaskInput-style aesthetics
 *
 * For auto-grow behavior, wrap in a container with:
 * - className="grow-wrap"
 * - data-replicated-value={value}
 *
 * Variants:
 * - sm: Compact for dense UIs (px-3 py-2 text-xs)
 * - md: Standard form input (px-4 py-3 text-sm)
 */
const StyledTextarea = React.forwardRef<HTMLTextAreaElement, StyledTextareaProps>(
  (
    {
      className,
      variant = 'md',
      autoGrowValue,
      containerClassName,
      value,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'px-3 py-2 text-xs',
      md: 'px-4 py-3 text-sm',
    }

    const baseClasses = cn(
      'w-full bg-transparent',
      'border border-border rounded-xl',
      'text-foreground placeholder:text-muted-foreground/50',
      'focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'transition-all resize-none leading-relaxed',
      sizeClasses[variant],
      className
    )

    // Determine the value to use for auto-grow
    const growValue = autoGrowValue ?? (typeof value === 'string' ? value : '')

    // If autoGrowValue is provided, wrap in grow-wrap container
    if (autoGrowValue !== undefined || value !== undefined) {
      return (
        <div
          className={cn('grow-wrap w-full', containerClassName)}
          data-replicated-value={growValue}
        >
          <textarea
            ref={ref}
            value={value}
            className={baseClasses}
            {...props}
          />
        </div>
      )
    }

    // Simple textarea without auto-grow wrapper
    return (
      <textarea
        ref={ref}
        value={value}
        className={baseClasses}
        {...props}
      />
    )
  }
)

StyledTextarea.displayName = 'StyledTextarea'

export { StyledTextarea }
