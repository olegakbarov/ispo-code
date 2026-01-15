# Improve Session Load Error UX

**Priority**: Low
**Category**: User Experience
**Status**: Completed

## Problem

`src/routes/agents/$sessionId.tsx` (lines 51-66) retries 10 times then shows nothing:

```tsx
useEffect(() => {
  if (session || isLoading) {
    setRetryCount(0)
    return
  }

  if (retryCount < maxRetries) {
    const timer = setTimeout(() => {
      setRetryCount(c => c + 1)
      utils.agent.get.invalidate({ id: sessionId })
    }, 1000)
    return () => clearTimeout(timer)
  }
  // After maxRetries: shows blank page
}, [session, isLoading, retryCount, sessionId, utils])
```

## Fix

- [x] Add error state after max retries with retry button and dashboard link

## Implementation Notes

The codebase already had basic error handling after max retries (lines 265-277), showing "Session not found" with a "New Agent" link. Enhanced this with:

1. Updated error message: "Session not found or failed to load"
2. Added **Retry button** that resets `retryCount` to 0, triggering fresh retry attempts
3. Changed link text to "Return to dashboard" for clarity
4. Improved styling: primary button for retry, text link for dashboard

The implementation differs slightly from the task plan because:
- No separate `loadError` state needed - the existing `retryCount >= maxRetries && !session` condition already handles this
- Simpler solution: just reset `retryCount` to 0 to retry, instead of managing separate error state

## Files

- `src/routes/agents/$sessionId.tsx` (lines 265-280)
