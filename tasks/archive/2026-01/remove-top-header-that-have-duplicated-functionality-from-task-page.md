# remove top header that have duplicated functionality from task page

## Problem Statement
Task page has duplicate navigation: view tabs in `tasks.tsx` (lines 625-645: Editor/Review Changes) AND mode tabs in `task-editor.tsx` (lines 66-97: Edit/Preview/Review). Both control similar view states. Remove outer view tabs, consolidate into task-editor.

## Scope
**In:**
- Remove view tabs from tasks.tsx (Editor/Review Changes)
- Remove `view` state from tasks.tsx
- Keep task-editor mode tabs (Edit/Preview/Review)
- TaskReviewPanel rendered via task-editor's Review mode

**Out:**
- Changes to task-editor internal structure
- Changes to TaskSidebar
- Changes to task-list-sidebar

## Implementation Plan

### Phase: Remove duplicate header
- [x] Remove `view` state (`useState<'editor' | 'review'>`) from tasks.tsx
- [x] Remove view tabs div (lines 625-645) from tasks.tsx
- [x] Remove conditional rendering based on `view === 'editor'` vs `view === 'review'`
- [x] Render TaskEditor directly (task-editor already has Review mode via its own tabs)
- [x] Pass `taskDescription={draft}` to TaskReviewPanel via task-editor props if needed

## Key Files
- `src/routes/tasks.tsx` - remove view state, view tabs, conditional rendering
- `src/components/tasks/task-editor.tsx` - verify Review mode renders TaskReviewPanel correctly

## Success Criteria
- [x] Single set of tabs (Edit/Preview/Review) in task-editor
- [x] No duplicate "Review"/"Review Changes" buttons
- [x] TaskReviewPanel accessible via task-editor's Review tab

## Implementation Notes
- Removed `TaskReviewPanel` import from tasks.tsx (now only used in task-editor.tsx)
- Added optional `taskDescription` prop to TaskEditorProps interface
- TaskFooter is now conditionally rendered only in edit/preview modes (hidden in review mode)
