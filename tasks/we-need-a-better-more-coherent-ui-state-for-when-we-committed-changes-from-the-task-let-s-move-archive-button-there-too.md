# Better post-commit UI state + relocate archive button

## Problem Statement
After committing changes in task review panel, only a transient success message appears. No persistent "committed" state. Archive button buried at sidebar bottom, disconnected from commit flow. Need coherent post-commit UI with archive as natural next action.

## Scope
**In:**
- Persistent "all committed" state in task review panel
- Archive button integrated into commit controls area
- Visual state change when no uncommitted files remain
- Remove archive from sidebar bottom

**Out:**
- Backend changes (archive blocking already works)
- Commit history UI changes
- Session-scoped commit panel changes

## Implementation Plan

### Phase: State & UI
- [x] Add `allCommitted` derived state in `task-review-panel.tsx` - true when `changedFiles.length === 0` after commit
- [x] Create "All Changes Committed" success state replacing commit controls when committed
- [x] Show archive button in success state area (only when all committed)
- [x] Pass `onArchive` prop to `TaskReviewPanel` from `tasks.tsx`

### Phase: Sidebar Cleanup
- [x] Remove archive/restore button block from `task-sidebar.tsx` (lines 205-230)
- [x] Remove `onArchive`, `onRestore`, `isArchiving`, `isRestoring`, `hasUncommittedChanges`, `uncommittedCount` props from sidebar

### Phase: Integration
- [x] Wire archive handler in `tasks.tsx` to review panel
- [x] Add restore button to review panel for archived tasks
- [ ] Test state transitions: uncommitted → committed → archived

## Key Files
- `src/components/tasks/task-review-panel.tsx` - add success state, archive button
- `src/components/tasks/task-sidebar.tsx` - remove archive button
- `src/routes/tasks.tsx` - pass archive handler to review panel

## Success Criteria
- [x] Clear visual state when all changes committed
- [x] Archive button appears only after all files committed
- [x] Archive button in commit controls area (not sidebar)
- [x] Clean sidebar without duplicated archive functionality

## Implementation Notes
- Props flow through `tasks.tsx` → `TaskEditor` → `TaskReviewPanel`
- Removed `uncommittedStatus` query from tasks.tsx since archive blocking is now handled by `changedFiles.length === 0` in review panel
- Archive button shows as primary action in success state; restore button shows for archived tasks
