# start implementation modal do not respect default coding model (do we have a setting for it? we should)

## Problem Statement
Implement modal ignoring default coding model; run defaults hardcoded to codex.
No implementation default setting; auto-run + no-plan create start with wrong model.

## Scope
**In:**
- Settings for default implementation agent/model
- Implement modal/run state use settings defaults
- Auto-run + no-plan create use settings defaults

**Out:**
- Server-side model default changes
- Planner/verification defaults behavior changes
- New agent types or models

## Implementation Plan

### Phase: Settings + State
- [x] Add implementation defaults to `src/lib/stores/settings.ts`
- [x] Wire new settings props in `src/routes/settings/index.tsx`
- [x] Extend `src/components/settings/agent-defaults-section.tsx` UI for implementation defaults

### Phase: Apply Defaults
- [x] Apply settings defaults to run state in `src/lib/hooks/use-task-agent-type-sync.ts`
- [x] Seed run defaults in `src/lib/stores/tasks-reducer.ts`
- [x] Use defaults for quick-run in `src/components/tasks/task-list-sidebar.tsx`

### Phase: Validation
- [x] Existing tests pass (38 tests in use-task-actions.test.ts and use-task-create-actions.test.ts)
- [x] Build passes with no type errors

## Key Files
- `src/components/tasks/implement-modal.tsx` - uses run defaults on open
- `src/lib/stores/settings.ts` - add implementation default fields
- `src/components/settings/agent-defaults-section.tsx` - new settings controls
- `src/routes/settings/index.tsx` - pass implementation defaults
- `src/lib/hooks/use-task-agent-type-sync.ts` - apply defaults to run
- `src/lib/stores/tasks-reducer.ts` - initialize run defaults
- `src/components/tasks/task-list-sidebar.tsx` - use defaults on run

## Success Criteria
- [x] Implement modal preselects settings default agent/model
- [x] Auto-run/no-plan implementation uses settings default model
- [x] Settings page shows implementation defaults and persists

## Implementation Summary

Added `defaultImplementAgentType` and `defaultImplementModelId` to the settings store with the same pattern as verification defaults. The settings are:
1. Stored in localStorage via zustand persist middleware
2. Displayed in Settings > Agent Defaults section
3. Applied to run state on initial load via `use-task-agent-type-sync.ts`
4. Seeded into initial reducer state via `createInitialState()`
5. Used for quick-run from sidebar via `handleRunImpl`
