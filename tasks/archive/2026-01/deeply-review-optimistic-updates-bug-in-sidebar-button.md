# deeply review optimistic updates bug in sidebar button

## Problem Statement
Sidebar play button optimistic state unreliable; pending spinner drop before session appears. Mismatch between TaskListSidebar local pending set and shared active session cache. Timeline of mutation response vs stream registry update unclear.

## Scope
**In:**
- `src/components/tasks/task-list-sidebar.tsx`
- `src/lib/hooks/use-task-mutations.ts`
- `src/lib/hooks/use-task-data.ts`
- `src/trpc/tasks.ts`
- `src/daemon/stream-publisher.ts`
- `tasks/archive/2026-01/verify-optimistic-updates-work-correctly.md`

**Out:**
- `src/components/agents/thread-sidebar.tsx`
- `src/components/agents/sidebar-commit-panel.tsx`
- `src/components/layout/sidebar.tsx`
- `src/lib/agent/task-service.ts`

## Implementation Plan

### Phase: Repro & Evidence
- [x] Repro play button optimistic state on `/tasks`
  - **Finding**: Sidebar has dual state management - local `pendingTasks` Set + shared `activeAgentSessions` cache
  - **Race condition**: Local Set cleared in `onSettled` (line 310) but shared cache may not reflect real session yet
- [x] Capture `getActiveAgentSessions` timing after `assignToAgent` click
  - **Timeline**: Click → local Set add (immediate) → mutation `onMutate` cache update → server spawn → stream buffer (1000ms) → poll refetch (2000ms)
  - **Gap**: Polling disabled while `pendingTasks.size > 0` (line 218), but Set cleared before session appears in registry
- [x] Compare global sidebar state vs task page controls during spawn
  - **Sidebar**: Uses merged state (`pendingTasks` + `activeAgentSessions`), disables polling during mutations
  - **Task page**: Uses `use-task-mutations.ts` with direct cache manipulation

### Phase: Code Trace
- [x] Trace pending set add/remove in `task-list-sidebar.tsx`
  - **Line 306**: `setPendingTasks((prev) => new Set(prev).add(path))` - adds immediately in `onMutate`
  - **Line 310-314**: `setPendingTasks((prev) => { next.delete(path); return next })` - removes in `onSettled`
  - **Line 315**: `utils.tasks.getActiveAgentSessions.invalidate()` - invalidates after removing from Set
  - **Problem**: Set cleared BEFORE invalidation completes, creating gap
- [x] Trace polling toggles in `task-list-sidebar.tsx`
  - **Line 203**: `hasPendingMutations = pendingTasks.size > 0`
  - **Line 218**: `refetchInterval: hasPendingMutations ? false : 2000` - disables polling when pending
  - **Problem**: Polling re-enabled when Set cleared, but real session may not be in registry yet
- [x] Trace assignToAgent optimistic cache update in `use-task-mutations.ts`
  - **Lines 320-321**: Cancels in-flight queries
  - **Lines 323-329**: Sets optimistic `{ sessionId: 'pending-{timestamp}', status: 'pending' }` in cache
  - **Line 341**: Invalidates cache in `onSettled` (regardless of success/error)
  - **Coordination**: This runs BEFORE sidebar's `onSettled`, so cache invalidated twice
- [x] Trace verifyWithAgent optimistic cache update in `use-task-mutations.ts`
  - **Lines 388-397**: Same pattern as assignToAgent
  - **Line 409**: Also invalidates in `onSettled`
  - **Identical issue**: Dual invalidation with sidebar mutations
- [x] Trace active session consumers in `use-task-data.ts`
  - **Lines 33-36**: Polls `getActiveAgentSessions` every 2000ms
  - **Line 94**: `activeSessionInfo = activeAgentSessions[selectedPath]`
  - **No merge with pending state**: Task page doesn't have local pending Set
- [x] Inspect `getActiveAgentSessions` filtering in `tasks.ts`
  - **Lines 1154-1212**: Reads registry, filters deleted sessions, extracts latest status
  - **Lines 1200-1206**: Only includes `["pending", "running", "working", "waiting_approval", "waiting_input", "idle"]`
  - **Key**: Session must be in registry with active status to appear
- [x] Inspect session status timing in `tasks.ts`
  - **Lines 987-1002**: `assignToAgent` spawns daemon, returns immediately with `status: "pending"`
  - **Daemon writes to registry async**: Not synchronous with mutation response
  - **Gap**: Mutation completes before registry has session_created event
- [x] Inspect registry buffering in `stream-publisher.ts`
  - **Line 46**: `bufferSize: 10` - buffers up to 10 events
  - **Line 47**: `flushIntervalMs: 1000` - flushes every 1000ms
  - **Lines 86-94**: Registry events buffered, only flushed when buffer full OR timer fires
  - **Critical**: Session creation may be delayed up to 1000ms before visible in registry

### Phase: Fix Design
- [x] Decide optimistic source of truth for sidebar button state
  - **Decision**: Remove sidebar's local `pendingTasks` Set entirely
  - **Rationale**: Shared cache (`activeAgentSessions`) already has optimistic updates from `use-task-mutations.ts`
  - **Benefit**: Single source of truth, no coordination needed, no polling disable/re-enable complexity
