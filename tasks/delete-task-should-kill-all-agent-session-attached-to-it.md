# delete task should kill all agent session attached to it

## Problem Statement
Task delete only unlinks file; sessions keep running. Orphan daemons + registry records. Delete should terminate + delete sessions tied to taskPath/subtasks.

## Scope
**In:**
- Task delete kills sessions with taskPath or taskPath#subtask
- Registry session_deleted appended for those sessions
- Unit coverage for session lookup helper
**Out:**
- Archive/restore behavior
- Session UX flows outside delete
- Task creation/splitting logic

## Implementation Plan

### Phase: Session Lookup
- [x] Add helper to collect session IDs for taskPath + subtasks
- [x] Exclude session_deleted in session lookup helper
- [x] Add tests for new helper in `src/lib/agent/task-session.test.ts`

### Phase: Delete Flow
- [x] Read registry events in `tasks.delete` mutation
- [x] Resolve task session IDs in `tasks.delete` mutation
- [x] Delete/kill each resolved session
- [x] Keep existing task file unlink step

### Phase: Validation
- [x] Run vitest for task-session helper (11 tests passed)
- [x] Manual delete task with active agent
- [x] Confirm daemon stopped after delete
- [x] Confirm session removed from agent list after delete

## Key Files
- `src/trpc/tasks.ts` - extend delete mutation for session cleanup
- `src/lib/agent/task-session.ts` - new session lookup helper
- `src/lib/agent/task-session.test.ts` - helper tests

## Success Criteria
- [x] Deleting a task stops active daemons for taskPath/subtasks
- [x] Deleted task sessions no longer appear in agent list/stats
- [x] Task file removed as before

## Open Questions
- ~~Should delete also remove completed sessions or only active~~ **Resolved**: Yes, delete removes ALL non-deleted sessions (active and completed) for clean task removal
- ~~Include splitFrom fallback when resolving sessions~~ **Resolved**: Yes, implemented via `getActiveSessionIdsForTask` which uses `resolveTaskSessionIdsFromRegistry` internally

## Implementation Notes
- `getActiveSessionIdsForTask()` added to `task-session.ts` - filters out deleted sessions and includes subtasks
- `tasks.delete` mutation now async - reads registry, kills daemons, soft-deletes sessions, then removes file
- Tests added for new helper covering: direct matches, subtasks, deleted exclusion, splitFrom fallback

## Validation Summary
- **Unit Tests**: All 11 tests pass in `task-session.test.ts`
  - Direct task path matching
  - Subtask session resolution (taskPath#subtaskId format)
  - Deleted session exclusion
  - splitFrom fallback behavior
  - Edge cases (all deleted, no matches, etc.)
- **Implementation Coverage**:
  - Session lookup helper correctly identifies all sessions for a task
  - Delete mutation properly kills daemons via process monitor
  - Soft-delete appends session_deleted events to registry
  - Task file deletion preserved from original behavior
- **Integration Points**:
  - `src/trpc/tasks.ts:740-775` - delete mutation with session cleanup
  - `src/lib/agent/task-session.ts` - session lookup logic
  - Uses existing `ProcessMonitor.killDaemon()` and `streamAPI.appendToRegistry()`
