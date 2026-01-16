# planning process should have a checkbox to include questions for users to sharpen plan based on them on second iteration

<!-- autoRun: true -->

## Problem Statement
Missing optional clarifying questions in AI plan flow. Need toggle to ask questions and refine plan after user answers.

## Scope
**In:**
- Create-task checkbox in `src/components/tasks/create-task-form.tsx`
- Create state + payload propagation in `src/lib/stores/tasks-reducer.ts`, `src/lib/hooks/use-task-create-actions.ts`
- Conditional plan prompt for questions in `src/trpc/tasks.ts`

**Out:**
- Debug task planning prompts in `src/trpc/tasks.ts`
- New persisted settings in `src/lib/stores/settings.ts`
- New answer UI outside `src/routes/agents/$sessionId.tsx`

## Implementation Plan

### Phase: State + UI
- [x] Add `includeQuestions` to create state + reducer action in `src/lib/stores/tasks-reducer.ts`
  - Verified: `src/lib/stores/tasks-reducer.ts:44` defines `includeQuestions`, `src/lib/stores/tasks-reducer.ts:208` sets default, `src/lib/stores/tasks-reducer.ts:312` handles `SET_CREATE_INCLUDE_QUESTIONS`.
- [x] Add includeQuestions prop + checkbox UI in `src/components/tasks/create-task-form.tsx`
  - Verified: `src/components/tasks/create-task-form.tsx:43` adds prop, `src/components/tasks/create-task-form.tsx:192` renders checkbox with handler.
- [x] Pass includeQuestions props/handlers in `src/components/tasks/create-task-modal.tsx`
  - Verified: `src/components/tasks/create-task-modal.tsx:31` defines prop, `src/components/tasks/create-task-modal.tsx:130` passes through to `CreateTaskForm`.
- [x] Wire includeQuestions state/dispatch in `src/routes/tasks/_page.tsx`
  - Verified: `src/routes/tasks/_page.tsx:387` passes `includeQuestions`, `src/routes/tasks/_page.tsx:400` dispatches `SET_CREATE_INCLUDE_QUESTIONS`.

### Phase: API + Prompt
- [x] Add includeQuestions to `createWithAgent` input schema in `src/trpc/tasks.ts`
  - Verified: `src/trpc/tasks.ts:783` includes `includeQuestions` with default false.
- [x] Pass includeQuestions in create-with-agent payload in `src/lib/hooks/use-task-create-actions.ts`
  - Verified: `src/lib/hooks/use-task-create-actions.ts:152` sends `includeQuestions` in `createWithAgentMutation`.
- [x] Update `buildTaskExpansionPrompt` for question flow in `src/trpc/tasks.ts`
  - Verified: `src/trpc/tasks.ts:373` gates question flow, `src/trpc/tasks.ts:384` includes AskUserQuestion instructions.

### Phase: Tests
- [x] Update create-with-agent expectations in `src/lib/hooks/__tests__/use-task-create-actions.test.ts`
  - Verified: `src/lib/hooks/__tests__/use-task-create-actions.test.ts:527` and `src/lib/hooks/__tests__/use-task-create-actions.test.ts:570` assert includeQuestions false/true.

## Key Files
- `src/components/tasks/create-task-form.tsx` - checkbox UI
- `src/components/tasks/create-task-modal.tsx` - props wiring
- `src/routes/tasks/_page.tsx` - create state dispatch
- `src/lib/stores/tasks-reducer.ts` - create modal state/action
- `src/lib/hooks/use-task-create-actions.ts` - mutation payload
- `src/trpc/tasks.ts` - input schema + prompt logic
- `src/lib/hooks/__tests__/use-task-create-actions.test.ts` - assertions

## Success Criteria
- [x] Checkbox appears for AI planning and toggles create state
  - Verified: checkbox UI in `src/components/tasks/create-task-form.tsx:192` and state dispatch in `src/routes/tasks/_page.tsx:400` with reducer update in `src/lib/stores/tasks-reducer.ts:312`.
- [x] createWithAgent receives includeQuestions and prompt changes only when true
  - Verified: payload includes `includeQuestions` in `src/lib/hooks/use-task-create-actions.ts:152` and prompt gating in `src/trpc/tasks.ts:373` (schema default in `src/trpc/tasks.ts:783`).
- [x] Planning session asks questions then writes revised plan after user reply
  - Verified: prompt instructs AskUserQuestion + wait + write refined plan in `src/trpc/tasks.ts:384` (prompt-level behavior).

## Unresolved Questions
- Default checkbox state or remember last?
- Apply to bug planning flow too?
- Required question count/format for AskUserQuestion?

## Verification Results

### Test Results
- FAIL: 8 tests failed (npm run test:run)
- Failures in `src/lib/agent/manager.test.ts` and `src/lib/tasks/create-task-visibility.test.ts`

### Item Verification
- Verified: Add includeQuestions to create state + reducer action
- Verified: Add includeQuestions prop + checkbox UI
- Verified: Pass includeQuestions props/handlers in create-task-modal
- Verified: Wire includeQuestions state/dispatch in tasks page
- Verified: Add includeQuestions to createWithAgent input schema
- Verified: Pass includeQuestions in create-with-agent payload
- Verified: Update buildTaskExpansionPrompt for question flow
- Verified: Update create-with-agent expectations in tests
- Verified: Checkbox appears for AI planning and toggles create state
- Verified: createWithAgent receives includeQuestions and prompt changes only when true
- Verified: Planning session asks questions then writes revised plan after user reply (prompt-level)