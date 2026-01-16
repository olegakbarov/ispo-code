# auto-run doesn't seem to work

## Investigation Findings

### Phase 1: Root Cause Investigation
-- **Symptom**: Auto-run does not advance from implementation to verification after execution sessions complete.
- **Immediate Cause**: Auto-run verification gate relies on `taskSessions.grouped.execution` to confirm completion; this list often lags behind the live session status, so the check fails and verification is skipped.
- **Call Chain**: `useTaskAgentActions` auto-run effect → `inferAutoRunPhase` returns `execution` → `hasCompletedExecution` computed from `taskSessions.grouped.execution` → false → early return → no `handleStartVerify`.
- **Original Trigger**: `taskSessions` polling (5s) updates slower than `agentSession` live status (1s), so the completion transition can occur before the grouped session list marks the execution session as completed.
- **Evidence**: `src/lib/hooks/use-task-agent-actions.ts` checks `taskSessions?.grouped?.execution` before triggering verification; unit test shows `hasCompletedExecutionSession([], 'completed')` returns false under current logic, reproducing the skip.

### Phase 2: Pattern Analysis
- **Working Examples**: `agentSession.status` from the live session reflects completion immediately; phase detection via `inferAutoRunPhase` uses the session title and works for `Run:` titles.
- **Key Differences**: Auto-run verification uniquely depends on `taskSessions.grouped.execution` (polled) while planning→implementation uses only live session status and title.
- **Dependencies**: Auto-run verification depends on live status (`agentSession.status`), session title for phase detection, and the grouped execution list (currently used as a gate).

### Phase 3: Hypothesis & Testing
- **Hypothesis**: Verification auto-run is skipped because the completion gate trusts the grouped execution list, which can be empty/stale when the live session already reports `completed`.
- **Test Design**: Add `hasCompletedExecutionSession` helper mirroring current gate logic; create a unit test where `executionSessions` is empty but `currentStatus` is `completed`.
- **Prediction**: Test should fail (helper returns `false`) because the current logic ignores `currentStatus`.
- **Result**: Test failed as expected: `hasCompletedExecutionSession([], 'completed')` returned `false`.
- **Conclusion**: Hypothesis confirmed; the gate is too strict and ignores the live completion signal.

### Phase 4: Implementation
- **Root Cause**: Verification auto-run was gated on `taskSessions.grouped.execution` reporting a completed session, which can lag behind the live session status and block the transition.
- **Solution**: Treat the live `currentStatus === 'completed'` as sufficient completion evidence via `hasCompletedExecutionSession`, so stale grouped data does not block verification.
- **Test Case**: `hasCompletedExecutionSession([], 'completed')` returns true (covers stale/empty grouped sessions).
- **Verification**: `npm run test:run -- src/lib/tasks/auto-run.test.ts`.
- **Changes Made**: `src/lib/tasks/auto-run.ts` added completion helper; `src/lib/hooks/use-task-agent-actions.ts` uses helper; `src/lib/tasks/auto-run.test.ts` adds regression test.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
