/**
 * Output rendering components for agent sessions
 * Handles text, tool calls, tool results, thinking, errors, and system messages
 */

import { memo, useMemo } from 'react'
import { StreamingMarkdown } from '@/components/ui/streaming-markdown'
import { SimpleErrorBoundary } from '@/components/ui/error-boundary'
import { ToolCall } from '@/components/agents/tool-call'
import { ToolResult } from '@/components/agents/tool-result'
import { AskUserQuestionDisplay } from '@/components/agents/ask-user-question-display'
import { ImageAttachmentPreview } from '@/components/agents/image-attachment-input'
import { isImageAttachments } from '@/lib/utils/type-guards'
import type { AgentOutputChunk } from '@/lib/agent/types'

/**
 * Groups consecutive text chunks and renders them together
 * Memoized to avoid rebuilding groups when parent re-renders with unchanged chunks
 */
export const OutputRenderer = memo(function OutputRenderer({ chunks }: { chunks: AgentOutputChunk[] }) {
  // Memoize groups to avoid rebuilding on every render
  const groups = useMemo(() => {
    const result: { type: string; chunks: AgentOutputChunk[] }[] = []
    for (const chunk of chunks) {
      const lastGroup = result[result.length - 1]
      if (chunk.type === 'text' && lastGroup?.type === 'text') {
        lastGroup.chunks.push(chunk)
      } else {
        result.push({ type: chunk.type, chunks: [chunk] })
      }
    }
    return result
  }, [chunks])

  return (
    <>
      {groups.map((group, i) => {
        if (group.type === 'text') {
          const combinedText = group.chunks.map(c => c.content).join('')
          return (
            <div key={i} className="py-0.5">
              <SimpleErrorBoundary>
                <StreamingMarkdown content={combinedText} className="text-sm" />
              </SimpleErrorBoundary>
            </div>
          )
        }
        return group.chunks.map((chunk, j) => (
          <OutputChunk key={`${i}-${j}`} chunk={chunk} />
        ))
      })}
    </>
  )
})

/** Renders a single output chunk based on type */
export const OutputChunk = memo(function OutputChunk({ chunk }: { chunk: AgentOutputChunk }) {
  const { type, content, metadata } = chunk

  // Memoize parsed tool payload to avoid repeated JSON.parse on re-renders
  const parsedToolPayload = useMemo((): { name?: string; input?: unknown; args?: unknown } | null => {
    if (type !== 'tool_use') return null
    try {
      return JSON.parse(content) as { name?: string; input?: unknown; args?: unknown }
    } catch {
      return { name: 'unknown', input: content, args: undefined }
    }
  }, [type, content])

  if (type === 'tool_use' && parsedToolPayload) {
    const toolName = parsedToolPayload.name || (metadata?.toolName as string | undefined) || (metadata?.tool as string | undefined) || 'unknown'
    const toolInput = parsedToolPayload.input ?? parsedToolPayload.args

    // Special rendering for AskUserQuestion tool
    if (toolName === 'AskUserQuestion') {
      return <AskUserQuestionDisplay toolInput={toolInput} />
    }

    return <ToolCall toolName={toolName} toolInput={toolInput} metadata={metadata} />
  }

  if (type === 'tool_result') {
    // Determine success from metadata or content
    const success = metadata?.success !== false && !content.startsWith('error:')
    const toolName = metadata?.tool as string | undefined

    return <ToolResult content={content} success={success} toolName={toolName} />
  }

  if (type === 'thinking') {
    return (
      <div className="border-l-2 border-muted-foreground pl-2 py-0.5">
        <div className="font-vcr text-[10px] text-muted-foreground mb-0.5">THINKING</div>
        <div className="text-sm text-muted-foreground italic">{content}</div>
      </div>
    )
  }

  if (type === 'error') {
    return (
      <div className="border-l-2 border-destructive pl-2 py-0.5">
        <div className="font-vcr text-[10px] text-destructive mb-0.5">ERROR</div>
        <div className="text-sm text-destructive">{content}</div>
      </div>
    )
  }

  if (type === 'system') {
    return (
      <div className="text-[10px] text-muted-foreground italic py-0.5">
        {content}
      </div>
    )
  }

  if (type === 'user_message') {
    const imageAttachments = isImageAttachments(chunk.attachments) ? chunk.attachments : undefined
    return (
      <div className="border-l-2 border-primary pl-2 py-1.5 my-2">
        <div className="font-vcr text-[10px] text-primary mb-0.5">USER</div>
        <div className="text-sm text-foreground whitespace-pre-wrap">{content}</div>
        {imageAttachments && imageAttachments.length > 0 && (
          <ImageAttachmentPreview attachments={imageAttachments} />
        )}
      </div>
    )
  }

  return null
})
