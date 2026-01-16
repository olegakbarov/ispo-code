# investigate duplicate file rendered on review page

<!-- autoRun: true -->

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Review page file list shows the same file more than once with identical display paths.
- **Immediate Cause**: `getReviewData` aggregates files using `file.path` as the dedupe key, so the same repo-relative file is kept multiple times when sessions report different raw paths.
- **Call Chain**: `TaskReviewPanel` -> `trpc.tasks.getReviewData` -> `changedFiles` -> `uncommittedFiles` -> `FileListPanel` render.
- **Original Trigger**: Sessions emit edited files with different `path` values for the same file (absolute vs relative paths or differing worktree roots).
- **Evidence**: `src/trpc/tasks.ts` uses `allFiles.get(file.path)` while the UI displays `repoRelativePath`/`relativePath` in `src/components/tasks/file-list-panel.tsx`, so duplicates share the same displayed path.

### Phase 2: Pattern Analysis
- **Working Examples**: `trpc/stats.getFileChanges` normalizes to repo-relative paths; `TaskReviewPanel` and `commit-archive-modal` compare files using `repoRelativePath || relativePath || path`.
- **Key Differences**: `getReviewData` dedupes by raw `file.path`, while the rest of the review flow treats repo-relative paths as canonical identifiers.
- **Dependencies**: `EditedFileInfo` path formats (absolute vs relative), `calculateRelativePaths`, and worktree resolution (`getWorktreeForSession`, `isWorktreeIsolationEnabled`).

### Phase 3: Hypothesis & Testing
- **Hypothesis**: Duplicate entries appear because `getReviewData` dedupes by raw `path` instead of repo-relative path.
- **Test Design**: Add a unit test that feeds two sessions with the same `repoRelativePath` but different `path` values (absolute vs relative) and expects a single entry using the newer timestamp.
- **Prediction**: Current implementation returns two entries; after fixing the dedupe key, it returns one.
- **Result**: Test failed before the fix: `changedFiles` length was 2 instead of 1 (vitest failure in `src/trpc/__tests__/tasks-get-review-data.test.ts`).
- **Conclusion**: Hypothesis confirmed; dedupe key needs to use repo-relative path.

### Phase 4: Implementation
- **Root Cause**: `getReviewData` (and related aggregation) used raw `file.path` as the key, so mixed absolute/relative/worktree paths produced duplicate list entries for the same repo-relative file.
- **Solution**: Deduplicate by repo-relative path (`repoRelativePath || relativePath || path`) and store that as the canonical `repoRelativePath` in the aggregated output.
- **Test Case**: `src/trpc/__tests__/tasks-get-review-data.test.ts` validates dedupe when paths differ but repo-relative path matches.
- **Verification**: `npx vitest run --root /Users/venge/Code/ispo-code/.ispo-code/worktrees/2be825ced63d src/trpc/__tests__/tasks-get-review-data.test.ts`.
- **Changes Made**: Updated aggregation in `src/trpc/tasks.ts`; added test in `src/trpc/__tests__/tasks-get-review-data.test.ts`.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
