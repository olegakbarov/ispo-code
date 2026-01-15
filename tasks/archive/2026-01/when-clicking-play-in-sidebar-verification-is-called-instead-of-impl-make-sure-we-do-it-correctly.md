# when clicking play in sidebar verification is called instead of impl. make sure we do it correctly

## Investigation Findings

### Phase 1: Root Cause Investigation

- **Symptom**: Clicking the play button in the task list sidebar runs verification instead of implementation when a task has some checkboxes completed.

- **Immediate Cause**: The task list action logic previously treated `done > 0 && done < total` as "needs verification," which routed `handleAction` to `onRunVerify` instead of `onRunImpl`. This is the wrong heuristic for partial progress.

- **Call Chain**:
  1. User clicks the play button in the task list sidebar.
  2. `TaskItem.handleAction` evaluates progress-based action selection.
  3. `onRunVerify(task.path)` is invoked for partial progress.
  4. `handleRunVerify` calls `verifyWithAgentMutation.mutate()` → `trpc.tasks.verifyWithAgent`.

- **Original Trigger**: `task.progress` is derived from **all** markdown checkboxes, so partial completion does not imply implementation is done. The heuristic "some done → verify" is invalid for these task files.

- **Evidence**:
  - Progress counts any `- [x]` in the task file (`parseProgressFromMarkdown` in `src/lib/agent/task-service.ts:131-146`).
  - Verification is wired in the task list sidebar via `verifyWithAgentMutation` and `handleRunVerify` (`src/components/tasks/task-list-sidebar.tsx:324-354`).

### Phase 2: Pattern Analysis

- **Working Example (Task Page Sidebar)**: `src/components/tasks/task-sidebar.tsx` exposes explicit buttons for Review, Implement, and Verify. Users choose the action directly; no heuristic is applied.

- **Broken Example (Task List Sidebar)**: The single play button auto-selected verification based on partial progress, which is ambiguous because progress counts all checkboxes, not just implementation tasks.

- **Key Differences**:
  1. Task page gives explicit control; task list inferred intent from progress.
  2. Task list assumed "some done" implies verification-ready.
  3. Progress data is coarse (checkbox count), so inference is unreliable.

- **Dependencies**:
  - `assignToAgentMutation` → `trpc.tasks.assignToAgent` (implementation)
  - `verifyWithAgentMutation` → `trpc.tasks.verifyWithAgent` (verification)
  - `task.progress` comes from `parseProgressFromMarkdown` (checkbox counts)

- **Correct Behavior Should Be**:
  - Any incomplete task (`done < total` or `total === 0`) → run implementation
  - Only fully complete tasks (`done === total && total > 0`) → navigate to review/commit

### Phase 3: Hypothesis & Testing

- **Hypothesis**: The play button routes to verification because partial progress is treated as verification-ready. If we classify any incomplete task as implementation, the play button will no longer trigger verify.

- **Test Design**: Add a pure helper (`getTaskListAction`) and unit tests that cover:
  - no checklist (total = 0)
  - partial completion (done < total)
  - full completion (done === total)

- **Prediction**: Partial completion returns "implement" and full completion returns "review".

- **Result**: `vitest run src/components/tasks/task-list-action.test.ts` passes (5 tests). Partial progress returns "implement" as expected.

- **Conclusion**: Hypothesis confirmed; the action selection should never route to verify for partial completion.

### Phase 4: Implementation

- **Root Cause**: Partial progress (done > 0 && done < total) was treated as verification-ready, which is incorrect because progress counts all checkboxes.

- **Solution**: Centralized action selection in a helper that returns only "implement" for incomplete tasks and "review" when fully complete, then wired the sidebar button to that helper.

- **Test Case**: `src/components/tasks/task-list-action.test.ts` exercises partial and complete progress cases.

- **Verification**: `npm run test:run -- src/components/tasks/task-list-action.test.ts` (passes; one route-file warning unrelated to this change).

- **Changes Made**:
  - `src/components/tasks/task-list-action.ts`: new helper for action selection and labels.
  - `src/components/tasks/task-list-sidebar.tsx`: uses helper to drive play button behavior and title.
  - `src/components/tasks/task-list-action.test.ts`: new unit coverage for action selection.

## Success Criteria
- [x] Root cause identified and documented
  - Verified: Root cause and checkbox-based progress derivation confirmed in `src/lib/agent/task-service.ts:131`.
- [x] Fix addresses root cause (not symptoms)
  - Verified: Action selection returns `implement` unless fully complete in `src/components/tasks/task-list-action.ts:8`, and the sidebar play button uses it in `src/components/tasks/task-list-sidebar.tsx:82`.
- [x] Test created reproducing bug
  - Verified: Partial-completion expectation exists in `src/components/tasks/task-list-action.test.ts:9`.
- [ ] All tests pass
  - Not verified: `npm run test:run` reports 6 failures in `src/lib/agent/manager.test.ts` (resume attempt assertion, missing module, connection/worktree errors).

## Verification Results
- Tests: `npm run test:run` failed (6 failures) in `src/lib/agent/manager.test.ts`; targeted `npm run test:run -- src/components/tasks/task-list-action.test.ts` passed (5 tests).
- Warnings: vitest route-file warning for `src/routes/tasks/_page.tsx` and a `punycode` deprecation warning during test runs.
- Notes: test stderr included MCP validator JSON error and worktree creation errors; may be environment-related.
- Code checks: helper and sidebar wiring verified in `src/components/tasks/task-list-action.ts:8` and `src/components/tasks/task-list-sidebar.tsx:82`.