# Use Functional Updates for Message Queue

**Priority**: Low
**Category**: Reliability
**Status**: ✅ Complete

## Problem

`src/routes/agents/$sessionId.tsx` appends to `messageQueue` with `setMessageQueue([...messageQueue, trimmedMessage])` (lines 306 and 314). When multiple updates are queued close together, this can drop entries due to stale closures.

## Impact

- Lost queued messages under rapid input
- Makes state updates less resilient to batching

## Fix

Use functional state updates when appending or dequeuing:

```tsx
setMessageQueue((prev) => [...prev, trimmedMessage])
```

Also consider functional updates when removing from the queue.

## Files

- `src/routes/agents/$sessionId.tsx`

## Implementation Notes

- [x] Fixed `handleSendMessage` (line 306) to use functional update
  - ✓ Verified: `src/routes/agents/$sessionId.tsx:306` uses `setMessageQueue((prev) => [...prev, trimmedMessage])`
- [x] Fixed `handleEnqueueMessage` (line 314) to use functional update
  - ✓ Verified: `src/routes/agents/$sessionId.tsx:314` uses `setMessageQueue((prev) => [...prev, trimmedMessage])`
- [x] Verified `sendMessageMutation.onSuccess` (line 252) already uses functional update for dequeue
  - ✓ Verified: `src/routes/agents/$sessionId.tsx:252` uses `setMessageQueue((prevQueue) => prevQueue.length > 0 ? prevQueue.slice(1) : prevQueue)`

## Verification Results

**Status**: All items verified ✓

**Summary**:
- Confirmed functional updates in `src/routes/agents/$sessionId.tsx:252`, `src/routes/agents/$sessionId.tsx:306`, `src/routes/agents/$sessionId.tsx:314`
- Tests not run (not specified in task)

**Verified by**: Codex (GPT-5)  
**Verification date**: 2026-01-15