# verification should not be ran without implementation

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Auto-run starts verification even when no new implementation has run (e.g., after debug/planning sessions complete).
- **Immediate Cause**: `use-task-actions` triggers `handleStartVerify` when `inferAutoRunPhase(...)` returns `execution`.
- **Call Chain**: `src/lib/hooks/use-task-actions.ts` auto-run effect -> `inferAutoRunPhase` -> `handleStartVerify` -> `verifyWithAgentMutation` -> `trpc.tasks.verifyWithAgent`.
- **Original Trigger**: `inferAutoRunPhase` inspects title+prompt and treats any prompt containing `implement` as execution; debug prompts include "Implementation Steps" and multi-agent titles use `Debug (N):`, which are not matched by the current `debug:` check.
- **Evidence**: `src/lib/tasks/auto-run.ts` uses `signature.includes('implement')`; `src/trpc/tasks.ts` sets debug titles to `Debug (${i + 1}): ...` and the debug prompt includes "Implementation Steps".

### Phase 2: Pattern Analysis
- **Working Examples**: Session-type detection in `src/trpc/tasks.ts` uses title prefixes and explicitly handles `Debug (N):` via regex for planning sessions.\n- **Key Differences**: `inferAutoRunPhase` relies on `includes('implement')` across title+prompt and does not recognize `Debug (N):`, so non-execution prompts can be misclassified as execution.\n- **Dependencies**: Auto-run depends on session title conventions (`Plan:`, `Debug:`, `Debug (N):`, `Run:`) and on `taskSessions.grouped.execution` for the verification guard.

### Phase 3: Hypothesis & Testing
- **Hypothesis**: `inferAutoRunPhase` misclassifies non-Run sessions as `execution` because it scans prompt text for `implement`, so auto-run can trigger verification without a fresh implementation.\n- **Test Design**: Add unit tests to `src/lib/tasks/auto-run.test.ts` that expect `Debug (N):` titles to map to `planning` and `Verify:` titles to map to `null` even if the prompt contains \"Implementation\".\n- **Prediction**: Tests fail on current code because `inferAutoRunPhase` returns `execution` for both cases.\n- **Result**: Tests failed; `inferAutoRunPhase` returned `execution` for `Debug (2): ...` and `Verify: ...` when prompt included \"implement\".\n- **Conclusion**: Hypothesis confirmed; prompt-based matching causes false execution classification.

### Phase 4: Implementation
- **Root Cause**: Auto-run phase detection used prompt-wide `implement` matching and missed `Debug (N):` titles, so non-execution sessions could be treated as `execution` and trigger verification.\n- **Solution**: Restrict `inferAutoRunPhase` to title-prefix matching (`Plan:`, `Debug:`, `Debug (N):`, `Run:`) and ignore prompt text.\n- **Test Case**: Added unit tests in `src/lib/tasks/auto-run.test.ts` for `Debug (N):` planning classification and `Verify:` not becoming execution when prompt contains \"implement\".\n- **Verification**: `npx vitest run src/lib/tasks/auto-run.test.ts`.\n- **Changes Made**: `src/lib/tasks/auto-run.ts` updated phase inference; `src/lib/tasks/auto-run.test.ts` added regression coverage.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
