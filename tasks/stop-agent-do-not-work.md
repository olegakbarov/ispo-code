# stop agent do not work

## Investigation Summary

### Root Cause Analysis

**Problem**: When clicking "Stop" button on agent session page, the agent continues running.

**Key Findings**:

1. **UI Button Logic** (src/routes/agents/$sessionId.tsx:438-445):
   - Stop button only shows when `isBusy === true`
   - Button calls `handleCancel()` which invokes `cancelMutation.mutate({ id: sessionId })`
   - Appears to be working correctly

2. **Backend Cancel Flow** (src/trpc/agent.ts:327-363):
   - Cancel endpoint calls two kill functions:
     - `killDaemon(daemon.pid)` from spawn-daemon.ts (uses `-pid` for process group kill)
     - `monitor.killDaemon(input.id)` from process-monitor.ts (cleanup)
   - **FIXED**: Now writes cancellation event to registry after killing (lines 353-360)
   - Also relies on daemon's SIGTERM handler to publish events before dying

3. **Process Group Behavior**:
   - tsx spawns TWO processes: parent tsx CLI + child Node.js daemon
   - Both share same PGID (e.g., 48455)
   - `killDaemon(-pid)` sends SIGTERM to entire process group
   - Should kill both processes simultaneously

4. **Daemon SIGTERM Handler** (src/daemon/agent-daemon.ts:462-466):
   - Receives SIGTERM and calls `daemon.abort()`
   - `abort()` publishes cancellation events to registry (lines 405-425)
   - Then calls `process.exit(143)`

**Hypothesis**: Race condition where:
- tRPC kills daemon process group
- Daemon SIGTERM handler tries to publish cancellation events
- But process dies before events are written to stream
- OR events are written but UI doesn't see them because registry query hasn't refreshed

### Process Tree Evidence

```
PID   PPID  PGID  STAT COMMAND
48455 33104 48455 Ss   node .../tsx/cli.mjs agent-daemon.ts (tsx parent - SESSION LEADER)
48463 48455 48455 S    node .../preflight.cjs agent-daemon.ts (actual daemon worker)
```

Both processes in same group, so `kill(-48455)` affects both.

## Root Cause

**The tRPC cancel endpoint was not writing the cancellation event to the registry stream.**

The cancel flow was:
1. Kill daemon process (sends SIGTERM)
2. Daemon's SIGTERM handler tries to publish cancellation event
3. Daemon exits
4. tRPC returns success

**Problem**: Race condition where daemon might die before successfully publishing the cancellation event to the stream, leaving the UI in a "running" state forever.

## Solution

- [x] Modified `src/trpc/agent.ts` cancel endpoint to write the cancellation event to the registry directly after killing the daemon
  - ✓ **Verified**: Fix present at lines 353-360
  - ✓ **Verified**: Uses `getStreamAPI().appendToRegistry(createRegistryEvent.cancelled({ sessionId: input.id }))`
  - ✓ **Verified**: `createRegistryEvent.cancelled` exists in `src/streams/schemas.ts:201-205`
  - ✓ **Verified**: Import for `createRegistryEvent` present at line 21
  - ✓ **Verified**: No TypeScript errors in `src/trpc/agent.ts`

```typescript
// After killing daemon, explicitly write cancellation to registry
const streamAPI = getStreamAPI()
await streamAPI.appendToRegistry(
  createRegistryEvent.cancelled({ sessionId: input.id })
)
```

This is a "belt-and-suspenders" approach:
- Daemon SIGTERM handler still publishes cancellation (if it survives long enough)
- tRPC endpoint ALSO publishes cancellation (guaranteed to happen)
- If both publish, the duplicate event is harmless (idempotent)

## Files Modified

- [x] `src/trpc/agent.ts` (lines 353-360): Added explicit cancellation event publishing
  - ✓ **Verified**: Code change confirmed at correct location

## Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| Cancel endpoint writes to registry | ✅ Verified | `src/trpc/agent.ts:356-359` contains `streamAPI.appendToRegistry(createRegistryEvent.cancelled(...))` |
| `createRegistryEvent.cancelled` exists | ✅ Verified | `src/streams/schemas.ts:201-205` defines the cancelled factory method |
| Import statements correct | ✅ Verified | Line 21 imports `createRegistryEvent` |
| TypeScript compiles | ✅ Verified | No type errors in `agent.ts` |
| Belt-and-suspenders approach | ✅ Verified | Daemon SIGTERM handler at `agent-daemon.ts:462-466` also publishes via `abort()` method at lines 405-425 |

### Notes on Line Number Discrepancies

The task document had incorrect line number references (likely from before other code changes):
- UI button was listed as lines 384-394, but is actually at lines 438-445
- SIGTERM handler was listed as lines 397-401, but is actually at lines 462-466
- Cancel endpoint was listed as lines 274-306, but is actually at lines 327-363

These discrepancies don't affect the correctness of the fix—just the documentation.