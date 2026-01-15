/**
 * Animated spinner component for loading/running states
 * Uses CSS border technique for smooth animation
 */

import { cn } from '@/lib/utils'

type SpinnerSize = 'xs' | 'sm' | 'md'

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-3 h-3 border-2',
  md: 'w-4 h-4 border-2',
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

export function Spinner({ size = 'sm', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'border-current border-t-transparent rounded-full animate-spin',
        sizeClasses[size],
        className
      )}
    />
  )
}
