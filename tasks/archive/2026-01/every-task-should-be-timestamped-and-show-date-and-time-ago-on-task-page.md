# every task should be timestamped and show date and time ago on task page

## Problem Statement
No task timestamps surfaced; no recency context on task page. Need per-task date/time plus time-ago display.

## Scope
**In:**
- task createdAt/updatedAt surfaced from task service
- timestamp display on task page header
- shared time formatting helper

**Out:**
- task list sorting changes
- retroactive rewrite of existing task files
- archive list UI changes

## Implementation Plan

### Phase: Task Data
- [x] Add createdAt to TaskSummary/TaskFile in `src/lib/agent/task-service.ts`
  - ✓ Verified: `TaskSummary` interface (lines 20-29) includes `createdAt: string` and `updatedAt: string`
- [x] Derive createdAt from stat birthtime with mtime fallback in `src/lib/agent/task-service.ts`
  - ✓ Verified: `listTasks()` line 238 and `getTask()` line 284 use `stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs`
- [x] Return createdAt from `trpc.tasks.list`/`trpc.tasks.get` in `src/trpc/tasks.ts`
  - ✓ Verified: Both endpoints return full `TaskSummary`/`TaskFile` which includes timestamps via service functions

### Phase: Task Page UI
- [x] Add date/time + time-ago formatter in `src/lib/utils/time.ts`
  - ✓ Verified: File exists with `formatTimeAgo()`, `formatDateTime()`, `formatDate()`, `formatDateWithRelative()`, and `formatRelativeShort()` functions
- [x] Pass createdAt/updatedAt into `TaskEditor` from `src/routes/tasks/_page.tsx`
  - ✓ Verified: Lines 1152-1153 pass `createdAt={taskData?.createdAt ?? selectedSummary?.createdAt}` and `updatedAt={taskData?.updatedAt ?? selectedSummary?.updatedAt}`
- [x] Render timestamp row in `src/components/tasks/task-editor.tsx`
  - ✓ Verified: Lines 81-85 render timestamp with `title={formatDateTime(createdAt)}` for hover and `formatTimeAgo(createdAt)` for display

## Key Files
- `src/lib/agent/task-service.ts` - add createdAt, derive timestamps
- `src/trpc/tasks.ts` - task responses include timestamps
- `src/lib/utils/time.ts` - date/relative formatting helper
- `src/routes/tasks/_page.tsx` - plumb timestamps to UI
- `src/components/tasks/task-editor.tsx` - show date/time + time ago

## Success Criteria
- [x] Task detail shows absolute date/time and relative age
  - ✓ Verified: `task-editor.tsx:81-85` shows relative time ("2h ago") with full datetime on hover tooltip
- [x] Timestamps populate for existing tasks via stat fallback
  - ✓ Verified: `task-service.ts:238,284` uses birthtime with mtime fallback
- [x] No type errors in task list/get consumers
  - ✓ Verified: TypeScript compilation passes for all application code (only test file vitest import errors unrelated to feature)

## Resolved Questions
- **Created vs updated timestamp**: Display createdAt with relative time (e.g., "2h ago"), full date/time shown on hover
- **Storage method**: Derive from FS metadata (birthtime with mtime fallback) - no file modification needed

## Verification Results

**Overall Status: ✅ COMPLETE**

All implementation items verified as correctly implemented:

1. **Task Data Layer** - `TaskSummary` and `TaskFile` interfaces properly include `createdAt` and `updatedAt` fields. The timestamp derivation correctly uses `birthtimeMs` with `mtimeMs` fallback. tRPC endpoints automatically return these via the service layer.

2. **UI Layer** - Time formatting utilities are comprehensive with multiple format functions. The `_page.tsx` correctly passes timestamps from both `taskData` and `selectedSummary` sources. The `task-editor.tsx` renders the timestamp in the header with hover tooltip for full datetime.

3. **Type Safety** - No type errors in the timestamp-related code. The only TypeScript errors are unrelated vitest import issues in test files.

**Code Quality Notes:**
- Clean implementation following existing patterns
- Proper fallback chain: `taskData?.createdAt ?? selectedSummary?.createdAt`
- Time utilities are reusable across the codebase
- Tooltip provides full datetime context without cluttering UI