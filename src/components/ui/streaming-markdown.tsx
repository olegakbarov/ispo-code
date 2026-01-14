/**
 * StreamingMarkdown - Renders streaming markdown content from AI agents
 *
 * Uses streamdown for smooth rendering of incomplete/streaming markdown
 * with XSS protection via content sanitization and error boundaries
 */

import { Streamdown } from 'streamdown'
import { sanitizeMarkdown } from '../../lib/utils/sanitize'
import { useMemo } from 'react'
import { SimpleErrorBoundary } from './error-boundary'

interface StreamingMarkdownProps {
  /**
   * The markdown content to render
   */
  content: string
  /**
   * Optional className for styling
   */
  className?: string
  /**
   * Skip sanitization (use only for trusted content)
   */
  skipSanitization?: boolean
  /**
   * Skip error boundary (use only if wrapped in another error boundary)
   */
  skipErrorBoundary?: boolean
}

/**
 * Internal component that renders markdown (without error boundary)
 */
function StreamingMarkdownInner({
  content,
  className = '',
  skipSanitization = false
}: Omit<StreamingMarkdownProps, 'skipErrorBoundary'>) {
  // Memoize sanitization to avoid re-processing on every render
  const sanitizedContent = useMemo(() => {
    if (skipSanitization) return content
    return sanitizeMarkdown(content)
  }, [content, skipSanitization])

  return (
    <div className={`max-w-none ${className}`}>
      <Streamdown mode="streaming" parseIncompleteMarkdown cdnUrl={null}>
        {sanitizedContent}
      </Streamdown>
    </div>
  )
}

/**
 * Renders markdown content with support for streaming/incomplete syntax
 *
 * Features:
 * - Sanitized by default to prevent XSS attacks
 * - Wrapped in error boundary to prevent crashes
 * - Memoized for performance
 * - Supports incomplete/streaming markdown syntax
 */
export function StreamingMarkdown({
  skipErrorBoundary = false,
  ...props
}: StreamingMarkdownProps) {
  if (skipErrorBoundary) {
    return <StreamingMarkdownInner {...props} />
  }

  return (
    <SimpleErrorBoundary>
      <StreamingMarkdownInner {...props} />
    </SimpleErrorBoundary>
  )
}

/**
 * Wrapper for code blocks with syntax highlighting
 */
export function CodeBlock({
  code,
  language,
  className = '',
}: {
  code: string
  language?: string
  className?: string
}) {
  const langClass = language ? `language-${language}` : ''

  return (
    <pre className={`bg-panel border border-border rounded p-3 overflow-x-auto ${className}`}>
      <code className={`text-sm text-text-primary ${langClass}`}>{code}</code>
    </pre>
  )
}
