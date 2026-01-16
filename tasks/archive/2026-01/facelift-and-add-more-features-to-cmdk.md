# facelift and add more features to cmdk.

## Problem Statement
Cmdk palette: only New Task, basic styling.
No task search, navigation, or task actions.
Needs visual polish + richer commands for tasks workflow.

## Scope
**In:**
- Facelift dialog, input, list item styling in `src/components/tasks/task-command-palette.tsx`
- Add task search + navigation commands in `src/components/tasks/task-command-palette.tsx`
- Add task action commands wired from `src/components/tasks/task-list-sidebar.tsx`
- Add cmdk hotkey entry in `src/lib/hotkeys/keymap.ts`
**Out:**
- No new task endpoints in `src/trpc/tasks.ts`
- No changes to task execution logic in `src/lib/hooks/use-task-actions.ts`
- No global palette outside tasks sidebar in `src/components/tasks/task-list-sidebar.tsx`

## Implementation Plan

### Phase: Wiring
- [x] Add tasks, selectedPath, and action callback props in `src/components/tasks/task-command-palette.tsx`
- [x] Pass tasks list + handlers from `src/components/tasks/task-list-sidebar.tsx`
- [x] Add task navigation items in `src/components/tasks/task-command-palette.tsx`
- [x] Add task action items in `src/components/tasks/task-command-palette.tsx`

### Phase: Facelift + Hotkeys
- [x] Redesign dialog container in `src/components/tasks/task-command-palette.tsx`
- [x] Redesign backdrop in `src/components/tasks/task-command-palette.tsx`
- [x] Redesign input styling in `src/components/tasks/task-command-palette.tsx`
- [x] Add grouped sections in `src/components/tasks/task-command-palette.tsx`
- [x] Add item metadata in `src/components/tasks/task-command-palette.tsx`
- [x] Add empty state styling in `src/components/tasks/task-command-palette.tsx`
- [x] Add cmdk hotkey entry in `src/lib/hotkeys/keymap.ts`
- [x] Use `useHotkey` for cmdk open in `src/components/tasks/task-command-palette.tsx`

## Key Files
- `src/components/tasks/task-command-palette.tsx` - cmdk UI, items, hotkey wiring
- `src/components/tasks/task-list-sidebar.tsx` - pass data and action handlers
- `src/lib/hotkeys/keymap.ts` - cmdk hotkey entry

## Success Criteria
- [x] `src/components/tasks/task-command-palette.tsx` shows task search results and navigates on select
- [x] `src/components/tasks/task-command-palette.tsx` triggers implement/verify/review/archive/restore via handlers
- [x] Cmdk open hotkey registered in `src/lib/hotkeys/keymap.ts`
- [x] `src/components/tasks/task-command-palette.tsx` uses `useHotkey` for cmdk open
- [x] `src/components/tasks/task-command-palette.tsx` uses grouped sections and refreshed styling

## Unresolved Questions (RESOLVED)
- ~~Which extra task actions in `src/components/tasks/task-command-palette.tsx` beyond implement/verify/review/archive?~~
  - **RESOLVED**: Added restore action for archived tasks
- ~~Should cmdk in `src/components/tasks/task-command-palette.tsx` respect archive filter or search all tasks?~~
  - **RESOLVED**: Shows all tasks (both active and archived in separate groups)
- ~~Cmdk scope in `src/components/tasks/task-command-palette.tsx`: tasks sidebar only or global overlay?~~
  - **RESOLVED**: Scoped to tasks sidebar only, as per original scope

## Implementation Notes

### What Was Done
1. **Enhanced Props Interface**: Added `TaskSummary` interface and new props for tasks, selectedPath, and action handlers (onRunImpl, onRunVerify, onNavigateReview, onArchive, onRestore)

2. **Task Navigation**: Command palette now shows:
   - All active tasks with progress bars and selection indicators
   - All archived tasks (with visual distinction)
   - Fuzzy search across task titles and paths via cmdk's built-in filtering

3. **Task Actions**: Context-aware actions for selected task:
   - Implement (with hotkey hint: I)
   - Verify (with hotkey hint: V)
   - Review & Commit (with hotkey hint: R)
   - Archive (for active tasks)
   - Restore (for archived tasks)

4. **Visual Facelift**:
   - Enhanced backdrop: `bg-black/80 backdrop-blur-sm`
   - Larger dialog: `max-w-2xl` instead of `max-w-md`
   - Enhanced input with icon and ESC hint
   - Grouped sections with styled headings (uppercase, tracking-wider)
   - Item metadata: progress bars, task counts, selection indicators
   - Enhanced empty state with helpful text

5. **Hotkey Integration**:
   - Replaced manual keyboard listener with `useHotkey` hook
   - Added `OPEN_COMMAND_PALETTE` entry to keymap.ts
   - Hotkey hints shown in UI (⌘K, ESC, I, V, R, C)

6. **Archive/Restore Handlers**: Added mutations in task-list-sidebar.tsx with optimistic updates via tRPC

### Design Decisions
- **Search Scope**: Shows all tasks regardless of archive filter - users can search globally
- **Action Context**: Only shows actions for currently selected task to keep UI focused
- **Progress Display**: Shows progress bars inline with task items for quick visual scanning
- **Icon Consistency**: Uses lucide-react icons (Play, CheckCircle, FileText, Archive, ArchiveRestore)
