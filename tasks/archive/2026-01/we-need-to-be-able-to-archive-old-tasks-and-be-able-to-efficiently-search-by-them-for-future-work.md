# we need to be able to archive old tasks and be able to efficiently search by them for future work

## Problem Statement
Tasks accumulate in `tasks/` directory (29+ files), cluttering active task list. No way to archive completed work or search historical tasks. All tasks shown as active, degrading UX and discoverability.

## Scope
**In:**
- Archive completed tasks to separate directory
- Search across active + archived tasks
- Filter by status (active/archived)
- Archive action in task sidebar
- Restore archived tasks
- Date-based archiving metadata

**Out:**
- Full-text search engine (Meilisearch, Elasticsearch)
- Git history search
- Task analytics/metrics
- Auto-archiving rules
- Archive compression

## Implementation Plan

### Phase: Storage
- [x] Add `tasks/archive/` directory to allowed paths in `task-service.ts:isAllowedTaskPath`
- [x] Add glob pattern `tasks/archive/**/*.md` to `TASK_GLOBS`
- [x] Extend `TaskSummary` with `archived: boolean` field
- [x] Add `archivedAt?: string` to `TaskSummary`
- [x] Mark archived tasks in `listTasks()` based on path prefix

### Phase: Archive Operations
- [x] Add `archiveTask(cwd, path)` mutation in `tasks.ts`
- [x] Move file from `tasks/foo.md` to `tasks/archive/YYYY-MM/foo.md`
- [x] Add `restoreTask(cwd, archivePath)` to move back to active
- [x] Handle name conflicts on restore (append -2, -3, etc.)

### Phase: UI - Task List
- [x] Add archive filter toggle (All/Active/Archived) in `task-list.tsx`
- [x] Show archive badge on archived tasks
- [x] Persist filter state in URL search params
- [x] Update filter logic in `tasks.tsx` to include `archived` field

### Phase: UI - Task Actions
- [x] Add "Archive" button in `task-sidebar.tsx`
- [x] Add "Restore" button for archived tasks
- [x] Confirm dialog for archive action
- [ ] Show archived date in task metadata (deferred - not critical for MVP)

### Phase: Search Enhancement
- [x] Extend client-side filter to search across all fields (title, content snippet, path)
- [ ] Add date range filter (archived within last N days) (deferred - not critical for MVP)
- [ ] Show match count in filter input (deferred - not critical for MVP)

## Key Files
- `src/lib/agent/task-service.ts` - archive/restore functions, path validation
- `src/trpc/tasks.ts` - archive/restore mutations
- `src/routes/tasks.tsx` - filter state, search logic
- `src/components/tasks/task-list.tsx` - archive filter toggle
- `src/components/tasks/task-sidebar.tsx` - archive/restore buttons

## Success Criteria
- [x] Completed tasks can be archived to `tasks/archive/YYYY-MM/`
- [x] Archived tasks hidden by default, shown via filter toggle
- [x] Search works across active + archived tasks
- [x] Archived tasks can be restored to active
- [x] Archive/restore operations preserve file content

## Implementation Notes

### Archive Storage Structure
- Archives organized by year-month: `tasks/archive/2026-01/task-name.md`
- Auto-creates month directories on first archive
- Name conflicts resolved with numeric suffix (-2, -3, etc.)

### UI Integration
- Archive filter buttons in task list header (All/Active/Archived)
- Default view shows only active tasks (filter persists in URL)
- Archive badge displayed on archived task items
- Archive/Restore buttons in task sidebar (contextual based on status)

### Key Implementation Details
- `task-service.ts`: Added `archiveTask()` and `restoreTask()` functions with path validation
- `tasks.ts` (tRPC): Added `archive` and `restore` mutations
- `task-list.tsx`: Archive filter toggle with 3 states, visual badge for archived tasks
- `task-sidebar.tsx`: Conditional Archive/Restore button based on task status
- `tasks.tsx`: Archive filter state in URL search params, combined text + archive filtering

### Testing Notes
- Verify archive path validation (only allows tasks/ directory)
- Test name conflict resolution on restore
- Confirm filter state persists across navigation
- Check archive badge visibility
