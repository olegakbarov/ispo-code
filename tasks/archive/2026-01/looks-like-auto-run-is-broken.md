# looks like auto-run is broken

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Auto-run does not advance from implementation to verification after implementation sessions complete.
- **Immediate Cause**: Auto-run phase detection ignores `Run:` titles (implementation sessions are titled `Run: ...`), so the verification trigger never fires even when status transitions to completed.
- **Call Chain**: `assignToAgent` spawns `Run: <title>` session -> `useTaskActions` auto-run effect checks phase via `includes('implement'|'execution')` -> phase unresolved -> no `handleStartVerify` call.
- **Original Trigger**: Mismatch between session title prefixes (`Run:`) and auto-run phase heuristics.
- **Evidence**: `src/trpc/tasks.ts` uses `title: Run: ...` for execution sessions; `src/lib/hooks/use-task-actions.ts` checks only `implement`/`execution` keywords and ignores `run:`.

### Phase 2: Pattern Analysis
- **Working Examples**: `getSessionsForTask` classifies execution sessions via `titleLower.startsWith('run:')` in `src/trpc/tasks.ts`.
- **Key Differences**: Auto-run used title-or-prompt substring checks that never match `Run:`; it also only treated `running/pending` as active statuses.
- **Dependencies**: Auto-run relies on `agentSession` status, the task file autoRun flag, and title/prompt strings for phase classification.

### Phase 3: Hypothesis & Testing
- **Hypothesis**: Auto-run misses implementation completion because phase detection ignores `Run:` titles; updating detection to recognize `run:` should fix verification auto-trigger.
- **Test Design**: Add a unit test for a shared `inferAutoRunPhase` helper that expects `Run: <title>` to classify as `execution` (single variable: title prefix).
- **Prediction**: Current logic returns `null` for `Run:` titles, so the test should fail before the fix and pass after.
- **Result**: Test failed as expected (`inferAutoRunPhase('Run: Add dark mode toggle', 'prompt')` returned `null`).
- **Conclusion**: Phase detection needs to handle `Run:` titles (and should be shared across call sites).

### Phase 4: Implementation
- **Root Cause**: Auto-run phase heuristics did not recognize `Run:` titles and only checked title OR prompt.
- **Solution**: Introduced a shared `inferAutoRunPhase` helper that checks combined title+prompt and recognizes `run:`; auto-run now uses this helper and treats more active statuses as eligible for transition.
- **Test Case**: `src/lib/tasks/auto-run.test.ts` covers `Run:` classification to `execution`.
- **Verification**: `npm run test:run -- src/lib/tasks/auto-run.test.ts`.
- **Changes Made**:
  - `src/lib/tasks/auto-run.ts` added shared auto-run parsing/classification.
  - `src/lib/tasks/auto-run.test.ts` added regression test for `Run:` detection.
  - `src/lib/hooks/use-task-actions.ts` now uses shared helper and expanded active-status check.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
