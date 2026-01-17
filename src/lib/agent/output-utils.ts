import type { AgentOutputChunk, SerializedImageAttachment } from "./types"

export const CLIENT_MESSAGE_ID_METADATA_KEY = "clientMessageId"

export interface PendingUserMessage {
  id: string
  content: string
  timestamp: string
  attachments?: SerializedImageAttachment[]
}

function getClientMessageId(chunk: AgentOutputChunk): string | null {
  const value = chunk.metadata?.[CLIENT_MESSAGE_ID_METADATA_KEY]
  if (typeof value !== "string" || value.length === 0) return null
  return value
}

export function extractClientMessageIds(output: AgentOutputChunk[]): Set<string> {
  const ids = new Set<string>()
  for (const chunk of output) {
    if (chunk.type !== "user_message") continue
    const id = getClientMessageId(chunk)
    if (id) ids.add(id)
  }
  return ids
}

export function filterPendingUserMessages(
  output: AgentOutputChunk[],
  pending: PendingUserMessage[]
): PendingUserMessage[] {
  if (pending.length === 0) return pending
  const delivered = extractClientMessageIds(output)
  if (delivered.size === 0) return pending
  return pending.filter((message) => !delivered.has(message.id))
}

export function mergeOutputWithPending(
  output: AgentOutputChunk[],
  pending: PendingUserMessage[]
): AgentOutputChunk[] {
  if (pending.length === 0) return output

  const delivered = extractClientMessageIds(output)
  const pendingChunks = pending
    .filter((message) => !delivered.has(message.id))
    .map((message) => ({
      type: "user_message" as const,
      content: message.content,
      timestamp: message.timestamp,
      attachments: message.attachments,
      metadata: {
        [CLIENT_MESSAGE_ID_METADATA_KEY]: message.id,
        optimistic: true,
      },
    }))

  if (pendingChunks.length === 0) return output
  return [...output, ...pendingChunks]
}
