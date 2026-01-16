/**
 * Regression test: planning output should stop once live session completes.
 */

import { describe, it, expect } from 'vitest'
import { isPlanningSessionActive } from '@/lib/hooks/use-agent-session-tracking'

describe('isPlanningSessionActive', () => {
  it('returns false when planning session completes', () => {
    expect(isPlanningSessionActive('session-1', 'completed', 'session-1')).toBe(false)
  })

  it('returns true when planning session is active', () => {
    expect(isPlanningSessionActive('session-1', 'running', 'session-1')).toBe(true)
  })

  it('returns false when no planning session exists', () => {
    expect(isPlanningSessionActive(undefined, 'running', 'session-1')).toBe(false)
  })

  it('defaults to true when live status is missing but planning id exists', () => {
    expect(isPlanningSessionActive('session-1', undefined, 'session-1')).toBe(true)
  })

  it('returns false when live status is missing and active session does not match', () => {
    expect(isPlanningSessionActive('session-1', undefined, 'session-2')).toBe(false)
  })
})
