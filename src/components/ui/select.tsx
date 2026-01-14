import * as React from "react"
import { ChevronDown } from "lucide-react"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Size variant */
  variant?: "sm" | "md"
}

/**
 * Standardized Select component
 *
 * Native select with custom styling and chevron indicator.
 * Variants:
 * - sm: Compact for dense UIs (px-2 py-1.5 text-xs)
 * - md: Default form size (px-3 py-2 text-sm)
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", variant = "md", children, ...props }, ref) => {
    const sizeClasses = {
      sm: "px-2 py-1.5 pr-7 text-xs",
      md: "px-3 py-2 pr-8 text-sm",
    }

    const iconSizes = {
      sm: "w-3 h-3 right-2",
      md: "w-4 h-4 right-2.5",
    }

    return (
      <div className="relative">
        <select
          ref={ref}
          className={`
            w-full appearance-none
            bg-input border border-border rounded
            text-foreground
            focus:outline-none focus:border-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer transition-colors
            ${sizeClasses[variant]}
            ${className}
          `.replace(/\s+/g, " ").trim()}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={`
            absolute top-1/2 -translate-y-1/2 pointer-events-none
            text-muted-foreground
            ${iconSizes[variant]}
          `.replace(/\s+/g, " ").trim()}
        />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
