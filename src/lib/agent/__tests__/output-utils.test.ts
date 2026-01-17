import { describe, it, expect } from 'vitest'
import { mergeOutputWithPending, filterPendingUserMessages, CLIENT_MESSAGE_ID_METADATA_KEY } from '../output-utils'
import type { AgentOutputChunk } from '../types'

const baseOutput: AgentOutputChunk[] = [
  {
    type: 'text',
    content: 'hello',
    timestamp: '2026-01-01T00:00:00.000Z',
  },
]

describe('mergeOutputWithPending', () => {
  it('appends pending user messages when not yet in output', () => {
    const pending = [
      {
        id: 'msg-1',
        content: 'follow-up',
        timestamp: '2026-01-01T00:00:01.000Z',
      },
    ]

    const merged = mergeOutputWithPending(baseOutput, pending)

    expect(merged).toHaveLength(2)
    expect(merged[1].type).toBe('user_message')
    expect(merged[1].metadata?.[CLIENT_MESSAGE_ID_METADATA_KEY]).toBe('msg-1')
  })

  it('skips pending messages that already exist in output', () => {
    const output: AgentOutputChunk[] = [
      ...baseOutput,
      {
        type: 'user_message',
        content: 'follow-up',
        timestamp: '2026-01-01T00:00:01.000Z',
        metadata: { [CLIENT_MESSAGE_ID_METADATA_KEY]: 'msg-1' },
      },
    ]
    const pending = [
      {
        id: 'msg-1',
        content: 'follow-up',
        timestamp: '2026-01-01T00:00:01.000Z',
      },
      {
        id: 'msg-2',
        content: 'second',
        timestamp: '2026-01-01T00:00:02.000Z',
      },
    ]

    const filtered = filterPendingUserMessages(output, pending)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('msg-2')

    const merged = mergeOutputWithPending(output, pending)
    expect(merged).toHaveLength(3)
    expect(merged[2].metadata?.[CLIENT_MESSAGE_ID_METADATA_KEY]).toBe('msg-2')
  })
})
