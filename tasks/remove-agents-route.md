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
- [x] Delete `src/routes/agents/index.tsx`
- [x] Delete `src/routes/agents/$sessionId.tsx`
- [x] Regenerate `src/routeTree.gen.ts`

### Phase: Replace Navigation
- [x] Swap `/agents/$sessionId` redirects in `src/lib/hooks/use-task-mutations.ts`
- [x] Update session click targets in `src/components/tasks/task-sessions.tsx`
- [x] Update spawn navigation in `src/components/tasks/task-review-panel.tsx`
- [x] Update view-session navigation in `src/components/tasks/orchestrator-modal.tsx`
- [x] Update comment-session navigation in `src/components/agents/file-comment-input.tsx`
- [x] Update stats session links in `src/components/stats/tool-usage-chart.tsx`
- [x] Update stats session links in `src/components/stats/hot-files-table.tsx`

### Phase: Cleanup + Tests
- [x] Relocate or inline `SessionWithMetadata` type in `src/components/agents/thread-sidebar.tsx`
- [x] Update navigation expectations in `src/lib/hooks/__tests__/use-task-actions.test.ts`

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
- [x] `src/routeTree.gen.ts` contains no `/agents` routes
- [x] No remaining `/agents/$sessionId` links in UI/hook code
- [x] Tests updated for new navigation targets

## Unresolved Questions - RESOLVED
- Session link target when `taskPath` missing (stats sessions) - **RESOLVED**: Made session IDs non-clickable (plain text) in stats pages
- Keep or delete `src/components/agents/thread-sidebar.tsx`, `src/components/agents/session-primitives.tsx`, `src/components/agents/prompt-display.tsx` - **KEPT**: Still used by the UI
- Should session detail live in tasks page or remove deep-linking - **RESOLVED**: Sessions stay in task page sidebar, no deep-linking
