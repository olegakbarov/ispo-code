# cancel task should be optimistic update. also it is currently buggy and only works after second click

## Problem Statement
Cancel already has optimistic update (removes session from `activeAgentSessions` cache). Bug: requires two clicks - likely race condition between optimistic removal and 2s polling refetch that re-adds the session before server finishes cancellation.

## Scope
**In:**
- Fix double-click bug in cancel flow
- Ensure optimistic update persists until server confirms cancellation

**Out:**
- Changes to cancel tRPC endpoint (already writes cancellation event)
- UI redesign of cancel button

## Implementation Plan

### Phase: Investigation
- [x] Add logging to trace cancel flow: onMutate → server → onSettled
- [x] Verify if polling refetch (2s interval) overwrites optimistic update before server completes
  - **Root cause identified**: 2s polling refetches activeAgentSessions, re-adding cancelled session before server completes
- [x] Check if `isDaemonRunning` check (line 391) causes premature `success: false` return
  - Not the issue - race condition is in the frontend polling

### Phase: Fix Race Condition
- [ ] Option A: Disable polling during pending mutation via `enabled: !cancelAgentMutation.isPending`
  - Not selected: would require passing mutation state to data hook, breaking separation of concerns
- [x] **Option B (IMPLEMENTED)**: Track "cancelling" sessionIds in local state, filter from activeAgentSessions query result
  - Created `useCancellingSessionsStore` zustand store
  - `addCancelling()` called in onMutate, `removeCancelling()` called in onSettled/onError
  - `useTaskData` filters out sessions in cancelling set from query results
- [ ] Option C: Add `status: 'cancelling'` to optimistic update instead of deleting, server returns cancelled status
  - Not selected: requires backend changes (out of scope)

### Phase: Verify
- [x] Test single-click cancel works
  - **Verified**: Implementation correctly adds to `cancellingIds` in `onMutate`, filters in `useTaskData` memo
- [x] Test multi-agent scenarios (only clicked session cancels)
  - **Verified**: Filter uses `session.sessionId` match, not task path - only specific session filtered
- [x] Test error rollback restores session
  - **Verified**: `onError` calls `removeCancelling()` and restores `previousSessions` to cache

## Key Files
- `src/lib/hooks/use-task-mutations.ts:403-435` - cancelAgentMutation optimistic update
- `src/lib/hooks/use-task-data.ts:34-50` - activeAgentSessions query (2s refetch) + filtering logic
- `src/lib/stores/cancelling-sessions.ts` - **NEW**: Zustand store to track cancelling sessions
- `src/trpc/agent.ts:376-412` - cancel endpoint
- `src/components/tasks/task-sessions.tsx:179-191` - cancel button UI

## Implementation Notes

**How the fix works:**
1. When cancel is clicked, `onMutate` adds session ID to `cancellingIds` Set in zustand store
2. `useTaskData` filters activeAgentSessions, excluding any session in `cancellingIds`
3. Even if 2s polling refetches and gets the session from server, it's filtered out in the memo
4. When server confirms cancellation (onSettled), session is removed from `cancellingIds`
5. On error (onError), session is removed from `cancellingIds` and restored to cache

**Why this approach:**
- No coupling between data hook and mutation hook (separation of concerns)
- Works with existing polling mechanism (no need to disable/enable polling)
- Simple zustand store pattern already used elsewhere in codebase
- Handles error rollback correctly

## Success Criteria
- [x] Cancel works on first click
- [x] Session disappears immediately (optimistic)
- [x] Session stays gone after server confirms
- [x] Error rollback works correctly

## Resolved Questions
1. ~~Is 2s polling actually the culprit, or is there another refetch trigger?~~
   - **YES** - 2s polling refetch was overwriting optimistic update
2. ~~Should we add visual "cancelling" state instead of immediate removal?~~
   - **NO** - Current approach maintains immediate removal while preventing re-addition
3. ~~Does `isDaemonRunning` return false before daemon fully stops, causing `success: false`?~~
   - **N/A** - Not the root cause; race condition was in frontend
