# verify should also run tests

## Problem Statement
Verify sessions completing without tests; verification lacks test evidence.
Need test execution in verify to catch regressions and report results.

## Scope
**In:**
- Always run repo test command during verify
- Explicit test command discovery in verify prompt
- Test-result note in verification output

**Out:**
- Review mode prompt changes
- CI or pipeline changes
- Changes to test suite content

## Implementation Plan

### Phase: Verify Prompt
- [x] Update `buildTaskVerifyPrompt` in `src/trpc/tasks.ts` to require test run for every verify
- [x] Add instruction to read `package.json` scripts and run `test:run` or `test` in `src/trpc/tasks.ts`
- [x] Require test output summary in verify results in `src/trpc/tasks.ts`

### Phase: Coverage
- [x] Add prompt string test in `src/lib/tasks/verify-prompt.test.ts`

## Key Files
- `src/lib/tasks/verify-prompt.ts` - extracted verify prompt builder (new file)
- `src/trpc/tasks.ts` - imports verify prompt from new module
- `src/lib/tasks/verify-prompt.test.ts` - prompt coverage

## Success Criteria
- [x] Verify prompt explicitly requires running tests every time
- [x] Verify output includes test run result note
- [x] Prompt test passes

## Unresolved Questions
- Preferred default test command when multiple scripts exist
- Skip tests for large suites or always run full suite
