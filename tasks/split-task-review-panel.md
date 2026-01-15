# Split task-review-panel.tsx

**Priority**: High
**Category**: Component Architecture

## Problem

`src/components/tasks/task-review-panel.tsx` is 743 lines with mixed concerns:
- File selection logic
- Commit mutation handling
- Diff viewing state management
- Git status queries
- Task session grouping
- Commit history display
- Archive/restore buttons

## Impact

- Difficult to test individual features
- High cognitive load
- Hard to debug issues
- Poor maintainability

## Proposed Split

1. **CommitPanel** (lines 652-711)
   - Commit form, message input, file selection checkboxes
   - Extract to `src/components/tasks/commit-panel.tsx`

2. **FileListPanel** (lines 472-651)
   - Changed files list with selection state
   - Extract to `src/components/tasks/file-list-panel.tsx`

3. **CommitHistorySection** (lines 558-649)
   - Commit history display
   - Extract to `src/components/tasks/commit-history.tsx`

4. **TaskSessionTabs** (session grouping logic)
   - Planning/review/verify/execution tabs
   - Extract to `src/components/tasks/session-tabs.tsx`

## Files

- `src/components/tasks/task-review-panel.tsx` (refactor)
- New: `commit-panel.tsx`, `file-list-panel.tsx`, `commit-history.tsx`, `session-tabs.tsx`
