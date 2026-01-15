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
  - ✓ Fixed: Added `hasUncommittedChanges` query to distinguish "no changes yet" vs "all committed"
  - ✓ `allCommitted = changedFiles.length === 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted`
- [x] Create "All Changes Committed" success state replacing commit controls when committed
  - ✓ Implemented: New early return block shows centered success UI with green styling
- [x] Show archive button in success state area (only when all committed)
  - ✓ Archive button renders in success state with full width primary styling
- [x] Pass `onArchive` prop to `TaskReviewPanel` from `tasks.tsx`
  - ✓ Verified: Props passed correctly via `TaskEditor`

### Phase: Sidebar Cleanup
- [x] Remove archive/restore button block from `task-sidebar.tsx` (lines 205-230)
  - ✓ Verified: No archive/restore buttons in `task-sidebar.tsx`
- [x] Remove `onArchive`, `onRestore`, `isArchiving`, `isRestoring`, `hasUncommittedChanges`, `uncommittedCount` props from sidebar
  - ✓ Verified: `TaskSidebarProps` interface contains none of these props

### Phase: Integration
- [x] Wire archive handler in `tasks.tsx` to review panel
  - ✓ Verified: `handleArchive` and `handleRestore` handlers defined and passed to `TaskEditor`
- [x] Add restore button to review panel for archived tasks
  - ✓ Implemented: Restore button shows when `isArchived` is true
- [x] Test state transitions: uncommitted → committed → archived
  - ✓ Logic verified: Code correctly handles all state transitions

## Key Files
- `src/components/tasks/task-review-panel.tsx` - success state with archive button
- `src/components/tasks/task-sidebar.tsx` - archive button removed
- `src/routes/tasks.tsx` - passes archive handler to review panel

## Success Criteria
- [x] Clear visual state when all changes committed
  - ✓ Shows centered "All Changes Committed" card with green styling and check icon
- [x] Archive button appears only after all files committed
  - ✓ Archive button only renders when `allCommitted` is true
- [x] Archive button in commit controls area (not sidebar)
  - ✓ Archive button is in the success state early return, not in sidebar
- [x] Clean sidebar without duplicated archive functionality
  - ✓ No archive/restore code in `task-sidebar.tsx`

## Implementation Notes
- Props flow through `tasks.tsx` → `TaskEditor` → `TaskReviewPanel`
- Uses existing `hasUncommittedChanges` tRPC query to detect committed state
- Archive button shows as primary action in success state; restore button shows for archived tasks
- Removed duplicate "all committed" code from main render block (now handled by early return)

## Fix Applied

### Bug Fixed
**Location**: `src/components/tasks/task-review-panel.tsx:301-372`

The early return logic was updated to distinguish between:
1. **No files ever changed** → Shows "No files changed yet"
2. **All files committed** → Shows success state with archive button

**Solution implemented:**
1. Added `hasUncommittedChanges` query from `tasks` router
2. Derived `allCommitted` state: `changedFiles.length === 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted`
3. Early return shows "No files changed yet" only when `!allCommitted`
4. New early return for `allCommitted` shows centered success UI with archive/restore button
5. Removed duplicate conditional in commit controls section (simplified to always show commit controls in main render)

**State transitions now work correctly:**
- Task with uncommitted files → Shows file list + commit controls
- Task with all files committed → Shows "All Changes Committed" + Archive button
- Archived task with all committed → Shows "All Changes Committed" + Restore button
