# new task should not be modal. it should be a redirect to / where that modal is rendered on page. remove modal

<!-- autoRun: true -->

## Summary

Converted the "new task" modal into an inline form shown on the /tasks index page. The /tasks/new route now redirects to /tasks where the form is displayed centered in the content area.

## Changes Made

- [x] Updated /tasks/new route to redirect to /tasks (index)
  - Changed from rendering TasksPage with createModalOpen=true to a redirect
  - File: `src/routes/tasks/new.tsx`

- [x] Removed CreateTaskModal component usage from TasksPage
  - Removed CreateTaskModal import and JSX usage
  - File: `src/routes/tasks/_page.tsx`

- [x] Updated create-task-visibility logic to remove 'modal' mode
  - Removed 'modal' from CreateTaskRenderMode type
  - Removed isCreateModalOpen parameter
  - File: `src/lib/tasks/create-task-visibility.ts`

- [x] Updated TasksPage to always show inline form when no task selected
  - Removed createModalOpen prop from TasksPageProps
  - Updated all route files to not pass createModalOpen
  - Files: `src/routes/tasks/_page.tsx`, `src/routes/tasks/index.tsx`, `src/routes/tasks/$.tsx`

- [x] Updated sidebar 'New Task' button to navigate to /tasks index
  - Changed link from /tasks/new to /tasks/
  - File: `src/components/tasks/task-list-sidebar.tsx`

- [x] Cleaned up unused modal-related handlers
  - Removed openCreate and handleCloseCreate from useTaskActions return
  - Removed destructuring of these handlers in TasksPage
  - File: `src/lib/hooks/use-task-actions.ts`, `src/routes/tasks/_page.tsx`

## Testing Notes

The modal has been completely replaced with an inline form. When users:
1. Click "New Task" in the sidebar → navigates to /tasks/ → shows inline form
2. Navigate to /tasks/new → redirects to /tasks/ → shows inline form
3. Select a task → inline form disappears, task editor appears
4. Navigate back to /tasks/ without a task → inline form reappears

The CreateTaskModal component file still exists but is no longer used. It can be deleted in a future cleanup.

Reducer actions OPEN_CREATE_MODAL and CLOSE_CREATE_MODAL still exist but are no longer triggered (dead code).
