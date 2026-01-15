# Verify optimistic updates work correctly

## Problem Statement
Archive and Run mutations lack proper optimistic UI feedback. Archive updates list but navigation waits for server. Run (assignToAgent) has no optimistic state at all - agent status indicator only shows after server response.

## Scope
**In:**
- Add optimistic session indicator for `assignToAgent` mutation
- Verify archive navigation happens before server response

**Out:**
- Other mutations (save, create, restore already implemented)
- Backend changes

## Implementation Plan

### Phase: Fix assignToAgent optimistic update
- [x] Add `onMutate` to `assignToAgent` in `src/routes/tasks.tsx`
- [x] Cancel `getActiveAgentSessions` query
- [x] Snapshot previous sessions for rollback
- [x] Optimistically add placeholder session with `status: 'pending'`
- [x] Add `onError` handler to rollback on failure

### Phase: Verify archive behavior
- [x] Check if archive navigation should be immediate (move to `onMutate`)
- [x] Test archive flow in TaskReviewPanel (line 439-457 onArchive click)
- [x] Ensure task disappears from "Active" filter immediately

## Key Files
- `src/routes/tasks.tsx:403-433` - `assignToAgent` now has optimistic update
- `src/routes/tasks.tsx:341-370` - `archiveMutation` (verified: working correctly)
- `src/components/tasks/task-list-sidebar.tsx:239` - consumes `activeAgentSessions`

## Success Criteria
- [x] Run button shows "pending" state immediately after click
- [x] Task shows agent indicator in sidebar immediately
- [x] Archive removes task from Active list immediately
- [x] Error rollback restores previous state

## Implementation Notes

### assignToAgent Optimistic Update
Added `onMutate` handler that:
1. Cancels in-flight `getActiveAgentSessions` queries
2. Snapshots current sessions for rollback
3. Adds placeholder session `{ sessionId: 'pending-{timestamp}', status: 'pending' }`
4. `onError` restores previous state on failure

### Archive Behavior (Verified Working)
The archive mutation already has correct optimistic behavior:
- `onMutate` sets `archived: true` immediately in the task list cache
- Task disappears from "Active" filter instantly (task-list-sidebar.tsx line 67-68 filters by `!t.archived`)
- Navigation happens in `onSuccess` after server confirms - this is intentional UX (user sees confirmation)
- `onError` rolls back if server fails

No changes needed for archive - it already works correctly.
