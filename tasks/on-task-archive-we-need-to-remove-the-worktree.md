# on task archive we need to remove the worktree

## Problem Statement
Archived tasks with leftover session worktrees/branches.
Disk bloat, stale worktree state after archive; need cleanup.

## Scope
**In:**
- Remove `.agentz/worktrees/<sessionId>` for sessions tied to archived task
- Delete `agentz/session-<sessionId>` branches with worktree removal
- Skip cleanup when worktree isolation disabled or repo root missing
**Out:**
- Changing task deletion behavior
- Removing session history/registry events
- UI changes to worktree screens

## Implementation Plan

### Phase: Archive cleanup
- [x] Gather task session IDs in `src/trpc/tasks.ts` archive mutation
- [x] Resolve repo root and worktree paths per session
- [x] Delete worktrees/branches for those sessions
- [x] Keep archive success when worktree deletion fails

## Key Files
- `src/trpc/tasks.ts` - archive mutation cleanup
- `src/lib/agent/git-worktree.ts` - worktree lookup/deletion helpers
- `src/lib/agent/git-service.ts` - repo root lookup

## Success Criteria
- [x] Archive removes `.agentz/worktrees/<sessionId>` for task sessions
- [x] `agentz/session-<sessionId>` branches removed with worktrees
- [x] Archive works when isolation disabled or worktree missing

## Open Questions
- Cancel active sessions before deleting worktrees?
  - **Answer**: Current implementation removes worktrees for all sessions without explicitly canceling. The `force: true` flag allows worktree deletion even if sessions are active.
- Remove worktrees for all task sessions or only active session?
  - **Answer**: Removes worktrees for ALL task sessions (planning, review, verify, execution) to fully cleanup disk space.

## Implementation Notes
Added worktree cleanup to `archive` mutation in `src/trpc/tasks.ts:831-847`:
1. Checks `isWorktreeIsolationEnabled()` before cleanup
2. Gets repo root via `getGitRoot(ctx.workingDir)`
3. Iterates through `taskSessionIds` (already resolved earlier in mutation)
4. Uses `getWorktreeForSession()` to find worktree path/branch
5. Calls `deleteWorktree()` with `force: true` and branch name
6. Catches errors per-session to ensure one failure doesn't block others or fail archive
