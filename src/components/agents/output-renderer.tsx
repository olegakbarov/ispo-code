/**
 * Output rendering components for agent sessions
 * Handles text, tool calls, tool results, thinking, errors, and system messages
 */

import { StreamingMarkdown } from '@/components/ui/streaming-markdown'
import { SimpleErrorBoundary } from '@/components/ui/error-boundary'
import { ToolCall } from '@/components/agents/tool-call'
import { ToolResult } from '@/components/agents/tool-result'
import type { AgentOutputChunk } from '@/lib/agent/types'

/**
 * Groups consecutive text chunks and renders them together
 */
export function OutputRenderer({ chunks }: { chunks: AgentOutputChunk[] }) {
  const groups: { type: string; chunks: AgentOutputChunk[] }[] = []

  for (const chunk of chunks) {
    const lastGroup = groups[groups.length - 1]
    if (chunk.type === 'text' && lastGroup?.type === 'text') {
      lastGroup.chunks.push(chunk)
    } else {
      groups.push({ type: chunk.type, chunks: [chunk] })
    }
  }

  return (
    <>
      {groups.map((group, i) => {
        if (group.type === 'text') {
          const combinedText = group.chunks.map(c => c.content).join('')
          return (
            <div key={i} className="py-0.5">
              <SimpleErrorBoundary>
                <StreamingMarkdown content={combinedText} className="text-xs" />
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
}

/** Renders a single output chunk based on type */
export function OutputChunk({ chunk }: { chunk: AgentOutputChunk }) {
  const { type, content, metadata } = chunk

  if (type === 'tool_use') {
    let parsed: { name?: string; input?: unknown; args?: unknown } = {}
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { name: 'unknown', input: content }
    }

    const toolName = parsed.name || (metadata?.tool as string | undefined) || 'unknown'
    const toolInput = parsed.input ?? parsed.args

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
        <div className="text-xs text-muted-foreground italic">{content}</div>
      </div>
    )
  }

  if (type === 'error') {
    return (
      <div className="border-l-2 border-destructive pl-2 py-0.5">
        <div className="font-vcr text-[10px] text-destructive mb-0.5">ERROR</div>
        <div className="text-xs text-destructive">{content}</div>
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
    return (
      <div className="border-l-2 border-primary pl-2 py-1.5 my-2">
        <div className="font-vcr text-[10px] text-primary mb-0.5">USER</div>
        <div className="text-xs text-foreground whitespace-pre-wrap">{content}</div>
      </div>
    )
  }

  return null
}
