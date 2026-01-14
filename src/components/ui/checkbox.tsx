import * as React from "react"
import { Check, Minus } from "lucide-react"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Size variant */
  size?: "sm" | "md"
  /** Indeterminate state (partial selection) */
  indeterminate?: boolean
}

/**
 * Standardized Checkbox component
 *
 * Custom-styled checkbox with accent color check mark.
 * Replaces native checkbox appearance with project aesthetic.
 * Supports indeterminate state for "select all" patterns.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", size = "md", checked, indeterminate, disabled, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!)

    // Set indeterminate property on the DOM element
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate ?? false
      }
    }, [indeterminate])

    const sizeClasses = {
      sm: "w-3 h-3",
      md: "w-4 h-4",
    }

    const iconSizes = {
      sm: "w-2 h-2",
      md: "w-3 h-3",
    }

    const showCheck = checked && !indeterminate
    const showIndeterminate = indeterminate

    return (
      <span className={`relative inline-flex items-center justify-center ${className}`}>
        <input
          type="checkbox"
          ref={inputRef}
          checked={checked}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <span
          className={`
            ${sizeClasses[size]}
            border border-border rounded-sm
            bg-input
            peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background
            peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
            transition-colors cursor-pointer
            flex items-center justify-center
            ${(checked || indeterminate) ? "bg-primary border-primary" : ""}
          `.replace(/\s+/g, " ").trim()}
        >
          {showCheck && (
            <Check className={`${iconSizes[size]} text-primary-foreground stroke-[3]`} />
          )}
          {showIndeterminate && (
            <Minus className={`${iconSizes[size]} text-primary-foreground stroke-[3]`} />
          )}
        </span>
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
