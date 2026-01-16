# install cmdk and replace add task button with it

## Problem Statement
Cmdk command palette for task creation. Replace sidebar New Task button with palette trigger. Scalable action surface.

## Scope
**In:**
- `package.json` cmdk dependency
- `src/components/tasks/task-command-palette.tsx` new palette
- `src/components/tasks/task-list-sidebar.tsx` swap New Task button

**Out:**
- `src/components/tasks/create-task-form.tsx` UX changes
- Global command palette for non-task actions
- Extra commands beyond New Task

## Implementation Plan

### Phase: Dependencies
- [x] Add `cmdk` dependency in `package.json`
- [x] Update `package-lock.json`

### Phase: Command Palette
- [x] Create `src/components/tasks/task-command-palette.tsx` with cmdk dialog
- [x] Add open/close state + trigger in `src/components/tasks/task-command-palette.tsx`
- [x] Add "New Task" item routing to `/tasks/new` in `src/components/tasks/task-command-palette.tsx`

### Phase: Sidebar Integration
- [x] Replace New Task Link with palette trigger in `src/components/tasks/task-list-sidebar.tsx`

## Key Files
- `package.json` - add cmdk dependency
- `package-lock.json` - lockfile update
- `src/components/tasks/task-command-palette.tsx` - new palette component
- `src/components/tasks/task-list-sidebar.tsx` - replace New Task button

## Success Criteria
- [x] Sidebar shows cmdk trigger, no New Task Link
- [x] Palette opens and lists New Task action
- [x] Selecting New Task navigates to `/tasks/new`
- [x] `cmdk` present in dependencies

## Implementation Notes
- Cmd+K shortcut implemented (works with both Cmd on Mac and Ctrl on other platforms)
- Component uses cmdk's built-in Dialog component for accessibility
- Styled to match existing UI patterns with accent colors and font-vcr typography
- Routes to `/tasks/new` (corrected from original `/tasks/` specification)
