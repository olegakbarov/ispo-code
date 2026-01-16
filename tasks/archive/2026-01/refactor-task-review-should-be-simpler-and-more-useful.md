# refactor task review. should be simpler and more useful

## Problem Statement
Review mode overloaded: session grouping, selection state, diff/agent tooling.
Hard to scan changes and finish (commit/archive).

## Scope
**In:**
- Simplify review UI in `src/components/tasks/task-review-panel.tsx`
- Flatten file list in `src/components/tasks/file-list-panel.tsx`
- Reduce diff controls in `src/components/git/diff-panel.tsx`
- Align commit file list with review data in `src/components/tasks/commit-archive-modal.tsx`
- Update review URL sync in `src/lib/hooks/use-task-navigation.ts`
**Out:**
- Review/verify modal in `src/components/tasks/review-modal.tsx`
- Task list UI in `src/components/tasks/task-list-sidebar.tsx`
- Agent orchestration in `src/lib/hooks/use-task-actions.ts`
- Non-review endpoints in `src/trpc/tasks.ts`

## Implementation Plan

### Phase: Simplify Review UI
- [x] Remove selection + session expansion state in `src/components/tasks/task-review-panel.tsx`
- [x] Replace session grouping with flat list in `src/components/tasks/file-list-panel.tsx`
- [x] Drop checkboxes and selected counts in `src/components/tasks/file-list-panel.tsx`
- [x] Collapse diff viewer to single-file state in `src/components/tasks/task-review-panel.tsx`
- [x] Hide comment/send controls in `src/components/git/diff-panel.tsx`

### Phase: Review Data + Wiring
- [x] Extend `getReviewData` for commit list needs in `src/trpc/tasks.ts` (already sufficient)
- [x] Use `getReviewData` in `src/components/tasks/commit-archive-modal.tsx`
- [x] Switch commit pregen to review data in `src/lib/hooks/use-task-commit-effects.ts`
- [x] Update reviewFile URL sync for flat list state in `src/lib/hooks/use-task-navigation.ts` (no changes needed)
- [x] Update review props wiring in `src/components/tasks/task-editor.tsx` (no changes needed)

## Key Files
- `src/components/tasks/task-review-panel.tsx` - simplify review state + layout
- `src/components/tasks/file-list-panel.tsx` - flat list, no selection
- `src/components/git/diff-panel.tsx` - minimal review diff UI
- `src/trpc/tasks.ts` - review data shape for commit list
- `src/components/tasks/commit-archive-modal.tsx` - consume review data
- `src/lib/hooks/use-task-commit-effects.ts` - commit pregen data source
- `src/lib/hooks/use-task-navigation.ts` - reviewFile sync
- `src/components/tasks/task-editor.tsx` - review panel wiring

## Success Criteria
- [x] No `selectedFiles` or session expansion state in `src/components/tasks/task-review-panel.tsx`
- [x] `src/components/tasks/file-list-panel.tsx` renders flat list with no checkboxes
- [x] `src/components/git/diff-panel.tsx` hides comment/send controls in review mode
- [x] `src/components/tasks/commit-archive-modal.tsx` uses `getReviewData` for file list
- [x] `src/lib/hooks/use-task-commit-effects.ts` no `getChangedFilesForTask` call

## Unresolved Questions
- Session label in `src/components/tasks/file-list-panel.tsx`, keep or drop?
  - **Decision: Dropped** - session grouping removed entirely for simplicity
- Agent send-from-diff in `src/components/git/diff-panel.tsx`, keep or remove?
  - **Decision: Hidden in review mode** - `reviewMode` prop controls visibility
- Commit flow stays modal in `src/components/tasks/commit-archive-modal.tsx`, or inline in review?
  - **Decision: Stays modal** - no changes to commit flow

## Implementation Notes
- Simplified `TaskReviewPanel` from ~475 lines to ~287 lines
- Removed agent spawn functionality from review panel (was unused in practice)
- `FileListPanel` now has 3 props instead of 9
- `DiffPanel` gains `reviewMode` prop that hides comment/send controls
- Left panel width reduced from w-96 to w-72 for better diff viewing space
