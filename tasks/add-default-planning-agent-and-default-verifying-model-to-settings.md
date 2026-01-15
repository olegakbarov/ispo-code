# add default 'planning agent' and default 'verifying model' to settings

## Problem Statement
User-configurable defaults missing for planning agent, verifying model. Hard-coded defaults in task flows; no persistence.

## Scope
**In:**
- Settings fields for planning agent + verifying model defaults
- Settings UI controls for those defaults
- Task create/verify flows using settings defaults

**Out:**
- New agent types or model registry changes
- Server-side default changes in tRPC schemas
- Auto-updating settings from modal selections

## Implementation Plan

### Phase: Settings Defaults
- [x] Add `defaultPlanningAgentType`, `defaultVerifyModelId` to `src/lib/stores/settings.ts`
- [x] Add planning agent selector in `src/routes/settings.tsx`
- [x] Add verifying model selector in `src/routes/settings.tsx`
- [x] Filter settings options with `trpc.agent.availableTypes` in `src/routes/settings.tsx`

### Phase: Task Flow Wiring
- [x] Add defaults params to `createInitialState` in `src/lib/stores/tasks-reducer.ts`
- [x] Seed create defaults from settings in `src/routes/tasks/_page.tsx`
- [x] Seed verify agent/model from settings in `src/routes/tasks/_page.tsx`
- [x] Use settings verify defaults in `src/components/tasks/task-list-sidebar.tsx`

## Key Files
- `src/lib/stores/settings.ts` - new settings fields + defaults
- `src/routes/settings.tsx` - planning agent + verifying model controls
- `src/lib/stores/tasks-reducer.ts` - initial state defaults wiring
- `src/routes/tasks/_page.tsx` - apply settings defaults to create/verify
- `src/components/tasks/task-list-sidebar.tsx` - quick verify uses settings defaults

## Success Criteria
- [x] Settings page shows planning agent + verifying model selectors
- [x] Create task modal defaults to selected planning agent
- [x] Verify modal and sidebar verification use selected verifying model

## Unresolved Questions
- None
