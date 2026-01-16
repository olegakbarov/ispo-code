# on click implement 'running' component on sidebar does not appear optimistically

## Problem Statement
Implement click starts agent; sidebar sessions empty until poll
Missing optimistic session data for task sidebar
Need immediate running UI for active session

## Scope
**In:**
- Optimistic session entry for implement in task sidebar data
- Reconcile optimistic entry on success/error
- Preserve existing sidebar/session UI behavior

**Out:**
- Backend stream registry changes
- Session status semantics beyond pending/running
- Sidebar redesign

## Implementation Plan

### Phase: Investigation
- [x] Trace implement click to assign mutation and sidebar session data source
- [x] Identify cache keys feeding sidebar session list and active session tracking

### Phase: Optimistic Update
- [x] Add optimistic entry to `trpc.tasks.getSessionsForTask` cache on assign mutate
- [x] Replace optimistic entry with real session on success
- [x] Roll back optimistic entry on error

### Phase: Verify
- [x] Confirm sidebar shows running card immediately after Implement click
- [x] Confirm optimistic entry reconciles or rolls back correctly

## Key Files
- `src/lib/hooks/use-task-mutations.ts` - optimistic session updates for assign-to-agent
- `src/lib/hooks/use-task-data.ts` - sidebar session data sources
- `src/components/tasks/task-sessions.tsx` - active session card expectations

## Success Criteria
- [x] Implement click shows running session in sidebar without waiting for poll
- [x] Optimistic entry reconciles to real session id/status
- [x] Error restores sidebar to pre-click state

## Implementation Notes

### Changes Made
Modified `assignToAgentMutation` in `src/lib/hooks/use-task-mutations.ts`:

1. **onMutate**: Now updates both caches:
   - `getActiveAgentSessions` - existing behavior for active session indicator
   - `getSessionsForTask` - NEW: adds optimistic session to sidebar list

2. **onSuccess**: Replaces optimistic session with real data in both caches

3. **onError**: Rolls back both caches to previous state

### Optimistic Session Shape
```typescript
{
  sessionId: `pending-impl-${Date.now()}`,
  agentType: agentType ?? 'claude',
  title: 'Implementing...',
  status: 'pending',
  timestamp: new Date().toISOString(),
  sessionType: 'execution',
  model,
}
```

## Unresolved Questions
- Should optimistic session include agent type/model for display, or placeholder
  - **Answer**: YES - uses actual agentType/model from mutation input
- Should verify/rewrite also create optimistic session cards
  - **Answer**: Can be added in follow-up if needed; same pattern applies
