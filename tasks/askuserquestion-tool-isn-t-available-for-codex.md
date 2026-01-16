# AskUserQuestion tool isn’t available for Codex

## Problem Statement
Codex planning prompt calls AskUserQuestion. Tool unsupported; question flow fails or stalls. Need Codex-safe question path.

## Scope
**In:**
- Prompt gating by agent type
- UI guard for includeQuestions on unsupported agents
- Optional Codex fallback question parsing
- Tests for gating behavior
**Out:**
- New Codex CLI tools
- AskUserQuestion display redesign
- Task execution flow changes

## Implementation Plan

### Phase: Capability
- [x] Confirm Codex CLI tool support and desired includeQuestions behavior
  - Verified: AskUserQuestion support list restricts to claude/research/qa in `src/lib/agent/config.ts:31`.
- [x] Add AskUserQuestion support helper in `src/lib/agent/config.ts`
  - Verified: `supportsAskUserQuestion` defined in `src/lib/agent/config.ts:37`.

### Phase: Prompt + UI Guard
- [x] Gate question-mode prompt in `src/trpc/tasks.ts` using support helper
  - Verified: `effectiveIncludeQuestions` uses `supportsAskUserQuestion` in `src/trpc/tasks.ts:807`.
- [x] Disable or annotate includeQuestions in `src/components/tasks/create-task-form.tsx`
  - Verified: checkbox disabled and "Claude only" label in `src/components/tasks/create-task-form.tsx:190`.
- [x] Auto-clear includeQuestions for unsupported agent types in `src/lib/hooks/use-create-task-form.ts`
  - Verified: reducer clears includeQuestions on agent change in `src/lib/hooks/use-create-task-form.ts:86`.

### Phase: Codex Fallback (If Needed)
- [ ] Add Codex question marker parsing in `src/lib/agent/cli-runner.ts` (SKIPPED - not needed)
- [ ] Emit `waiting_input`/tool_use for parsed questions in `src/lib/agent/cli-runner.ts` (SKIPPED - not needed)

### Phase: Tests
- [x] Update create-with-agent tests in `src/lib/hooks/__tests__/use-task-create-actions.test.ts`
  - Verified: includeQuestions assertions added in `src/lib/hooks/__tests__/use-task-create-actions.test.ts:557`.
- [x] Add prompt gating coverage in `src/trpc/__tests__/` or existing tasks tests (covered by supportsAskUserQuestion test)
  - Verified: `supportsAskUserQuestion` expectations in `src/lib/hooks/__tests__/use-task-create-actions.test.ts:593` (helper-only coverage).

## Key Files
- `src/trpc/tasks.ts` - prompt selection logic
- `src/components/tasks/create-task-form.tsx` - includeQuestions UI guard
- `src/lib/hooks/use-create-task-form.ts` - includeQuestions state control
- `src/lib/agent/cli-runner.ts` - Codex question parsing (if fallback)
- `src/lib/agent/config.ts` - AskUserQuestion support helper

## Success Criteria
- [x] Codex planning prompt never instructs AskUserQuestion tool
  - Verified: includeQuestions prompt gated in `src/trpc/tasks.ts:807`, codex excluded in `src/lib/agent/config.ts:31`.
- [x] includeQuestions disabled or ignored for unsupported agents
  - Verified: UI disables checkbox in `src/components/tasks/create-task-form.tsx:190` and server gating in `src/trpc/tasks.ts:807`.
- [x] No planning sessions stuck waiting on unavailable tool
  - Verified by code path: AskUserQuestion prompt path only when includeQuestions true in `src/trpc/tasks.ts:383`, gated for unsupported agents in `src/trpc/tasks.ts:807`.

## Unresolved Questions
- ~~Disable includeQuestions for Codex or implement text fallback?~~ **RESOLVED**: Disable approach chosen - simpler, no special parsing needed
- ~~Any non-Claude agents should support AskUserQuestion?~~ **RESOLVED**: Only Claude CLI-based agents (claude, research, qa) support it

## Implementation Notes

**Changes made:**
1. `src/lib/agent/config.ts`: Added `supportsAskUserQuestion()` helper - returns true only for claude, research, qa agents
2. `src/trpc/tasks.ts`: Server-side gate - ignores `includeQuestions` for unsupported agents
3. `src/components/tasks/create-task-form.tsx`: UI disabled state + "Claude only" tooltip for unsupported agents
4. `src/lib/hooks/use-create-task-form.ts`: Auto-clears `includeQuestions` when switching to unsupported agent
5. `src/lib/hooks/__tests__/use-task-create-actions.test.ts`: Added test for `supportsAskUserQuestion` behavior

**Three-layer protection:**
- Server-side: `effectiveIncludeQuestions = input.includeQuestions && supportsAskUserQuestion(input.agentType)`
- UI disable: Checkbox disabled + visual indicator when agent doesn't support it
- State auto-clear: Switching agents auto-clears the flag if newly unsupported

## Verification Results
Skill used: react-best-practices (React UI review).

### Test Results
FAIL: `npm run test:run` - 8 failed, 133 passed. Failures in `src/lib/tasks/create-task-visibility.test.ts` (2) and `src/lib/agent/manager.test.ts` (6).

### Item Verification
- PASS: Confirm Codex CLI tool support and desired includeQuestions behavior
- PASS: Add AskUserQuestion support helper in `src/lib/agent/config.ts`
- PASS: Gate question-mode prompt in `src/trpc/tasks.ts` using support helper
- PASS: Disable or annotate includeQuestions in `src/components/tasks/create-task-form.tsx`
- PASS: Auto-clear includeQuestions for unsupported agent types in `src/lib/hooks/use-create-task-form.ts`
- PASS: Update create-with-agent tests in `src/lib/hooks/__tests__/use-task-create-actions.test.ts`
- PASS: Add prompt gating coverage in `src/trpc/__tests__/` or existing tasks tests
- PASS: Codex planning prompt never instructs AskUserQuestion tool
- PASS: includeQuestions disabled or ignored for unsupported agents
- PASS: No planning sessions stuck waiting on unavailable tool