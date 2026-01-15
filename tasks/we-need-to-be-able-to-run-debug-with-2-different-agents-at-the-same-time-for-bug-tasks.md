# we need to be able to run debug with N different agents at the same time (for Bug tasks)

## Problem Statement
Bug tasks spawn single debug agent. Need concurrent debug with configurable set of agents. System supports multiple sessions per task but no UI/API for multi-agent debug spawn.

## Scope
**In:**
- New `debugWithAgents` tRPC mutation spawning N agents
- UI checkboxes in create-task-modal to select agents for debug (bug type only)
- Coordinated session titles (`Debug (1):`, `Debug (2):`, ...)
- All selected agents appear in task sessions list

**Out:**
- Agent-to-agent communication/coordination
- Auto-selection of complementary agents
- Merging/diffing agent findings
- Changes to worktree isolation (each gets own worktree)

## Implementation Plan

### Phase 1: Backend - Multi-Agent Debug Mutation
- [x] Add `debugWithAgents` mutation in `src/trpc/tasks.ts`
  - ✓ Verified: `debugWithAgents` mutation and handler exist in `src/trpc/tasks.ts`.
  - ✓ Verified: handler creates the task and spawns sessions in a loop in `src/trpc/tasks.ts`.
- [ ] Accept `agentTypes[]`, `models[]?` params
  - ✗ Not found: input schema expects `agents: [{ agentType, model? }]` and does not accept `agentTypes`/`models` fields in `src/trpc/tasks.ts`.
- [x] Reuse `buildTaskDebugPrompt()` for all agents
  - ✓ Verified: prompt built once with `buildTaskDebugPrompt` before the spawn loop in `src/trpc/tasks.ts`.
  - ✓ Verified: `buildTaskDebugPrompt` uses `searchArchivedTasks` in `src/trpc/tasks.ts`.
- [x] Spawn N daemons via `monitor.spawnDaemon()` with titles `Debug (1): {title}`, `Debug (2): {title}`
  - ✓ Verified: loop calls `monitor.spawnDaemon` with `title: Debug (${i + 1})` in `src/trpc/tasks.ts`.
  - ✓ Verified: `sessionId` and `daemonNonce` generated per agent in `src/trpc/tasks.ts`.
- [x] Return `sessionIds[]` in response
  - ✓ Verified: response includes `sessionIds` and `path` in `src/trpc/tasks.ts`.

### Phase 2: UI - Agent Selection
- [x] Add agent selection checkboxes in `CreateTaskModal` (bug type only)
  - ✓ Verified: debug agent list renders only when `taskType === 'bug'` in `src/components/tasks/create-task-modal.tsx`.
  - ✓ Verified: model dropdown renders for selected agents with `supportsModelSelection` in `src/components/tasks/create-task-modal.tsx`.
- [x] Enforce at least one agent selected
  - ✓ Verified: Create button disables when no debug agent is selected in `src/components/tasks/create-task-modal.tsx`.
- [x] Add reducer actions in `tasks-reducer.ts` for selected agents
  - ✓ Verified: `TOGGLE_DEBUG_AGENT`, `SET_DEBUG_AGENT_MODEL`, `INIT_DEBUG_AGENTS` actions and handlers exist in `src/lib/stores/tasks-reducer.ts`.
  - ✓ Verified: `RESET_CREATE_MODAL` clears debug selections in `src/lib/stores/tasks-reducer.ts`.
- [x] Update `onCreate` handler in `_page.tsx` to call new mutation
  - ✓ Verified: bug-task branch collects selected agents and calls `debugWithAgentsMutation` in `src/routes/tasks/_page.tsx`.
  - ✓ Verified: feature tasks still call `createWithAgentMutation` in `src/routes/tasks/_page.tsx`.
- [x] Navigate to first agent session after creation (or task page)
  - ✓ Verified: debug-with-agents success navigates to `data.sessionIds[0]` in `src/routes/tasks/_page.tsx`.
  - ✓ Verified: non-agent create navigates to the task page in `src/routes/tasks/_page.tsx`.

### Phase 3: Session Display
- [x] Update `getSessionsForTask` to handle multi-agent debug sessions
  - ✓ Verified: `getSessionsForTask` treats `debug:` and `debug (N):` titles as planning sessions in `src/trpc/tasks.ts`.
- [x] Verify all selected agents appear under "planning" group (via regex for `Debug (N):`)
  - ✓ Verified: planning sessions are passed to `TaskSessions` in `src/components/tasks/task-sidebar.tsx`.
  - ✓ Verified: session cards render model/agent info in `src/components/tasks/task-sessions.tsx`.
- [ ] Consider visual indicator linking grouped debug sessions
  - ⚠️ Not implemented: No special visual grouping for multi-agent debug sessions.
  - Note: Sessions appear in standard list format with numbered titles. While functional, there's no visual indicator (e.g., indentation, color-coding, or group header) that explicitly links Debug (1), Debug (2), etc. as related sessions from the same multi-agent run
  - Future enhancement: Could add visual treatment like:
    - Subtle left border or background color linking related debug sessions
    - Expandable/collapsible group for multi-agent debug runs
    - Badge showing "2 of 3" to indicate session belongs to group

## Key Files
- `src/trpc/tasks.ts` - add `debugWithAgents` mutation (~54 lines)
- `src/components/tasks/create-task-modal.tsx` - agent checkboxes UI (~50 lines)
- `src/lib/stores/tasks-reducer.ts` - add create state for selected agents
- `src/routes/tasks/_page.tsx` - wire up new mutation

## Success Criteria
- [x] Creating bug task with N agents spawns N independent sessions
  - ✓ Verified: `debugWithAgents` loops and calls `monitor.spawnDaemon` per agent in `src/trpc/tasks.ts`.
- [x] All sessions linked to same task, visible in sessions list
  - ✓ Verified: `debugWithAgents` passes the same `taskPath` to each daemon in `src/trpc/tasks.ts`.
  - ✓ Verified: sessions grouped and displayed under planning in `src/components/tasks/task-sessions.tsx`.
- [ ] Each agent runs in isolated worktree on separate branch
  - ✗ Not verified: daemon-based sessions use `workingDir` from `src/trpc/tasks.ts` through `src/daemon/process-monitor.ts` and `src/daemon/agent-daemon.ts` without creating worktrees.
  - ✗ Note: worktree isolation is implemented in `src/lib/agent/manager.ts` for non-daemon sessions.
- [x] User can monitor all sessions independently
  - ✓ Verified: session cards link to `/agents/$sessionId` in `src/components/tasks/task-sessions.tsx`.

## Verification Results
**Summary**: Core multi-agent debug wiring is present, but the documented input shape and worktree isolation claim don't match the current code. Tests did not complete.

**Tests**
- `npm run test:run` (timed out after 120s). Partial output shows 6 failing tests in `src/lib/agent/manager.test.ts` with worktree creation permission errors and connection errors.

**Gaps**
- `debugWithAgents` accepts `agents: [{ agentType, model? }]` rather than `agentTypes[]`/`models[]`.
- Debug daemon sessions are not using worktree isolation paths.