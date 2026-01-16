# in task sidebar - next to delete add button 'mark as done and archive'

## Plan

- [x] Define scope
- [x] Implement
- [x] Validate

## Implementation Notes

Added "Done & Archive" button to task sidebar that:
1. Marks all unchecked checkboxes (`- [ ]`) as done (`- [x]`)
2. Commits the change with message `chore: mark task "{title}" as done`
3. Archives the task to `tasks/archive/YYYY-MM/`
4. Commits the archive rename

### Files Changed:
- `src/trpc/tasks.ts` - Added `markDoneAndArchive` mutation
- `src/lib/hooks/use-task-mutations.ts` - Added mutation hook
- `src/lib/hooks/use-task-crud-actions.ts` - Added handler
- `src/lib/hooks/use-task-actions.ts` - Wired up mutation and handler
- `src/routes/tasks/_page.tsx` - Connected to TaskSidebar
- `src/components/tasks/task-sidebar.tsx` - Added button UI with CheckCheck icon
