# improve verification process. agent should better highlight inconsistencies and provide actionable insights

## Problem Statement
Verification output hides mismatches between checked items and evidence. Missing explicit inconsistency callouts and next-step guidance.

## Scope
**In:**
- Verification prompt structure and output format in `src/lib/tasks/verify-prompt.ts`
- Verification prompt tests in `src/lib/tasks/verify-prompt.test.ts`
**Out:**
- Review UI changes in `src/components/tasks/task-review-panel.tsx`
- Session post-processing behavior in `src/daemon/agent-daemon.ts`

## Implementation Plan

### Phase: Prompt
- [x] Require "Inconsistencies" section with expected vs observed evidence in `src/lib/tasks/verify-prompt.ts`
- [x] Require "Actionable Fixes" section with file/line guidance in `src/lib/tasks/verify-prompt.ts`
- [x] Update example output to show inconsistency plus fix in `src/lib/tasks/verify-prompt.ts`

### Phase: Tests
- [x] Assert new sections in `src/lib/tasks/verify-prompt.test.ts`
- [x] Assert example includes actionable fix pattern in `src/lib/tasks/verify-prompt.test.ts`

## Key Files
- `src/lib/tasks/verify-prompt.ts` - prompt structure, output requirements, example
- `src/lib/tasks/verify-prompt.test.ts` - prompt expectations

## Success Criteria
- [x] Prompt includes "Inconsistencies" and "Actionable Fixes" requirements in `src/lib/tasks/verify-prompt.ts`
- [x] Tests cover new sections in `src/lib/tasks/verify-prompt.test.ts`

## Unresolved Questions
- Actionable fixes as new unchecked items in task file?
- Fail verification when inconsistencies found?
