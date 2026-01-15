# codex must be default model for verification

## Plan

- [x] Define scope
  - ✓ Verified: Scope clearly defined in task document
- [x] Implement
  - ✓ Verified: All implementation changes are present and correct:
    - `src/lib/stores/tasks-reducer.ts:38-41` - `VerifyAgentState` interface defined
    - `src/lib/stores/tasks-reducer.ts:78` - `verify` property added to `TasksState`
    - `src/lib/stores/tasks-reducer.ts:159-162` - Initial state sets `agentType: 'codex'` and `model: getDefaultModelId('codex')`
    - `src/lib/stores/tasks-reducer.ts:111-112` - Actions `SET_VERIFY_AGENT_TYPE` and `SET_VERIFY_MODEL` defined
    - `src/lib/stores/tasks-reducer.ts:258-268` - Reducer cases handle verify actions correctly
    - `src/routes/tasks/_page.tsx:119` - `verify` state destructured from reducer
    - `src/routes/tasks/_page.tsx:177-180` - Handler `handleVerifyAgentTypeChange` created
    - `src/routes/tasks/_page.tsx:214-224` - Sync hook with codex-first preferred order `['codex', 'claude', 'cerebras', 'opencode', 'gemini']`
    - `src/routes/tasks/_page.tsx:1273-1274` - ReviewModal receives `verify.agentType` and `verify.model` props
    - `src/components/tasks/review-modal.tsx:17-18,28-29` - ReviewModal accepts and uses separate agentType/model props
- [x] Validate
  - ✓ Verified: Build succeeds without errors (TypeScript compilation passes for main code)
  - ✓ Verified: Production build completes successfully (`npm run build` exits cleanly)
  - ⚠️ Note: Test file TypeScript errors exist but are unrelated to this task (missing vitest types)

## Scope

Currently verification uses shared `run` state (defaulting to claude). Need to:
1. Add separate `verify` state in tasks-reducer with codex default
2. Update ReviewModal props to use verify state when in verify mode
3. Add actions to modify verify agent type/model separately

## Implementation

Changes made:
- `src/lib/stores/tasks-reducer.ts`: Added `VerifyAgentState` interface, `verify` state with codex default, actions for `SET_VERIFY_AGENT_TYPE` and `SET_VERIFY_MODEL`
- `src/routes/tasks/_page.tsx`: Destructure `verify` state, added handler and sync hook with codex-first preferred order, updated ReviewModal to use `verify.agentType` and `verify.model`

## Validation

- TypeScript compiles without errors (aside from unrelated test file issues)
- Build succeeds

## Verification Results

**Status**: ✅ ALL ITEMS VERIFIED

All three checklist items are correctly implemented:
1. **Scope defined** - Clear and accurate
2. **Implementation complete** - All code changes are present, correct, and follow best practices:
   - Separate `verify` state properly isolated from `run` state
   - Codex correctly set as default via `agentType: 'codex'` and `getDefaultModelId('codex')`
   - Proper Redux-style actions and reducer cases
   - UI correctly wired to use verify state
   - Sync hook prioritizes codex first in fallback order
3. **Validation confirmed** - Build passes, TypeScript compiles (test file errors are pre-existing)

**Key Implementation Details Verified**:
- State initialization: `src/lib/stores/tasks-reducer.ts:159-162`
- Preferred order: `src/routes/tasks/_page.tsx:214-216` - `['codex', 'claude', ...]`
- Props binding: `src/routes/tasks/_page.tsx:1273-1274` - `agentType={verify.agentType}` and `model={verify.model}`

The implementation successfully separates verification agent configuration from run agent configuration, with codex as the default as intended.