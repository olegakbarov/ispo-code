import { LoaderIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type SpinnerSize = 'xs' | 'sm' | 'md'

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

export function Spinner({ size = 'sm', className }: SpinnerProps) {
  return (
    <LoaderIcon
      className={cn('animate-spin', sizeClasses[size], className)}
    />
  )
}
