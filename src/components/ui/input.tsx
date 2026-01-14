import * as React from "react"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Size variant - affects padding and font size */
  variant?: "sm" | "md"
}

/**
 * Standardized Input component
 *
 * Variants:
 * - sm: Compact for inline/dense UIs (px-2 py-1 text-xs)
 * - md: Default form input size (px-3 py-2 text-sm)
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type, variant = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "px-2 py-1 text-xs",
      md: "px-3 py-2 text-sm",
    }

    return (
      <input
        type={type}
        className={`
          w-full
          bg-input border border-border rounded
          text-foreground placeholder:text-muted-foreground
          focus:outline-none focus:border-primary
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${sizeClasses[variant]}
          ${className}
        `.replace(/\s+/g, " ").trim()}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
