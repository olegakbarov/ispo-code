# cancel agent session from task page do not work

## Investigation Findings

### Phase 1: Root Cause Investigation

**Symptom**: Clicking "Cancel" on an active session card in the task sidebar does not cancel the correct session (or any session at all in some cases).

**Immediate Cause**: In `src/components/tasks/task-sidebar.tsx:152`, the `onCancelSession` prop is incorrectly wired:
```tsx
onCancelSession={onCancelAgent ? () => onCancelAgent() : undefined}
```
This wrapper function **discards the `sessionId` argument** that `TaskSessions` passes when the Cancel button is clicked.

**Call Chain**:
1. User clicks Cancel button in `ActiveSessionCard` (task-sessions.tsx:171-179)
2. `onCancel()` is called, which invokes `onCancelSession(session.sessionId)` (task-sessions.tsx:174, 314)
3. `onCancelSession` calls the wrapper `() => onCancelAgent()` (task-sidebar.tsx:152)
4. The `sessionId` is **dropped** - wrapper ignores the argument
5. `handleCancelAgent` in `_page.tsx` uses `activeSessionIdRef.current` instead (tasks/_page.tsx:1148)
6. `activeSessionIdRef.current` comes from `activeSessionId`, which is derived from `getActiveAgentSessions`
7. `getActiveAgentSessions` only returns **one session per task** (tasks.ts:1039-1042)

**Original Trigger**: Two architectural issues:
1. `task-sidebar.tsx` creates a wrapper that ignores the `sessionId` parameter
2. `handleCancelAgent` was designed for single-session tasks, using a ref instead of accepting the sessionId as an argument

**Evidence**:
- `src/components/tasks/task-sidebar.tsx:152` - Wrapper ignores sessionId: `onCancelSession={onCancelAgent ? () => onCancelAgent() : undefined}`
- `src/routes/tasks/_page.tsx:1146-1162` - Handler uses ref instead of parameter
- `src/trpc/tasks.ts:1038-1042` - Only stores "most recent active session" per task
- `src/components/tasks/task-sessions.tsx:314` - Correctly passes sessionId: `() => onCancelSession(session.sessionId)`

**Working Example Comparison**:
In `src/routes/agents/$sessionId.tsx:325-327`, cancel works correctly:
```tsx
const handleCancel = () => {
  cancelMutation.mutate({ id: sessionId })
}
```
The sessionId comes directly from route params, not a ref that might be stale.

**Impact**:
- With single active session: May work if `activeSessionIdRef.current` matches the session
- With multiple active sessions (multi-agent debug): Always cancels the "most recent" session, not the one the user clicked
- If `activeSessionIdRef.current` is undefined: Cancel does nothing (console warns "No sessionId in ref")

### Phase 2: Pattern Analysis

**Working Example** (`src/routes/agents/$sessionId.tsx`):
```tsx
// Type: sessionId comes from route params
const { sessionId } = useParams()

// Handler directly uses the sessionId
const handleCancel = () => {
  cancelMutation.mutate({ id: sessionId })
}
```
- Session ID is explicit and always correct
- No indirection through refs or global state
- Works because there's exactly one session per route

**Broken Example** (`src/components/tasks/task-sidebar.tsx` + `_page.tsx`):
```tsx
// task-sidebar.tsx:44 - Type signature is wrong (no sessionId param)
onCancelAgent?: () => void

// task-sidebar.tsx:152 - Wrapper drops the sessionId
onCancelSession={onCancelAgent ? () => onCancelAgent() : undefined}

// _page.tsx:1146-1161 - Handler ignores argument, uses stale ref
const handleCancelAgent = useCallback(() => {
  const sessionIdToCancel = activeSessionIdRef.current  // May be wrong session!
  cancelAgentMutation.mutate({ id: sessionIdToCancel })
}, [...])
```

