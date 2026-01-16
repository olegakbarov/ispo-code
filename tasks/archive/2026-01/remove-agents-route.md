# remove /agents route

## Problem Statement
Remove standalone `/agents` routes + pages. Session navigation stays in tasks UI; no dead links.

## Scope
**In:**
- Delete `src/routes/agents.tsx`, `src/routes/agents/index.tsx`, `src/routes/agents/$sessionId.tsx`
- Replace `/agents/$sessionId` navigation in `src/lib/hooks/use-task-mutations.ts`, `src/components/tasks/task-sessions.tsx`, `src/components/tasks/task-review-panel.tsx`, `src/components/tasks/orchestrator-modal.tsx`, `src/components/agents/file-comment-input.tsx`
- Update stats session links in `src/components/stats/tool-usage-chart.tsx`, `src/components/stats/hot-files-table.tsx`
- Regenerate `src/routeTree.gen.ts` without /agents routes

**Out:**
- No changes to agent runtime or APIs in `src/lib/agent/*`, `src/trpc/agent.ts`
- No redesign of task editor/sidebar layout
- No new session viewer UX beyond existing tasks surfaces

## Implementation Plan

### Phase: Remove Routes
- [x] Delete `src/routes/agents.tsx`
  - Verified: File not present in workspace (no match in `rg --files`) for `src/routes/agents.tsx`.
- [x] Delete `src/routes/agents/index.tsx`
  - Verified: File not present in workspace (no match in `rg --files`) for `src/routes/agents/index.tsx`.
- [x] Delete `src/routes/agents/$sessionId.tsx`
  - Verified: File not present in workspace (no match in `rg --files`) for `src/routes/agents/$sessionId.tsx`.
- [x] Regenerate `src/routeTree.gen.ts`
  - Verified: No `agents` entries found in `src/routeTree.gen.ts`.

### Phase: Replace Navigation
- [x] Swap `/agents/$sessionId` redirects in `src/lib/hooks/use-task-mutations.ts`
  - Verified: Navigation targets `/tasks` routes (no `/agents`) in `src/lib/hooks/use-task-mutations.ts:97` and `src/lib/hooks/use-task-mutations.ts:242`.
- [x] Update session click targets in `src/components/tasks/task-sessions.tsx`
  - Verified: Session click handlers no-op with "already visible" note in `src/components/tasks/task-sessions.tsx:143` and `src/components/tasks/task-sessions.tsx:206`.
- [x] Update spawn navigation in `src/components/tasks/task-review-panel.tsx`
  - Verified: Spawn success stays on current page in `src/components/tasks/task-review-panel.tsx:64`.
- [x] Update view-session navigation in `src/components/tasks/orchestrator-modal.tsx`
  - Verified: View-session action closes modal (no routing) in `src/components/tasks/orchestrator-modal.tsx:50`.
- [x] Update comment-session navigation in `src/components/agents/file-comment-input.tsx`
  - Verified: Spawn success keeps user on page in `src/components/agents/file-comment-input.tsx:62`.
- [x] Update stats session links in `src/components/stats/tool-usage-chart.tsx`
  - Verified: Links to tasks are conditional on `taskPath` in `src/components/stats/tool-usage-chart.tsx:161` and `src/components/stats/tool-usage-chart.tsx:163`.
- [x] Update stats session links in `src/components/stats/hot-files-table.tsx`
  - Verified: Links to tasks are conditional on `taskPath` in `src/components/stats/hot-files-table.tsx:208` and `src/components/stats/hot-files-table.tsx:210`.

### Phase: Cleanup + Tests
- [x] Relocate or inline `SessionWithMetadata` type in `src/components/agents/thread-sidebar.tsx`
  - Verified: `SessionWithMetadata` defined in `src/lib/agent/types.ts:330` and imported in `src/components/agents/thread-sidebar.tsx:33`.
- [x] Update navigation expectations in `src/lib/hooks/__tests__/use-task-actions.test.ts`
  - Verified: Navigation expectations use `/tasks/$` in `src/lib/hooks/__tests__/use-task-actions.test.ts:203`.

## Key Files
- `src/routes/agents.tsx` - remove layout route
- `src/routes/agents/index.tsx` - remove new agent page
- `src/routes/agents/$sessionId.tsx` - remove session view + type export
- `src/routeTree.gen.ts` - regenerate route tree
- `src/lib/hooks/use-task-mutations.ts` - redirect target updates
- `src/components/tasks/task-sessions.tsx` - session click handling
- `src/components/tasks/task-review-panel.tsx` - spawn navigation updates
- `src/components/tasks/orchestrator-modal.tsx` - view-session link
- `src/components/agents/file-comment-input.tsx` - comment session navigation
- `src/components/stats/tool-usage-chart.tsx` - session links
- `src/components/stats/hot-files-table.tsx` - session links
- `src/lib/hooks/__tests__/use-task-actions.test.ts` - test updates

## Success Criteria
- [x] `src/routes/agents.tsx`, `src/routes/agents/index.tsx`, `src/routes/agents/$sessionId.tsx` removed
  - Verified: None of these files exist in workspace (no matches via `rg --files`) for `src/routes/agents.tsx`, `src/routes/agents/index.tsx`, `src/routes/agents/$sessionId.tsx`.
- [x] `src/routeTree.gen.ts` contains no `/agents` routes
  - Verified: No `/agents` entries found in `src/routeTree.gen.ts`.
- [x] No remaining `/agents/$sessionId` links in UI/hook code
  - Verified: No `/agents/$sessionId` occurrences found under `src` (rg -n search returned no matches).
- [x] Tests updated for new navigation targets
  - Verified: Navigation expectations reference `/tasks/$` in `src/lib/hooks/__tests__/use-task-actions.test.ts:203`.

## Unresolved Questions - RESOLVED
- Session link target when `taskPath` missing (stats sessions) - **RESOLVED**: Made session IDs non-clickable (plain text) in stats pages
- Keep or delete `src/components/agents/thread-sidebar.tsx`, `src/components/agents/session-primitives.tsx`, `src/components/agents/prompt-display.tsx` - **KEPT**: Still used by the UI
- Should session detail live in tasks page or remove deep-linking - **RESOLVED**: Sessions stay in task page sidebar, no deep-linking

## Verification Results
- Tests: `npm run test:run` failed with 8 failing tests across `src/lib/agent/manager.test.ts` and `src/lib/tasks/create-task-visibility.test.ts`.
- Failure detail: `src/lib/agent/manager.test.ts` reports worktree permission and connection errors during resume tests.
- Failure detail: `src/lib/tasks/create-task-visibility.test.ts` has expectation mismatches (modal vs inline/none).
- Warning: Route file `src/routes/tasks/_page.tsx` reported as missing a Route export during test run.