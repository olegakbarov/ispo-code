import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Allowed button variants - standardized subset for consistent UI
 * - default: Primary actions (CTA, main interactions)
 * - destructive: Dangerous actions (delete, discard)
 * - outline: Secondary actions in context
 * - ghost: Tertiary actions, icon buttons
 * - success: Positive confirmations (QA pass, success states)
 */
export const ALLOWED_VARIANTS = ["default", "destructive", "outline", "ghost", "success"] as const
export type AllowedVariant = typeof ALLOWED_VARIANTS[number]

/**
 * Allowed button sizes - standardized subset for consistent UI
 * - default: Standard button (h-10)
 * - sm: Compact button (h-8)
 * - xs: Tiny button for dense UIs (h-6)
 * - icon-sm: Square icon button (8x8)
 * - icon-xs: Tiny square icon button (6x6)
 */
export const ALLOWED_SIZES = ["default", "sm", "xs", "icon-sm", "icon-xs"] as const
export type AllowedSize = typeof ALLOWED_SIZES[number]

const buttonVariants = cva(
  "font-vcr inline-flex items-center justify-center whitespace-nowrap rounded text-sm transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-secondary hover:text-foreground",
        ghost: "hover:bg-secondary hover:text-foreground",
        success: "bg-chart-2 text-white hover:bg-chart-2/90",
        // Deprecated - use outline instead
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Deprecated - use ghost instead
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded px-3",
        xs: "h-6 rounded px-2 text-xs",
        "icon-sm": "h-8 w-8",
        "icon-xs": "h-6 w-6",
        // Deprecated - use default instead
        lg: "h-12 rounded px-6",
        // Deprecated - use icon-sm instead
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
