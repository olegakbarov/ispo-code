# archive should not be allowed until you commited the changes

## Problem Statement
Tasks track changed files via `getChangedFilesForTask` (aggregates across sessions). Archiving should be blocked when uncommitted changes exist to prevent losing work.

## Scope
**In:**
- Block archive if task has uncommitted changed files
- Show warning message explaining why archive is disabled
- Check uncommitted status via git status for task's changed files

**Out:**
- No auto-commit on archive
- No changes to worktree isolation
- No changes to restore functionality

## Implementation Plan

### Phase: Detect Uncommitted Changes
- [x] Add `hasUncommittedChanges` query to tasks router
- [x] Query uses `getChangedFilesForTask` + `getGitStatus` to check if changed files uncommitted
- [x] Return boolean + count of uncommitted files

### Phase: UI Blocking
- [x] Hook `hasUncommittedChanges` query in `src/routes/tasks.tsx`
- [x] Pass `hasUncommitted` state to `TaskSidebar`
- [x] Disable archive button when `hasUncommitted=true`
- [x] Add tooltip: "Commit changes before archiving"

### Phase: Error Handling
- [x] Add validation in `archiveTask` mutation (tasks router)
- [x] Throw error if task has uncommitted changes (fallback validation)

## Key Files
- `src/trpc/tasks.ts` - add `hasUncommittedChanges` query
- `src/lib/agent/task-service.ts` - add server-side validation in `archiveTask`
- `src/routes/tasks.tsx` - query uncommitted status, pass to sidebar
- `src/components/tasks/task-sidebar.tsx` - disable archive button based on state

## Success Criteria
- [x] Archive button disabled when uncommitted changes exist
- [x] Tooltip shows reason for disabled state
- [x] Server validates (double-check) before allowing archive
- [x] User can archive after committing all task changes

## Unresolved Questions
None.

## Implementation Notes
- Server-side validation was added to the tRPC `archive` mutation (not `task-service.ts`) because it needs access to session streams and git status
- The `hasUncommittedChanges` query returns `{ hasUncommitted: boolean, uncommittedCount: number, uncommittedFiles: string[] }`
- The UI tooltip dynamically shows the count of uncommitted files (e.g., "Commit 3 files before archiving")
