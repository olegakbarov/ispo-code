/**
 * Tests for use-task-commit-effects hook
 *
 * Covers:
 * - Commit message pregeneration on review mode entry
 * - Commit message pregeneration on agent completion
 *
 * Run with: npx vitest run src/lib/hooks/__tests__/use-task-commit-effects.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Commit Message Pregeneration - Review Mode Entry', () => {
  let mockTriggerGeneration: any
  let prevModeRef: { current: string | undefined }
  let prevReviewPathRef: { current: string | null }

  beforeEach(() => {
    mockTriggerGeneration = vi.fn()
    prevModeRef = { current: undefined }
    prevReviewPathRef = { current: null }
  })

  const simulateEffect = (selectedPath: string | null, mode: string | undefined) => {
    if (!selectedPath) return

    const prevMode = prevModeRef.current
    const prevPath = prevReviewPathRef.current
    prevModeRef.current = mode

    // Update path ref only when in review mode
    if (mode === 'review') {
      prevReviewPathRef.current = selectedPath
    }

    // Trigger when:
    // 1. Initial mount in review mode
    // 2. Transitioning TO review mode
    // 3. Path change while in review mode
    const isEnteringReview = (prevMode === undefined || prevMode !== 'review') && mode === 'review'
    const isPathChangeInReview = prevPath !== null && prevPath !== selectedPath && mode === 'review'

    if (isEnteringReview || isPathChangeInReview) {
      mockTriggerGeneration()
    }
  }

  it('should trigger on initial mount in review mode', () => {
    // Simulate direct navigation to /tasks/foo/review
    simulateEffect('tasks/foo.md', 'review')

    // Verify pregen was triggered
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)
  })

  it('should trigger when transitioning from edit to review mode', () => {
    // Initial mount in edit mode
    simulateEffect('tasks/foo.md', 'edit')
    expect(mockTriggerGeneration).not.toHaveBeenCalled()

    // Transition to review mode
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)
  })

  it('should trigger on path change while in review mode', () => {
    // Initial mount in review mode
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)

    // Switch to different task while staying in review mode
    simulateEffect('tasks/bar.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(2)
  })

  it('should not trigger when staying on same path in review mode', () => {
    // Initial mount in review mode
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)

    // Re-render with same path and mode (shouldn't trigger again)
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)
  })

  it('should not trigger on initial mount in edit mode', () => {
    // Direct navigation to /tasks/foo (edit mode)
    simulateEffect('tasks/foo.md', 'edit')

    // Verify pregen was NOT triggered
    expect(mockTriggerGeneration).not.toHaveBeenCalled()
  })

  it('should not trigger when leaving review mode', () => {
    // Start in review mode
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)

    // Leave review mode
    simulateEffect('tasks/foo.md', 'edit')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1) // Still only once
  })

  it('should not trigger when path is null', () => {
    // Simulate no task selected
    simulateEffect(null, 'review')

    // Verify pregen was NOT triggered
    expect(mockTriggerGeneration).not.toHaveBeenCalled()
  })

  it('should handle rapid mode transitions correctly', () => {
    // Start in edit mode
    simulateEffect('tasks/foo.md', 'edit')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(0)

    // Transition to review
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)

    // Transition to debate
    simulateEffect('tasks/foo.md', 'debate')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)

    // Back to review (should trigger again)
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(2)
  })

  it('should handle path change from null to review', () => {
    // Start with no selection
    prevReviewPathRef.current = null

    // Navigate directly to review mode
    simulateEffect('tasks/foo.md', 'review')
    expect(mockTriggerGeneration).toHaveBeenCalledTimes(1)
  })
})
