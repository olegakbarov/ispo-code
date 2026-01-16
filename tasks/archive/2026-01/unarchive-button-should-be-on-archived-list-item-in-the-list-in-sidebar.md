# unarchive button should be on archived list item in the list in sidebar

## Problem Statement
Archived sidebar items lack unarchive control. Restore hidden behind command palette or task view. Need per-item unarchive in sidebar list.

## Scope
**In:**
- Sidebar task list archived item UI
- Unarchive action wiring to existing restore/unarchive flow
- Loading/disabled state for per-item action
**Out:**
- Backend archive/restore logic changes
- Unarchive modal redesign or new modal
- Task lists outside sidebar

## Implementation Plan

### Phase: Sidebar Unarchive Action
- [x] Confirm unarchive behavior
- [x] Add unarchive button to archived TaskItem UI
- [x] Wire button to mutation with pending state
- [x] Prevent button click from triggering item select

## Key Files
- `src/components/tasks/task-list-sidebar.tsx` - archived item rendering and action wiring

## Success Criteria
- [x] Archived list items show unarchive control in sidebar
- [x] Clicking unarchive restores task and updates list

## Open Questions
- Restore only or open unarchive-with-agent flow?
  - **Decision**: Restore only (simple unarchive). Uses existing `trpc.tasks.restore` mutation.
- Show unarchive button only in archived filter or also in all?
  - **Decision**: Button shows on any archived task regardless of filter view. The `task.archived` flag determines rendering.

## Implementation Notes
- Added `ArchiveRestore` icon from lucide-react
- Extended `TaskItemProps` with `onRestore` callback and `isRestoring` boolean
- Archived task UI changed from simple div to flex layout with title + action button
- Button shows spinner during restore mutation (`isRestoring` prop)
- `e.stopPropagation()` prevents row click navigation when clicking unarchive button
