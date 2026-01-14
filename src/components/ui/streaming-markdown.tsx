/**
 * StreamingMarkdown - Renders streaming markdown content from AI agents
 *
 * Uses streamdown for smooth rendering of incomplete/streaming markdown
 */

import { Streamdown } from 'streamdown'

interface StreamingMarkdownProps {
  /**
   * The markdown content to render
   */
  content: string
  /**
   * Optional className for styling
   */
  className?: string
}

/**
 * Renders markdown content with support for streaming/incomplete syntax
 */
export function StreamingMarkdown({ content, className = '' }: StreamingMarkdownProps) {
  return (
    <div className={`max-w-none ${className}`}>
      <Streamdown mode="streaming" parseIncompleteMarkdown cdnUrl={null}>
        {content}
      </Streamdown>
    </div>
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
