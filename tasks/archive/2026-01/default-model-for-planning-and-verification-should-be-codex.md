# default model for planning and verification should be codex

## Problem Statement
Planning (create) and verification modals default to Claude. User wants Codex as default for these workflows.

## Scope
**In:**
- Change default agent type for `create` state (planning)
- Change default agent type for `run` state (used by verify modal)
- Change default agent type for `rewrite` state (spec refinement)

**Out:**
- Model registry changes (Codex already has defaults)
- UI component changes (already reads from state)
- tRPC procedure defaults (optional parameter, UI-driven)

## Implementation Plan

### Phase: Update State Defaults
- [x] In `tasks-reducer.ts`, change `create.agentType` from `'claude'` to `'codex'`
- [x] Change `create.model` from `getDefaultModelId('claude')` to `getDefaultModelId('codex')`
- [x] Change `run.agentType` from `'claude'` to `'codex'`
- [x] Change `run.model` from `getDefaultModelId('claude')` to `getDefaultModelId('codex')`
- [x] Change `rewrite.agentType` from `'claude'` to `'codex'`
- [x] Change `rewrite.model` from `getDefaultModelId('claude')` to `getDefaultModelId('codex')`

## Key Files
- `src/lib/stores/tasks-reducer.ts:149-169` - Initial state defaults for create/run/rewrite (updated)

## Success Criteria
- [x] Create task modal defaults to Codex agent + codex-5.2 model
- [x] Verify modal defaults to Codex agent + codex-5.2 model (was already codex)
- [x] Rewrite/refine modal defaults to Codex agent + codex-5.2 model

## Implementation Notes
- `verify` state was already defaulting to Codex, only `create`, `run`, and `rewrite` needed updates
- All changes made in a single edit to `initialTasksState` object at lines 149-169
