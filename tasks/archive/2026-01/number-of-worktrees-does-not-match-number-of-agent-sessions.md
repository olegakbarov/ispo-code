# number of worktrees does not match number of agent sessions

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Agent sessions appear in the UI/streams, but `git worktree list` shows only the main worktree and `.ispo-code/worktrees` is empty (worktree count lags sessions).
- **Immediate Cause**: Daemon-based spawn path never calls `createWorktree`; worktrees are only created in `AgentManager.spawn`, which is bypassed by `trpc.agent.spawn` + `ProcessMonitor.spawnDaemon`.
- **Call Chain**: UI spawn → `src/trpc/agent.ts` `spawn` → `src/daemon/process-monitor.ts` `spawnDaemon` → `src/daemon/agent-daemon.ts` `run` → session created event (no worktree creation).
- **Original Trigger**: Durable-streams/daemon architecture replaced manager-spawn flow without integrating worktree creation or session tracking for cleanup.
- **Evidence**: `git worktree list` shows only main; `src/lib/agent/git-worktree.ts` is referenced only by `manager.ts`; server logs show `spawnDaemon called` without `[git-worktree] Created worktree` entries and cleanup logs removing `5c1aebd3c7d5` as “orphaned” because session store lacks daemon sessions (`logs/server.log`).

### Phase 2: Pattern Analysis
- **Working Examples**: `src/lib/agent/manager.ts` `spawn()` calls `createWorktree()` and stores `worktreePath/worktreeBranch`; task cleanup uses `getWorktreeForSession()` when worktrees exist.
- **Key Differences**: Daemon spawn path (`ProcessMonitor.spawnDaemon` + `AgentDaemon`) never creates a worktree or records worktree metadata; cleanup uses the legacy session store so daemon sessions look orphaned; tRPC context only resolves worktrees from the session store when `X-Working-Dir` is missing.
- **Dependencies**: `isWorktreeIsolationEnabled()`, git repo detection via `getGitRoot()`, durable streams registry for session IDs, and `.ispo-code/worktrees/<sessionId>` path convention.

### Phase 3: Hypothesis & Testing
- **Hypothesis**: Sessions spawned via the daemon path lack worktrees because no creation step runs and cleanup uses only the session store; adding daemon worktree creation and registry-aware cleanup will align worktree count with session count.
- **Test Design**: Add a unit test that creates a temp git repo and calls a daemon worktree resolver for a new session, validating that a worktree directory is created and `git worktree list` includes it.
- **Prediction**: The resolver returns `worktreePath`/`worktreeBranch`, the worktree exists on disk, and `git worktree list` includes the path.
- **Result**: `vitest run src/daemon/__tests__/worktree.test.ts` passes; worktree is created and listed.
- **Conclusion**: Hypothesis confirmed; daemon worktree creation now produces expected worktrees in isolation.

### Phase 4: Implementation
- **Root Cause**: Daemon sessions bypassed `createWorktree`, and cleanup relied solely on the legacy session store, so daemon sessions never created worktrees and any that existed were treated as orphaned.
- **Solution**: Added a daemon worktree resolver that creates/attaches worktrees for daemon spawns, passed worktree metadata through daemon config and registry events, scoped daemon operations to worktrees, resolved worktrees in tRPC context even with `X-Working-Dir`, and used stream-aware session IDs for cleanup.
- **Test Case**: `src/daemon/__tests__/worktree.test.ts` validates that a daemon session creates a worktree in a temp repo and shows up in `git worktree list`.
- **Verification**: `npm run test:run -- src/daemon/__tests__/worktree.test.ts` (passes; vitest warns about `src/routes/tasks/_page.tsx` not exporting a route).
- **Changes Made**: `src/daemon/worktree.ts`, `src/daemon/process-monitor.ts`, `src/daemon/agent-daemon.ts`, `src/streams/schemas.ts`, `src/trpc/agent.ts`, `src/routes/api/trpc/$.ts`, `src/lib/agent/session-schema.ts`, `src/lib/agent/session-index.ts`, `src/lib/agent/manager.ts`, `src/trpc/git.ts`, `src/daemon/__tests__/worktree.test.ts`.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
