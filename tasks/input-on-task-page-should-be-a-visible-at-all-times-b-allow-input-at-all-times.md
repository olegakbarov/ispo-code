# input on task page should be
a) visible at all times
b) allow input at all times

## Problem Statement
Input hidden when agent session active; footer blocks pointer events. Textarea disabled during rewrite. Always-on input not possible.

## Scope
**In:**
- Footer visibility + interactivity in `src/components/tasks/task-footer.tsx`
- Task input props in `src/components/tasks/task-footer.tsx`

**Out:**
- Review/debate layouts in `src/routes/tasks/_page.tsx`
- Backend agent session flow in `src/lib/hooks/use-task-agent-actions.ts`

## Implementation Plan

### Phase: Visibility
- [x] Remove `agentSession` early-return in `src/components/tasks/task-footer.tsx`
  - Verified: no `agentSession` prop/guard and TaskFooter always returns `TaskInput` (`src/components/tasks/task-footer.tsx:12`, `src/components/tasks/task-footer.tsx:143`)
- [x] Drop `pointer-events-none` from footer container in `src/components/tasks/task-footer.tsx`
  - Verified: footer `containerClassName` has no `pointer-events-none` (`src/components/tasks/task-footer.tsx:160`)

### Phase: Interactivity
- [x] Stop passing `disabled={isRewriting}` to `TaskInput` in `src/components/tasks/task-footer.tsx`
  - Verified: `TaskFooter` does not pass `disabled`; `TaskInput` defaults to `disabled = false` (`src/components/tasks/task-footer.tsx:143`, `src/components/tasks/task-input.tsx:39`)

## Key Files
- `src/components/tasks/task-footer.tsx` - footer render + input props

## Success Criteria
- [x] Footer visible while agent session active
  - Verified: render only gated by edit mode, with no `agentSession` condition (`src/routes/tasks/_page.tsx:490`, `src/components/tasks/task-footer.tsx:31`)
- [x] Textarea accepts typing during rewrite
  - Verified: input `disabled` only when prop set; TaskFooter does not set it (`src/components/tasks/task-footer.tsx:143`, `src/components/tasks/task-input.tsx:79`)
- [x] Footer controls clickable
  - Verified: no `pointer-events-none` on footer container (`src/components/tasks/task-footer.tsx:160`)

## Unresolved Questions
1. Should footer also render in review/debate modes in `src/routes/tasks/_page.tsx`?

## Implementation Notes
- Removed `agentSession` prop entirely since it was only used for the early-return
- Also cleaned up the unused `AgentSession` import and prop from `TaskFooterProps` interface
- Updated call site in `src/routes/tasks/_page.tsx` to no longer pass `agentSession`

## Verification Results

### Test Results
FAIL 2 test files failed, 8 tests failed (npm run test:run)
- `src/lib/agent/manager.test.ts` (6 failed)
- `src/lib/tasks/create-task-visibility.test.ts` (2 failed)
Verification incomplete due to failing tests.

### Item Verification
- PASS Remove `agentSession` early-return (`src/components/tasks/task-footer.tsx:12`, `src/components/tasks/task-footer.tsx:143`)
- PASS Drop `pointer-events-none` (`src/components/tasks/task-footer.tsx:160`)
- PASS Stop passing `disabled={isRewriting}` (`src/components/tasks/task-footer.tsx:143`, `src/components/tasks/task-input.tsx:39`)
- PASS Footer visible while agent session active (`src/routes/tasks/_page.tsx:490`, `src/components/tasks/task-footer.tsx:31`)
- PASS Textarea accepts typing during rewrite (`src/components/tasks/task-footer.tsx:143`, `src/components/tasks/task-input.tsx:79`)
- PASS Footer controls clickable (`src/components/tasks/task-footer.tsx:160`)

Skill Usage: react-best-practices (React component verification); web-design-guidelines not used (no UI audit requested).