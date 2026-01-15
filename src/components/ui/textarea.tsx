import * as React from "react"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Size variant - affects padding and font size */
  variant?: "sm" | "md"
}

/**
 * Standardized Textarea component
 *
 * Variants:
 * - sm: Compact for inline/dense UIs (px-2 py-1.5 text-xs)
 * - md: Default form input size (px-3 py-2 text-sm)
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", variant = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "px-2 py-1.5 text-xs",
      md: "px-3 py-2 text-sm",
    }

    return (
      <textarea
        className={`
          w-full
          bg-input border border-border rounded
          text-foreground placeholder:text-muted-foreground
          focus:outline-none focus:border-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors resize-none
          ${sizeClasses[variant]}
          ${className}
        `.replace(/\s+/g, " ").trim()}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
