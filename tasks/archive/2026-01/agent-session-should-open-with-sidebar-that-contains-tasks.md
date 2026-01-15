# agent session should open with sidebar that contains tasks

## Problem Statement
Agent sessions currently open with only ThreadSidebar (right, showing git/status). Users need to see task list when viewing task-related sessions to quickly navigate between tasks and their sessions.

## Scope
**In:**
- Show TaskListSidebar on left when viewing agent session with taskPath
- Keep ThreadSidebar on right (git/status)
- Both sidebars visible simultaneously

**Out:**
- Changes to tasks route (already has TaskListSidebar)
- Modifications to ThreadSidebar content
- Global sidebar in __root.tsx (stays as-is)

## Implementation Plan

### Phase: Sidebar Layout
- [x] Update `agents/$sessionId.tsx` layout - add left sidebar container
- [x] Conditionally render TaskListSidebar when session.taskPath exists
- [x] Adjust main content flex to accommodate both sidebars

### Phase: Integration
- [x] Import TaskListSidebar component
- [x] Pass session context (highlight active task via URL search params)
- [x] Ensure responsive layout (3-column: TaskList | Content | Thread)

## Key Files
- `src/routes/agents/$sessionId.tsx` - add TaskListSidebar, layout adjustments
- `src/components/tasks/task-list-sidebar.tsx` - already self-contained, no changes

## Success Criteria
- [x] Agent session with taskPath shows task list on left
- [x] Agent session without taskPath shows no task list
- [x] Both sidebars (tasks + thread) visible simultaneously
- [x] Layout remains functional, no overflow issues

## Implementation Notes
- Added left sidebar (w-64) with TaskListSidebar component, shown only when `session.taskPath` exists
- Fixed TypeScript error in existing "View Task" link by adding required `archiveFilter` param
- TaskListSidebar handles its own navigation to /tasks route when clicking tasks
- Layout uses flex: TaskList (256px) | Content (flex-1) | Thread (sidebar width)