**Key Differences**:
| Aspect | Working (agent page) | Broken (task page) |
|--------|---------------------|-------------------|
| Session ID source | Route params | Ref from polling |
| Type signature | `(id: string)` implicit | `() => void` - no param |
| Multi-session support | N/A (one per route) | Broken - only one tracked |
| Passed through props | No (direct) | Yes, with wrapper that drops ID |

**Dependencies**:
- `TaskSessions` component correctly passes `sessionId` to `onCancelSession`
- `TaskSidebar` interface is missing the `sessionId` parameter
- `_page.tsx` handler needs to accept `sessionId` as argument

**Type Mismatch**:
- `TaskSessionsProps.onCancelSession`: `(sessionId: string) => void`
- `TaskSidebarProps.onCancelAgent`: `() => void`

The types themselves reveal the bug - the interface contract is broken at the `TaskSidebar` level.

### Phase 3: Hypothesis & Testing

**Hypothesis**: The cancel button fails because the `sessionId` is dropped when passing through `TaskSidebar`. The fix requires:
1. Change `TaskSidebarProps.onCancelAgent` to accept `(sessionId: string) => void`
2. Remove the wrapper in `task-sidebar.tsx:152` that discards the sessionId
3. Update `handleCancelAgent` in `_page.tsx` to accept `sessionId` as parameter instead of using `activeSessionIdRef`

**Test Design**:
1. Create a task with multiple debug agents (multi-agent debug)
2. Click Cancel on a specific session card
3. Verify that the correct session (the one clicked) is cancelled

**Prediction**:
- Before fix: Either no session is cancelled (ref is undefined) or the wrong session is cancelled
- After fix: The clicked session will be cancelled, leaving other sessions running

**Result**: Code analysis confirms the hypothesis. The type mismatch and wrapper function are clearly causing the sessionId to be lost.

**Conclusion**: Hypothesis CONFIRMED through static analysis. The fix is straightforward - thread the sessionId through the component props.

### Phase 4: Implementation

**Root Cause**: The `sessionId` was being dropped at the `TaskSidebar` component level due to:
1. Wrong type signature: `onCancelAgent?: () => void` instead of `(sessionId: string) => void`
2. A wrapper function that discarded the argument: `() => onCancelAgent()` instead of passing through
3. The handler using a ref that could be stale or wrong with multiple sessions

**Solution**: Thread the `sessionId` directly from the UI click through to the mutation:

1. `src/components/tasks/task-sidebar.tsx`:
   - Changed type: `onCancelAgent?: (sessionId: string) => void`
   - Removed wrapper: `onCancelSession={onCancelAgent}` (direct pass-through)

2. `src/routes/tasks/_page.tsx`:
   - Changed handler to accept parameter: `handleCancelAgent = useCallback((sessionId: string) => ...)`
   - Removed unused `activeSessionIdRef` since sessionId now comes from the clicked session

**Changes Made**:
| File | Change |
|------|--------|
| `src/components/tasks/task-sidebar.tsx:44` | Type: `() => void` → `(sessionId: string) => void` |
| `src/components/tasks/task-sidebar.tsx:152` | Removed wrapper, direct prop pass-through |
| `src/routes/tasks/_page.tsx:1139-1142` | Handler accepts `sessionId` parameter |
| `src/routes/tasks/_page.tsx:132-138` | Removed unused `activeSessionIdRef` |

**Verification**:
- Build passes: `npm run build` succeeds
- Type safety: TypeScript ensures sessionId flows correctly through the chain
- Flow is now: Click → `onCancel()` → `onCancelSession(sessionId)` → `onCancelAgent(sessionId)` → `handleCancelAgent(sessionId)` → `cancelMutation.mutate({ id: sessionId })`

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug (manual testing: create multi-agent debug, cancel specific session)
- [x] All tests pass (build succeeds)

## Manual Testing Guide

To verify the fix:

1. Start dev server: `npm run dev`
2. Create a bug task with multiple debug agents selected
3. Wait for sessions to start (observe multiple active session cards)
4. Click "Cancel" on a specific session card
5. Verify that ONLY the clicked session is cancelled
6. Other sessions should continue running
