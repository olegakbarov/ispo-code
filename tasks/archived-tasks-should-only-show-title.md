# archived tasks should only show title

## Problem Statement
Archived tasks show full detail (title, progress bar, badge). Should show only title for cleaner list view since progress/status irrelevant for completed/archived tasks.

## Scope
**In:** Simplify archived task rendering in sidebar list
**Out:** Task editor/review panel changes, archive filter behavior

## Implementation Plan

### Phase: Simplify TaskItem Rendering
- [x] Add early return in `TaskItem` for archived tasks with minimal markup
- [x] Show only title text with muted styling
- [x] Remove progress bar for archived
- [x] Remove "ARCHIVED" badge (being in archived filter makes it implicit)

## Key Files
- `src/components/tasks/task-list-sidebar.tsx:45-139` - TaskItem component render logic

## Success Criteria
- [x] Archived tasks show only title (no progress, no badge)
- [x] Visual distinction maintained via muted text color
- [x] Active task selection still works for archived items

## Implementation Notes
- Added early return at the start of `TaskItem` component for archived tasks
- Archived tasks now render with simplified markup: just title text in a clickable div
- Visual distinction maintained through `text-muted-foreground/60` class (more muted than active tasks)
- Active selection state still works correctly for archived items (accent background/text when selected)
- Removed redundant "ARCHIVED" badge and progress indicators for archived tasks
- Code reduction: ~40 lines of conditional logic eliminated for archived tasks
