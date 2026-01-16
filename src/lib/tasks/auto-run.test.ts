import { describe, it, expect } from 'vitest'
import { inferAutoRunPhase } from './auto-run'

describe('inferAutoRunPhase', () => {
  it('identifies planning sessions from plan/debug titles', () => {
    expect(inferAutoRunPhase('Plan: Build thing', 'prompt')).toBe('planning')
    expect(inferAutoRunPhase('Debug: Fix bug', 'prompt')).toBe('planning')
  })

  it('identifies execution sessions from Run titles', () => {
    expect(inferAutoRunPhase('Run: Add dark mode toggle', 'prompt')).toBe('execution')
  })

  it('treats debug run titles with indices as planning sessions', () => {
    expect(inferAutoRunPhase('Debug (2): Investigate issue', 'Implementation Steps')).toBe('planning')
  })

  it('does not classify non-run titles as execution based on prompt text', () => {
    expect(inferAutoRunPhase('Verify: Sample task', 'Not implemented')).toBe(null)
  })
})
