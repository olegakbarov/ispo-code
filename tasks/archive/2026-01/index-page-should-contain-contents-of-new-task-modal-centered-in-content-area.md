# index page should contain contents of new task modal centered in content area

## Problem Statement
Index content area placeholder only; replace with new-task modal content
Centered create form in main pane; faster create flow

## Scope
**In:**
- inline new-task form on tasks index content area
- shared create-task content between modal and inline
- layout centering in main content pane
**Out:**
- changes to task creation backend flow
- redesign of create-task fields or validation
- global layout or sidebar changes

## Implementation Plan

### Phase: Shared Form
- [x] Extract create-task modal panel into reusable component
- [x] Update `CreateTaskModal` to render shared component inside overlay

### Phase: Index Embed
- [x] Add inline create form in tasks content area when no task selected and modal closed
- [x] Center inline panel with existing content area layout
- [x] Gate inline rendering to index route as needed

## Key Files
- `src/components/tasks/create-task-modal.tsx` - refactor modal wrapper
- `src/components/tasks/create-task-form.tsx` - new shared form panel
- `src/routes/tasks/_page.tsx` - inline form rendering logic
- `src/routes/tasks/index.tsx` - index route flags/props
- `src/routes/tasks/new.tsx` - keep modal route behavior

## Success Criteria
- [x] /tasks index shows new-task form centered in content area
- [x] /tasks/new still opens create modal overlay
- [x] create task flow works from inline form

## Open Questions
- confirm target index route: `/tasks` vs `/` → **Implemented on `/tasks` index route**
- inline form shown only on index or also after closing modal → **Shown when no task is selected (including after closing modal)**

## Implementation Notes

### Changes Made
1. **Created `src/components/tasks/create-task-form.tsx`**
   - Extracted form fields into reusable `CreateTaskForm` component
   - Extracted action buttons into reusable `CreateTaskActions` component
   - Re-exports `ALL_PLANNER_CANDIDATES` and `TaskType` for backward compatibility

2. **Updated `src/components/tasks/create-task-modal.tsx`**
   - Refactored to use shared `CreateTaskForm` and `CreateTaskActions` components
   - Maintained same modal overlay structure and styling
   - Re-exports types for backward compatibility

3. **Updated `src/routes/tasks/_page.tsx`**
   - Added import for `CreateTaskForm` and `CreateTaskActions`
   - Replaced placeholder "Select a task from the sidebar" with inline create form
   - Form is centered in content area with same styling as modal
   - Uses existing state management (same handlers as modal)
