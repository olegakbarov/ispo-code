# task without AI plan should allow picking model and should automatically trigger implementation

## Problem Statement
Plan-with-AI off: no model picker; run defaults.
Auto-run tied to planning session; no-plan tasks stall.

## Scope
**In:**
- `src/components/tasks/create-task-form.tsx` implementation agent/model inputs for no-plan create
- `src/components/tasks/create-task-modal.tsx` run selection props wiring
- `src/routes/tasks/_page.tsx` dispatch run agent/model updates from create form
- `src/lib/hooks/use-task-actions.ts` auto-start implementation after basic create

**Out:**
- `src/components/tasks/implement-modal.tsx` redesign or persistence changes
- `src/lib/tasks/auto-run.ts` new phase heuristics
- `src/lib/stores/settings.ts` new default agent settings

## Implementation Plan

### Phase: Create UI + State
- [x] Add implementation agent/model inputs for `!useAgent` in `src/components/tasks/create-task-form.tsx`
- [x] Pass run agent/model props through `src/components/tasks/create-task-modal.tsx`
- [x] Wire `SET_RUN_AGENT_TYPE` + `SET_RUN_MODEL` dispatchers in `src/routes/tasks/_page.tsx`

### Phase: Auto-Start Implementation
- [x] Trigger `assignToAgentMutation` on `createMutation` success in `src/lib/hooks/use-task-actions.ts` when `!create.useAgent`
- [x] Use `run.agentType` + `run.model` for auto-start payload in `src/lib/hooks/use-task-actions.ts`

### Phase: Tests
- [x] Update `src/lib/hooks/__tests__/use-task-actions.test.ts` to cover auto-start create flow

## Key Files
- `src/components/tasks/create-task-form.tsx` - add implementation picker for no-plan create
- `src/components/tasks/create-task-modal.tsx` - pass run selection props
- `src/routes/tasks/_page.tsx` - wire run state to create form
- `src/lib/hooks/use-task-actions.ts` - auto-start implementation after create
- `src/lib/hooks/__tests__/use-task-actions.test.ts` - cover auto-start flow

## Success Criteria
- [x] Create with Plan with AI off shows implementation agent/model picker
- [x] Creating no-plan task auto-starts implementation with selected agent/model
- [x] Plan-with-AI create still spawns planning session, no auto-start regression

## Open Questions
- Should no-plan create expose an auto-run toggle or always auto-start?
- Should auto-run chain to verify for no-plan tasks via `<!-- autoRun: true -->`?
- Persist selected run agent/model to task metadata or keep UI-only?
