# when we run bug fix flow with multiple agents each of the outputs should be processed by one orcestrator modal (codex) after all agents are done (success or not)

## Problem Statement
Multi-agent bug debug outputs isolated; no unified post-processing. Need single codex orchestrator after all debug sessions terminal, including failures.

## Scope
**In:**
- Debug run grouping metadata
- Aggregated output prompt + codex orchestration
- Auto-triggered orchestrator modal on completion
- Terminal-status handling for failed/cancelled sessions
**Out:**
- Single-agent bug flow changes
- Debate/review/verify UX changes
- Worktree isolation changes
- New agent types or models

## Implementation Plan

### Phase: Debug Run Tracking
- [ ] Add `debugRunId` field in registry events and daemon config (`src/streams/schemas.ts`, `src/daemon/agent-daemon.ts`)
- [ ] Expose `debugRunId` on agent sessions (`src/lib/agent/types.ts`, `src/trpc/agent.ts`)
- [ ] Generate and pass `debugRunId` in `debugWithAgents` (`src/trpc/tasks.ts`)
- [ ] Add debug run status helper/query (`src/trpc/tasks.ts`)

### Phase: Orchestrator Session
- [ ] Build `buildDebugOrchestratorPrompt` with per-session outputs + truncation (`src/trpc/tasks.ts`)
- [ ] Add `tasks.orchestrateDebugRun` mutation to spawn codex session (`src/trpc/tasks.ts`)
- [ ] Add idempotency guard per `debugRunId` (`src/trpc/tasks.ts`)
- [ ] Decide orchestrator output storage target (task file vs modal-only)

### Phase: Orchestrator Modal
- [ ] Create `src/components/tasks/orchestrator-modal.tsx` for live codex output
- [ ] Add modal state + orchestrator session id (`src/lib/stores/tasks-reducer.ts`)
- [ ] Trigger orchestrator once on debug run completion (`src/routes/tasks/_page.tsx`)
- [ ] Surface orchestrator session in task sessions list (`src/components/tasks/task-sessions.tsx`)

### Phase: Validation
- [ ] Add tests for debug run completion gating
- [ ] Add tests for orchestrator prompt assembly limits

## Key Files
- `src/trpc/tasks.ts` - debug run metadata, prompt, orchestrator mutation
- `src/streams/schemas.ts` - registry event fields for `debugRunId`
- `src/daemon/agent-daemon.ts` - daemon config + registry emission
- `src/lib/agent/types.ts` - `AgentSession` debug run metadata
- `src/trpc/agent.ts` - session reconstruction with `debugRunId`
- `src/routes/tasks/_page.tsx` - completion detection + modal trigger
- `src/lib/stores/tasks-reducer.ts` - orchestrator modal state
- `src/components/tasks/orchestrator-modal.tsx` - new modal UI
- `src/components/tasks/task-sessions.tsx` - show orchestrator session

## Success Criteria
- [ ] All debug sessions terminal triggers orchestrator flow
- [ ] Codex orchestrator runs once per debug run, even on failures
- [ ] Orchestrator modal shows aggregated output without manual navigation
- [ ] Debug run state survives refresh/navigation

## Unresolved Questions
- Should orchestrator output write into task file or stay modal-only?
- Should orchestrator auto-run or require user confirmation?
