/**
 * Error Boundary - Catches and handles React component errors
 *
 * Prevents the entire app from crashing when a component throws an error
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Optional fallback UI to show when an error occurs
   */
  fallback?: ReactNode | ((error: Error) => ReactNode)
  /**
   * Optional callback when an error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /**
   * Optional name for debugging
   */
  name?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component that catches errors in child components
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, name } = this.props

    // Log to console
    console.error(
      `[ErrorBoundary${name ? ` ${name}` : ''}] Caught error:`,
      error,
      errorInfo
    )

    // Call optional error handler
    if (onError) {
      onError(error, errorInfo)
    }
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      // Render custom fallback if provided
      if (fallback) {
        return typeof fallback === 'function' ? fallback(error) : fallback
      }

      // Default fallback UI
      return (
        <div className="p-4 border border-red-500 bg-red-50 dark:bg-red-950 rounded">
          <h3 className="text-red-700 dark:text-red-300 font-semibold mb-2">
            Something went wrong
          </h3>
          <details className="text-sm text-red-600 dark:text-red-400">
            <summary className="cursor-pointer">Error details</summary>
            <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900 rounded overflow-x-auto">
              {error.toString()}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        </div>
      )
    }

    return children
  }
}

/**
 * Simplified error boundary for inline use
 */
export function SimpleErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
          Failed to render content
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
