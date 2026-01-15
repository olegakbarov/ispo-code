# test if git worktrees are used by agents

## Problem Statement
Need to verify worktree isolation actually works. Agents should create isolated worktrees, operate within them, and cleanup properly.

## Status: ❌ WORKTREE ISOLATION NOT WORKING

**Tested: 2026-01-14**

### Root Cause
The daemon-based architecture (`spawn-daemon.ts` + `process-monitor.ts` + `agent-daemon.ts`) **bypasses** the worktree creation code in `manager.ts`.

**Code path analysis:**
1. `tRPC agent.spawn` → `processMonitor.spawnDaemon(config)` → daemon runs in `ctx.workingDir`
2. `createWorktree()` in `manager.ts:98` is **never called** - the spawn flow doesn't go through `manager.spawn()`

**Evidence:**
- Spawned agent via API: `curl -X POST .../agent.spawn`
- Session created with ID `70338fdc83fc`
- No `.agentz/worktrees/` directory created
- No `agentz/session-*` branches exist
- `git worktree list` shows only main worktree

### Fix Required
Integrate worktree creation into the daemon spawn flow:
1. **Option A**: Call `createWorktree()` in `process-monitor.ts:spawnDaemon()` before spawning daemon
2. **Option B**: Call `createWorktree()` inside `agent-daemon.ts` at startup
3. Update `workingDir` in daemon config to use worktree path

Also need to integrate cleanup on session delete (currently only in `manager.delete()`).

## Scope
**In:**
- Verify worktree creation on session spawn
- Verify agent operations happen in worktree
- Verify cleanup on session delete
- Verify concurrent sessions stay isolated

**Out:**
- UI testing
- Performance benchmarking
- Merge workflow testing

## Implementation Plan

### Phase: Manual Verification
- [x] Check `DISABLE_WORKTREE_ISOLATION` not set in env (confirmed: not set)
- [x] Spawn agent via UI or API (spawned session `70338fdc83fc`)
- [x] Verify `.agentz/worktrees/{sessionId}` exists → **NOT CREATED**
- [x] Verify `git branch | grep agentz/session-` shows session branch → **NO BRANCHES**
- [x] Verify `git worktree list` shows new worktree → **ONLY MAIN WORKTREE**
- [N/A] Ask agent to create/edit file (skipped - worktree not created)
- [N/A] Verify changes only in worktree, not main repo
- [x] Delete session (cleaned up test session)
- [N/A] Verify worktree directory removed (no worktree to remove)
- [N/A] Verify branch deleted (no branch to delete)

### Phase: Concurrent Isolation Test
- [N/A] Spawn two agents - **BLOCKED**: worktree isolation not working
- [N/A] Ask both to edit same file with different content
- [N/A] Verify each worktree has different file content
- [N/A] Verify main repo unchanged
- [N/A] Check git status for each session shows only its changes

### Phase: Code Verification
- [x] Add console.log in `createWorktree()` to confirm execution → **NOT CALLED** (never executed)
- [N/A] Add console.log in agent tool execution showing working dir
- [x] Check server logs during spawn for worktree creation messages → **NO WORKTREE LOGS**

## Key Files
- `src/lib/agent/git-worktree.ts` - worktree lifecycle (exists, working code)
- `src/lib/agent/manager.ts:91-107` - spawn integration (**NOT USED** by daemon architecture)
- `src/lib/agent/manager.ts:537-557` - delete cleanup (**NOT USED** by daemon architecture)
- `src/routes/api/trpc/$.ts` - session-to-worktree resolution (works, but worktree never created)
- `src/daemon/process-monitor.ts:33-72` - **NEEDS worktree integration**
- `src/daemon/agent-daemon.ts` - runs in workingDir, not worktree
- `src/trpc/agent.ts:297-325` - spawn mutation (passes ctx.workingDir, no worktree)

## Success Criteria
- [ ] Worktree dir exists after spawn → **FAILED**
- [ ] Agent file ops scoped to worktree → **FAILED**
- [ ] Concurrent sessions have separate worktrees → **FAILED**
- [ ] Cleanup removes worktree + branch → **N/A**
- [ ] Main repo stays clean during agent work → **FAILED** (all changes in main repo)

## Recommendations
1. Create new task to fix worktree integration in daemon architecture
2. Either integrate `createWorktree()` in `process-monitor.ts` or `agent-daemon.ts`
3. Add cleanup logic to `agent.delete` tRPC mutation
4. Consider deprecating `manager.ts` spawn/delete or using it in daemon flow
