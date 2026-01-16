# improve UI for subtasks. move to tab, more functional and compact

## Problem Statement
Subtask UI bulky and buried below editor, hidden when empty. Extra clicks for status/title/checkbox; editor space wasted. Move subtasks into a dedicated tab for quick access with compact edits.

## Scope
**In:**
- `src/components/tasks/task-editor.tsx` add Draft/Subtasks tabs in edit mode, move subtask section to tab
- `src/components/tasks/subtask-section.tsx` compact layout, empty state, inline edit/actions
- `src/components/tasks/split-task-modal.tsx` spacing/controls aligned with compact subtask UI
**Out:**
- `src/lib/agent/task-service.ts` subtask schema/limits
- `src/trpc/tasks.ts` API contracts
- `src/components/tasks/task-list-sidebar.tsx` sidebar behavior

## Implementation Plan

### Phase: Editor Tabs
- [x] Add edit-mode tabs for Draft/Subtasks in `src/components/tasks/task-editor.tsx`
- [x] Move textarea into Draft tab content in `src/components/tasks/task-editor.tsx`
- [x] Move `SubtaskSection` into Subtasks tab content in `src/components/tasks/task-editor.tsx`
- [x] Always show Subtasks tab with empty state in `src/components/tasks/task-editor.tsx`
- [x] Tune Subtasks tab container height/padding in `src/components/tasks/task-editor.tsx`

### Phase: Compact Layout
- [x] Replace card layout with dense row layout in `src/components/tasks/subtask-section.tsx`
- [x] Add always-visible header with Add button in `src/components/tasks/subtask-section.tsx`
- [x] Add empty state row when no subtasks in `src/components/tasks/subtask-section.tsx`
- [x] Move status toggle into row header in `src/components/tasks/subtask-section.tsx`

### Phase: Inline Editing
- [x] Add inline title edit in `src/components/tasks/subtask-section.tsx`
- [x] Add checklist item add/remove UI in `src/components/tasks/subtask-section.tsx`
- [x] Memoize subtask rows in `src/components/tasks/subtask-section.tsx`

### Phase: Split Modal Alignment
- [x] Adjust split modal padding/typography in `src/components/tasks/split-task-modal.tsx`

## Key Files
- `src/components/tasks/task-editor.tsx` - Draft/Subtasks tabs, container layout
- `src/components/tasks/subtask-section.tsx` - compact rows, inline edit, checklist UI
- `src/components/tasks/split-task-modal.tsx` - compact modal spacing

## Success Criteria
- [x] Subtasks tab visible with zero subtasks; Add flow works
- [x] Title/status/checkbox edits persist via UI without reload
- [x] >= 6 subtasks visible within 300px subtasks tab area
- [x] Split modal still enforces 20-subtask limit