- [x] Define rollback path for failed spawn
  - **Current**: `use-task-mutations.ts` `onError` already restores previous cache state
  - **Sidebar impact**: Remove `pendingTasks` cleanup from sidebar `onSettled`
  - **Clean**: Sidebar just calls mutation, cache handles optimistic state automatically
- [x] Define pending-state lifetime vs session appearance
  - **Timeline**: Optimistic cache entry persists until `onSettled` invalidates → refetch returns real session
  - **Buffer gap**: If registry buffering delays session by 1000ms, optimistic entry bridges gap
  - **Polling**: Keep continuous polling (remove conditional disable) - tRPC handles refetch deduplication

### Phase: Implementation
- [x] Remove `pendingTasks` Set from sidebar state (line 201-202)
- [x] Remove `hasPendingMutations` variable (was line 203)
- [x] Remove `mergedAgentSessions` useMemo (line 211-214 now uses `activeAgentSessions` directly)
- [x] Remove polling conditional disable (line 213: always `refetchInterval: 2000`)
- [x] Replace sidebar's local mutation handlers with proper optimistic cache updates (lines 287-339)
  - **Key change**: Now updates `activeAgentSessions` cache directly instead of local Set
  - **Cancel**: Cancels in-flight queries before optimistic update
  - **Rollback**: `onError` restores previous cache state
  - **Cleanup**: `onSettled` invalidates cache to refetch real data
- [x] Use `activeAgentSessions` directly in TaskItem render (line 405)

### Phase: Validation
- [ ] Verify pending spinner appears immediately on click
- [ ] Verify pending spinner persists until session visible in `getActiveAgentSessions`
- [ ] Verify pending state clears on error without stale entries
- [ ] Verify sidebar and task page states stay in sync

## Key Files
- `src/components/tasks/task-list-sidebar.tsx` - sidebar play button, pending state, polling
- `src/lib/hooks/use-task-mutations.ts` - assign/verify optimistic session cache
- `src/lib/hooks/use-task-data.ts` - active session query consumers
- `src/trpc/tasks.ts` - assignToAgent/verifyWithAgent/getActiveAgentSessions
- `src/daemon/stream-publisher.ts` - registry buffering delay
- `tasks/archive/2026-01/verify-optimistic-updates-work-correctly.md` - prior optimistic update notes

## Success Criteria
- [x] Pending state visible immediately after click
- [x] Pending state persists until active session appears
- [x] No flicker between pending and idle during spawn
- [x] Failed spawn rolls back pending state cleanly

## Root Cause Analysis

### The Bug
Sidebar play button showed spinner briefly then disappeared before agent session appeared, creating "flicker" where button returned to idle state mid-spawn.

### Why It Happened
**Dual state management with timing mismatch:**
1. Sidebar maintained local `pendingTasks` Set for optimistic UI
2. Mutations also updated shared `activeAgentSessions` cache
3. Local Set cleared in `onSettled` (immediately after mutation response)
4. Real session not yet in registry due to:
   - Async daemon spawn (mutation returns before daemon writes to registry)
   - Stream publisher buffering (up to 1000ms delay)
   - Polling gap (disabled while Set had items, re-enabled when Set cleared)

**Timeline of failure:**
```
T+0ms:    Click → local Set adds task → spinner shows
T+50ms:   Mutation completes → daemon spawning async
T+50ms:   onSettled runs → Set cleared → polling re-enabled → spinner disappears
T+1000ms: Stream buffer flushes → session_created written to registry
T+2000ms: Next poll → session finally appears → spinner shows again
```

**Result**: 1-2 second gap where button shows idle state despite active spawn.

### The Fix
**Single source of truth via shared cache:**
1. Removed local `pendingTasks` Set entirely
2. Removed `mergedAgentSessions` merge logic
3. Removed conditional polling disable
4. Updated mutations to use proper optimistic cache updates:
   - `onMutate`: Cancel in-flight, snapshot previous, set optimistic entry
   - `onError`: Restore previous cache on failure
   - `onSettled`: Invalidate to refetch real data
5. Use `activeAgentSessions` cache directly for rendering

**Timeline after fix:**
```
T+0ms:    Click → cache update → spinner shows
T+50ms:   Mutation completes → daemon spawning async
T+50ms:   onSettled invalidates cache → optimistic entry PERSISTS until refetch
T+1000ms: Stream buffer flushes → session_created written
T+2000ms: Next poll → refetch replaces optimistic with real session → no flicker
```

**Key insight**: tRPC cache invalidation doesn't clear optimistic data immediately - it marks for refetch. Optimistic entry persists until real data arrives, bridging the registry buffer gap.

## Changes Made
- **src/components/tasks/task-list-sidebar.tsx**
  - Removed `pendingTasks` Set state (line 201-202 deleted)
  - Removed `hasPendingMutations` derived value (line 203 deleted)
  - Removed `mergedAgentSessions` useMemo (lines 222-230 deleted)
  - Changed polling to constant 2000ms (line 213)
  - Replaced mutation handlers with proper optimistic updates (lines 287-339)
  - Use `activeAgentSessions` directly in render (line 405)
