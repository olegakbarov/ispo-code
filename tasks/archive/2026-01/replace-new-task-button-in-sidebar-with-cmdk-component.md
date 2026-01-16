# replace new task button in sidebar with cmdk component

## Problem Statement
Sidebar uses New Task button trigger
Swap to cmdk component for command palette UX
Keep new task navigation and shortcuts intact

## Scope
**In:**
- Sidebar top row cmdk UI swap
- Task command palette updates for inline use
- New Task command routing to `/tasks/new`

**Out:**
- Task creation flow changes
- New command items beyond existing actions
- Non-sidebar hotkey changes

## Implementation Plan

### Phase: Discovery
- [x] Inspect sidebar trigger in `src/components/tasks/task-list-sidebar.tsx`
- [x] Inspect cmdk dialog in `src/components/tasks/task-command-palette.tsx`

### Phase: Build
- [x] Add inline cmdk variant in `src/components/tasks/task-command-palette.tsx`
- [x] Swap sidebar row to cmdk component in `src/components/tasks/task-list-sidebar.tsx`
- [x] Align sidebar styling for new cmdk UI

### Phase: Validate
- [x] Smoke check cmdk open/close from sidebar
- [x] Smoke check New Task command routes to `/tasks/new`

## Key Files
- `src/components/tasks/task-list-sidebar.tsx` - sidebar trigger swap
- `src/components/tasks/task-command-palette.tsx` - cmdk variant update

## Success Criteria
- [x] Sidebar shows cmdk component instead of New Task button
- [x] New Task command routes to `/tasks/new`
- [x] Cmd+K still toggles command palette

## Implementation Notes
- Added `variant` prop to TaskCommandPalette ('button' | 'inline')
- Inline variant renders as command bar input with Plus icon, placeholder text, and Cmd+K hint
- Sidebar uses `<TaskCommandPalette variant="inline" />`
- Build completed successfully with no errors

## Open Questions
- Inline cmdk input always visible vs click-to-open dialog
- Any additional commands needed in sidebar palette
