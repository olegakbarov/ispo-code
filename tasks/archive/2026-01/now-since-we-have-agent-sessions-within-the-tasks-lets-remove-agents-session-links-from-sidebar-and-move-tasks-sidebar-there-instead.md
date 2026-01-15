# Move task list to global sidebar, restore task controls to task page

## Problem Statement
Task list currently on tasks page left side. Move to global sidebar for persistent access across routes. Task controls (Save, Run, Review, etc.) currently in global sidebar - move back to task page right side for focused task work.

## Scope
**In:**
- Move TaskList component to global sidebar (__root.tsx)
- Remove TaskList from tasks page
- Move TaskSidebar back to tasks page right sidebar
- Remove TaskSidebarSection from __root.tsx
- Wire up task selection state between global sidebar and routes
- Make tasks page layout: editor (left) + TaskSidebar (right)

**Out:**
- No changes to TaskList component internals
- No changes to TaskSidebar component internals
- No changes to task functionality
- No changes to other routes

## Implementation Plan

### Phase: Move TaskList to Global Sidebar
- [x] Add TaskList component import to __root.tsx
  - ✓ Verified: `TaskListSidebar` imported in `src/routes/__root.tsx:23`
  - ⚠️ Note: Created NEW component `TaskListSidebar` instead of using old `TaskList`
- [x] Fetch tasks, filters, activeAgentSessions in __root.tsx Sidebar
  - ✓ Verified: `TaskListSidebar` component is self-contained and fetches its own data via tRPC (`src/components/tasks/task-list-sidebar.tsx:45-53`)
  - ✓ Fetches: `workingDir`, `tasks`, `activeAgentSessions`
- [ ] Render TaskList in sidebar below header, remove TasksNavRow
  - ⚠️ **PARTIALLY DONE**: TaskListSidebar IS rendered in sidebar (`src/routes/__root.tsx:131`)
  - ✗ **NOT DONE**: TasksNavRow is NOT removed - still exists at `src/routes/__root.tsx:128` and `src/routes/__root.tsx:160-187`
  - ⚠️ **CONDITIONAL**: Task list only shows when on tasks route (`isOnTasksRoute && <TaskListSidebar />`)
- [x] Handle task selection by navigating to /tasks?path=X
  - ✓ Verified: `handleTaskSelect` in `TaskListSidebar` navigates to `/tasks` with path param (`src/components/tasks/task-list-sidebar.tsx:88-93`)
- [x] Add filter/archiveFilter state management (URL params or zustand)
  - ✓ Verified: Uses URL params via `routerState.location.search` (`src/components/tasks/task-list-sidebar.tsx:36-42`)
  - ✓ `handleArchiveFilterChange` updates URL params (`src/components/tasks/task-list-sidebar.tsx:81-86`)

### Phase: Wire Task Selection State
- [x] TaskList in global sidebar navigates to /tasks with path param
  - ✓ Verified: See above - `handleTaskSelect` navigates correctly
- [x] Tasks page reads path from search params (already does)
  - ✓ Verified: `src/routes/tasks.tsx:38` - `selectedPath = search.path ?? null`
- [x] Persist filter/archiveFilter in URL params or shared store
  - ✓ Verified: Uses URL params consistently across both components

### Phase: Remove TaskList from Tasks Page
- [x] Delete TaskList component usage in tasks.tsx
  - ✓ Verified: No imports or usage of `TaskList` in `src/routes/tasks.tsx`
  - ✓ Old layout removed - no left sidebar in tasks page
- [x] Remove filter/archiveFilter state from tasks.tsx
  - ✓ Verified: `tasks.tsx` only reads filter from search params, doesn't manage local state for it
- [x] Remove task list queries from tasks.tsx (duplicated in __root)
  - ⚠️ **NOT REMOVED**: `src/routes/tasks.tsx:43-46` still has `trpc.tasks.list.useQuery()`
  - ⚠️ **NOT REMOVED**: `src/routes/tasks.tsx:52-55` still has `trpc.tasks.getActiveAgentSessions.useQuery()`
  - Note: These are needed for `selectedSummary` calculation and progress display
- [x] Remove left sidebar layout from tasks page
  - ✓ Verified: Tasks page now has single flex container with editor and TaskSidebar only

### Phase: Move TaskSidebar Back to Tasks Page
- [x] Delete TaskSidebarSection from __root.tsx
  - ✓ Verified: No `TaskSidebarSection` found in `__root.tsx` (grep search returned none)
- [x] Add TaskSidebar to tasks page right side (restore old layout)
  - ✓ Verified: `TaskSidebar` rendered at `src/routes/tasks.tsx:686-715`
  - ✓ Positioned as right sidebar with `w-80` width
