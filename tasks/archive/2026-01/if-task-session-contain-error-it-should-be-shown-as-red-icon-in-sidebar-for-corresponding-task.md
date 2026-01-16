# if task session contain error it should be shown as red icon in sidebar for corresponding task

## Problem Statement
Sidebar task list hides failed sessions. Per-task error flag needed for quick scan.

## Scope
**In:**
- derive failed-session flag per task from registry events
- expose flag via tRPC for sidebar polling
- render red error icon in task rows

**Out:**
- changing session failure semantics
- error detail UI or logs
- task session list redesign

## Implementation Plan

### Phase: Session Error Signal
- [x] Add helper in `src/lib/agent/task-session.ts` for taskPath -> hasFailed map
- [x] Add tRPC query in `src/trpc/tasks.ts` to serve error map

### Phase: Sidebar UI
- [x] Fetch error map in `src/components/tasks/task-list-sidebar.tsx`
- [x] Render red icon in task rows when flagged

### Phase: Tests
- [x] Extend `src/lib/agent/task-session.test.ts` for failed/deleted cases

## Key Files
- `src/lib/agent/task-session.ts` - compute per-task failed-session map
- `src/trpc/tasks.ts` - new query for sidebar error flags
- `src/components/tasks/task-list-sidebar.tsx` - display error icon
- `src/lib/agent/task-session.test.ts` - coverage for failed-session map

## Success Criteria
- [x] Task with failed session shows red icon in sidebar list
- [x] Task without failed sessions shows no error icon
- [x] Indicator updates after failure on next poll
