# new task default agent should be Claude Code

## Investigation Findings

### Phase 1: Root Cause Investigation

- **Symptom**: When creating a new task, the default agent is Cerebras GLM instead of Claude Code
- **Immediate Cause**: Hardcoded default values in state initialization
- **Call Chain**:
  1. User opens "Create Task" modal
  2. `TasksPage` component renders with initial state
  3. `createAgentType` useState defaults to `'cerebras'`
  4. `createModel` useState defaults to `getDefaultModelId('cerebras')`
- **Original Trigger**: `src/routes/tasks/_page.tsx` lines 132-133:
  ```typescript
  const [createAgentType, setCreateAgentType] = useState<PlannerAgentType>('cerebras')
  const [createModel, setCreateModel] = useState(() => getDefaultModelId('cerebras'))
  ```
- **Evidence**:
  - Line 132: Default is explicitly `'cerebras'`
  - Line 136: Interestingly, `runAgentType` (for executing tasks) correctly defaults to `'claude'`
  - Line 115: `availablePlannerTypes` list also starts with `'cerebras'`: `['cerebras', 'opencode', 'claude', 'codex']`

**Inconsistency Found**: The code has inconsistent defaults:
- Task creation: defaults to `'cerebras'`
- Task execution ("Run with Agent"): defaults to `'claude'`
- Rewrite agent: defaults to `'claude'`

This inconsistency suggests the task creation default was likely set to Cerebras for testing and never updated to match the intended default (Claude Code).

### Phase 2: Pattern Analysis

- **Working Examples**:
  - `runAgentType` (line 136) correctly defaults to `'claude'`
  - `rewriteAgentType` (line 150) correctly defaults to `'claude'`
- **Key Differences**: Only `createAgentType` defaults to `'cerebras'`
- **Dependencies**:
  - `getDefaultModelId(agentType)` from model-registry.ts
  - `availablePlannerTypes` array determines fallback order
  - `src/lib/stores/task-state.ts` also has `createAgentType` default

### Phase 3: Hypothesis & Testing

- **Hypothesis**: The bug occurs because `createAgentType` is hardcoded to `'cerebras'` instead of `'claude'` when it should match the other agent defaults.
- **Test Design**: Change default from `'cerebras'` to `'claude'` in all locations
- **Prediction**: After the change, new task creation will default to Claude Code agent
- **Result**: TypeScript compilation passes without new errors
- **Conclusion**: Hypothesis confirmed - straightforward default value fix

### Phase 4: Implementation

- **Root Cause**: Hardcoded `'cerebras'` default in task creation state initialization across two files
- **Solution**: Change default agent type from `'cerebras'` to `'claude'` in all locations
- **Changes Made**:
  1. `src/routes/tasks/_page.tsx:132` - Changed `useState<PlannerAgentType>('cerebras')` to `'claude'`
  2. `src/routes/tasks/_page.tsx:133` - Changed `getDefaultModelId('cerebras')` to `getDefaultModelId('claude')`
  3. `src/routes/tasks/_page.tsx:115` - Updated `availablePlannerTypes` order from `['cerebras', 'opencode', 'claude', 'codex']` to `['claude', 'codex', 'cerebras', 'opencode']`
  4. `src/lib/stores/task-state.ts:80` - Changed `createAgentType: 'cerebras'` to `'claude'`

- **Verification**: TypeScript type checking passes (no new errors introduced)

## Success Criteria
- [x] Root cause identified and documented
  - Verified: Root cause analysis documented in `tasks/new-task-default-agent-should-be-claude-code.md:5`.
- [x] Fix addresses root cause (not symptoms)
  - Verified: Defaults updated to `'claude'` in `src/routes/tasks/_page.tsx:132` and `src/routes/tasks/_page.tsx:133`, plus planner type order in `src/routes/tasks/_page.tsx:114`.
  - Verified: Store default `createAgentType` is `'claude'` in `src/lib/stores/task-state.ts:80`.
- [ ] Test created reproducing bug (manual verification required - UI change)
- [ ] All type checks pass
  - Failed: `node_modules/.bin/tsc -p tsconfig.json --noEmit` reports missing `vitest` types in `src/lib/agent/manager.test.ts:12` and `src/lib/trpc-session.test.ts:1`.

## Verification Results
- Verified: Root cause documented and code defaults updated to Claude.
- Failed: Type check does not pass due to missing `vitest` module types.
- Not verified: No reproducing test added (item remains unchecked).