import * as React from "react"

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Size variant */
  size?: "sm" | "md"
  /** Label for the "off" state (left side) */
  offLabel?: string
  /** Label for the "on" state (right side) */
  onLabel?: string
}

/**
 * Standardized Switch component
 *
 * Toggle switch with optional labels on both sides.
 * Uses accent color for the active state indicator.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className = "", size = "md", checked, disabled, offLabel, onLabel, onChange, ...props }, ref) => {
    const sizeClasses = {
      sm: {
        track: "w-7 h-4",
        thumb: "w-3 h-3",
        translate: "translate-x-3",
        label: "text-[10px]",
      },
      md: {
        track: "w-9 h-5",
        thumb: "w-4 h-4",
        translate: "translate-x-4",
        label: "text-xs",
      },
    }

    const sizes = sizeClasses[size]

    return (
      <label
        className={`inline-flex items-center gap-2 cursor-pointer select-none ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        {offLabel && (
          <span
            className={`font-vcr ${sizes.label} transition-colors ${
              !checked ? "text-accent" : "text-text-muted"
            }`}
          >
            {offLabel}
          </span>
        )}
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            ref={ref}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            {...props}
          />
          <span
            className={`
              ${sizes.track}
              bg-panel border border-border rounded-full
              peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background
              peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
              transition-colors
            `.replace(/\s+/g, " ").trim()}
          />
          <span
            className={`
              absolute left-0.5
              ${sizes.thumb}
              bg-text-muted rounded-full
              transition-all duration-200
              peer-checked:${sizes.translate}
              peer-checked:bg-accent
            `.replace(/\s+/g, " ").trim()}
            style={{
              transform: checked ? (size === "sm" ? "translateX(12px)" : "translateX(16px)") : "translateX(0)",
              backgroundColor: checked ? "var(--color-accent)" : undefined,
            }}
          />
        </span>
        {onLabel && (
          <span
            className={`font-vcr ${sizes.label} transition-colors ${
              checked ? "text-accent" : "text-text-muted"
            }`}
          >
            {onLabel}
          </span>
        )}
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
