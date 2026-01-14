import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, children, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 rounded border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground shadow-lg backdrop-blur normal-case tracking-normal leading-snug",
      className
    )}
    {...props}
  >
    {children}
    <TooltipPrimitive.Arrow className="fill-card stroke-border" />
  </TooltipPrimitive.Content>
))

TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
