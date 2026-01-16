# Worktrees Feature Broken: 3 Active Sessions, 0 Worktrees

## Problem Statement
Sessions have `worktreePath`/`worktreeBranch` stored but actual worktrees don't exist on disk. `cleanupOrphanedWorktrees()` exists but is never called. No way to delete sessions or trigger cleanup.

## Scope
**In:**
- Fix worktree cleanup lifecycle
- Add session deletion mechanism
- Server startup cleanup

**Out:**
- UI redesign
- Worktree performance optimization

## Implementation Plan

### Phase 1: Server Startup Cleanup
- [x] Call `cleanupOrphanedWorktrees()` on server init in `manager.ts`
- [x] Get active session IDs from store, pass to cleanup function
- [x] Add logging for cleanup operations

### Phase 2: Session Deletion API
- [x] Add `deleteSession` mutation to `src/trpc/agent.ts` (already existed, enhanced to call manager.delete)
- [x] Call `manager.delete(sessionId)` in mutation handler
- [x] Add UI delete button in session list/sidebar (already exists in /agents/$sessionId route)

### Phase 3: Sync Session State with Worktree Reality
- [x] On session load, verify `worktreePath` actually exists on disk
- [x] Clear `worktreePath`/`worktreeBranch` if worktree missing
- [x] Add `git.cleanupWorktrees` mutation for manual trigger

## Key Files
- `src/lib/agent/manager.ts` - added startup cleanup call in `getAgentManager()`
- `src/lib/agent/git-worktree.ts` - `cleanupOrphanedWorktrees()` already exists
- `src/trpc/agent.ts` - enhanced delete mutation to call manager.delete()
- `src/trpc/git.ts` - added cleanupWorktrees mutation
- `src/routes/api/trpc/$.ts` - added worktree path verification on session load
- `src/routes/agents/$sessionId.tsx` - delete button already exists (line 646-653)

## Success Criteria
- [x] Server startup cleans orphaned worktrees
- [x] Sessions can be deleted via UI
- [x] `worktreePath` in session matches reality on disk
- [x] No more "3 sessions, 0 worktrees" state

## Unresolved Questions
1. Should session deletion require confirmation? → Currently no confirmation
2. Should completed/failed sessions auto-delete after X time? → Not implemented
3. Keep branches after worktree deletion or delete both? → Both are deleted (see deleteWorktree)