- [x] Restore two-column layout: editor (flex-1) + TaskSidebar (w-80)
  - ✓ Verified: Layout at `src/routes/tasks.tsx:606-715` - editor is `flex-1`, sidebar is `w-80`
- [x] Re-enable Save button (editing on same page)
  - ✓ Verified: Save button exists in `TaskSidebar` (`src/components/tasks/task-sidebar.tsx:94-101`)
  - ✓ Wired to `onSave` handler from tasks page
- [x] Wire up all handlers (save, delete, archive, run, review, commit)
  - ✓ Verified: All handlers passed to `TaskSidebar` in `src/routes/tasks.tsx:688-713`
  - ✓ Handlers: onSave, onDelete, onArchive, onRestore, onReview, onVerify, onAssignToAgent

### Phase: Restore Global Sidebar Width
- [x] Change global sidebar width from w-96 back to w-80
  - ✓ Verified: `src/routes/__root.tsx:112` has `className="w-80 bg-card..."`
- [ ] Test scroll behavior for long task lists
  - ⚠️ Cannot verify without manual testing
- [ ] Ensure task list search/filter UX works in narrower space
  - ⚠️ Cannot verify without manual testing

### Phase: Update TaskList Styling for Global Sidebar
- [x] Remove fixed w-80 width from TaskList (use full sidebar width)
  - ✓ Verified: `TaskListSidebar` has no fixed width, uses `flex-1` for container (`src/components/tasks/task-list-sidebar.tsx:104`)
- [x] Remove bg-panel styling (inherit from sidebar)
  - ✓ Verified: `TaskListSidebar` has no `bg-panel` - uses transparent background
- [x] Remove border styling (already in sidebar)
  - ✓ Verified: Component uses internal borders for list items only, not outer border
- [x] Match global sidebar visual style
  - ✓ Verified: Uses consistent styling with `border-border`, `text-muted-foreground`, etc.

## Success Criteria
- [ ] Task list always visible in global sidebar on all routes
  - ✗ **NOT MET**: Task list only visible when `isOnTasksRoute` is true (`src/routes/__root.tsx:131`)
  - Issue: Conditional rendering defeats purpose of "persistent access across routes"
- [x] Clicking task in sidebar navigates to /tasks?path=X with editor + controls
  - ✓ Verified: Navigation works correctly
- [x] All task actions (save, run, review, commit, delete) work from task page sidebar
  - ✓ Verified: All handlers wired up in TaskSidebar
- [x] Task list filter/search persists across navigation
  - ✓ Verified: Uses URL params for persistence
- [ ] No layout breaks, proper scroll behavior in both sidebars
  - ⚠️ Cannot verify without manual testing - build succeeds without errors
- [x] Global sidebar w-80, task page has editor + task controls sidebar
  - ✓ Verified: Correct widths and layout structure

## Unresolved Questions
- Persist filter/archiveFilter in URL params or zustand store? **Suggestion**: URL params for bookmarkability
  - ✓ RESOLVED: Using URL params
- Show task list on non-task routes (agents, settings)? **Suggestion**: Yes, always visible
  - ✗ NOT IMPLEMENTED: Task list only shows on /tasks route
- Collapse task list when no project? **Suggestion**: Show "No project selected" message
  - ✓ IMPLEMENTED: Shows "Select a project" message (`src/components/tasks/task-list-sidebar.tsx:96-100`)

## Verification Results

### ✅ Completed Successfully
1. **TaskListSidebar component created** and added to global sidebar with self-contained data fetching
2. **Task selection state** properly wired via URL params
3. **TaskSidebar moved** back to tasks page right side
4. **All task controls** working from task page sidebar
5. **Global sidebar width** restored to w-80
6. **Two-column layout** properly implemented on tasks page
7. **Styling updates** completed for TaskListSidebar

### ⚠️ Partially Completed
1. **TasksNavRow NOT removed** from `__root.tsx` - still exists at lines 128 and 160-187
2. **Task list queries NOT removed** from tasks.tsx - still needed for selectedSummary
3. **Conditional rendering** - task list only shows on /tasks route, not "always visible"

### ✗ Issues Found
1. **Primary requirement not met**: Task list is NOT "always visible in global sidebar on all routes"
   - Current: Only visible when `isOnTasksRoute`
   - Expected: Persistent across all routes (agents, settings, etc.)
2. **TasksNavRow still exists**: Should be removed per plan but remains in sidebar
3. **Old TaskList component still exists**: `src/components/tasks/task-list.tsx` still in codebase but unused

### 📝 Recommendations
1. Remove conditional `{isOnTasksRoute && <TaskListSidebar />}` to show always
2. Delete `TasksNavRow` component and its usage in `__root.tsx`
3. Delete unused `src/components/tasks/task-list.tsx` file
4. Consider if task list queries in tasks.tsx are truly needed or can be optimized

### Build Status
✅ Build passes successfully with no errors