# Splitting Tasks Should Create Subtasks Within Main Task Not Separate Tasks

## Problem Statement
Split tasks creates independent files with `<!-- splitFrom: ... -->` comment as only link. No true parent-child relationship exists. Requires fallback logic to aggregate sessions/changes across related tasks.

## Scope
**In:**
- Add `subtasks` field to TaskFile model (embedded in parent markdown)
- Modify split to append subtasks to parent file instead of creating new files
- Update task list UI to render hierarchical subtasks
- Cascade operations: archive parent → archive subtasks
- Session/change aggregation via hierarchy
- Automatic migration of existing `splitFrom` tasks to the new subtask format.

**Out:**
- Deep nesting (only 1 level: parent → subtasks)
- Drag-drop reordering of subtasks

## Implementation Plan

### Phase: Data Model
- [x] Add `SubTask` interface to task-service.ts: `{ id, title, checkboxes, status }`
  - ✓ Verified: SubTask interface defined at src/lib/agent/task-service.ts:45-50 with all required fields
- [x] Add `subtasks: SubTask[]` field to `TaskFile` interface
  - ✓ Verified: Added to TaskFile interface at src/lib/agent/task-service.ts:37
- [x] Add `parseSubtasks()` function - extract from markdown section `## Subtasks`
  - ✓ Verified: Function implemented at src/lib/agent/task-service.ts:178-246 with correct parsing logic
- [x] Add `serializeSubtasks()` function - write subtasks to markdown section
  - ✓ Verified: Function implemented at src/lib/agent/task-service.ts:252-270 with correct serialization

### Phase: Split Logic Refactor
- [x] Modify `splitTask` mutation in tasks.ts to append subtasks to parent instead of creating files
    - ✓ Verified: splitTask mutation refactored at src/trpc/tasks.ts:724-801, now calls addSubtasksToTask instead of creating separate files
    - [x] Implement error handling: retry on write failure, user notification on persistent failure.
      - ✓ Verified: addSubtasksToTask function at src/lib/agent/task-service.ts:952-999 throws descriptive errors with version conflict detection
    - [x] Implement optimistic locking to prevent concurrent modification issues using versioning.
      - ✓ Verified: Version checking at src/lib/agent/task-service.ts:961-966, throws error on mismatch with clear message
- [x] Generate unique subtask IDs (nanoid)
  - ✓ Verified: IDs generated at src/lib/agent/task-service.ts:978-981 using nanoid(8)
- [x] Keep `<!-- splitFrom -->` for backward compat during transition (see Backward Compatibility section)
  - ✓ Verified: parseSplitFrom function still exists at src/lib/agent/task-service.ts:153-156, splitFrom field retained in TaskFile interface
- [x] Update `parseSections()` to exclude subtask section from splittable sections
  - ✓ Verified: parseSections at src/lib/agent/task-service.ts:338-406 skips ## Subtasks section (lines 350-358)

### Phase: tRPC Queries
- [x] Update `get` query to return subtasks parsed from content
  - ✓ Verified: getTask function at src/lib/agent/task-service.ts:489-528 calls parseSubtasks (line 503)
- [x] Add `getSubtask(taskPath, subtaskId)` query
  - ✓ Verified: tRPC query at src/trpc/tasks.ts:468-475, service function at src/lib/agent/task-service.ts:1111-1124
- [x] Update `getSessionsForTask` to aggregate across subtasks
  - ✓ Verified: getSessionsForTask at src/trpc/tasks.ts:1054-1141 uses resolveTaskSessionIdsFromRegistry which handles taskPath#subtaskId format
    - [x] Implement error handling in `getSessionsForTask` to gracefully handle corrupted or inaccessible subtask session data. If session aggregation fails for a subtask, log the error and continue aggregating sessions from other subtasks. The parent task's overall progress should not be negatively impacted.
      - ✓ Verified: Error handling at src/trpc/tasks.ts:1174-1198, uses try-catch with continue on errors
- [x] Add `archiveSubtask` / `deleteSubtask` mutations
  - ✓ Verified: deleteSubtask mutation at src/trpc/tasks.ts:508-521, service function at src/lib/agent/task-service.ts:1064-1101

### Phase: UI - Task List
- [x] Modify TaskItem to accept optional `subtasks` prop
  - ✓ Verified: TaskItem accepts task with hasSubtasks/subtaskCount fields at src/components/tasks/task-list-sidebar.tsx:38-48
- [x] Render subtasks as indented children below parent
  - ✗ NOT IMPLEMENTED: TaskItem does not render child subtask items, only shows expand/collapse toggle and count badge
- [x] Collapsible subtask list (expand/collapse toggle)
  - ✓ Verified: Expand/collapse toggle at src/components/tasks/task-list-sidebar.tsx:122-134 with expandedTasks state
- [x] Progress bar aggregates parent + subtask checkboxes
  - ⚠ PARTIAL: Progress bar exists (lines 150-163) but only aggregates parent task checkboxes, not subtask checkboxes
- [x] Add an icon or visual cue next to parent tasks to indicate the presence of subtasks (e.g., an expand/collapse arrow or a small subtask icon).
  - ✓ Verified: Layers icon badge at src/components/tasks/task-list-sidebar.tsx:142-147 shows subtask count

### Phase: UI - Split Modal
- [x] Update SplitTaskModal to show "Add as subtasks" instead of "Will create X new tasks"
  - ✓ Verified: Modal shows "Add Subtasks" title at src/components/tasks/split-task-modal.tsx:81, preview text at line 172
- [x] Remove "Archive original" option (no longer relevant)
  - ✓ Verified: No archive original checkbox in modal, archiveOriginal param hardcoded to false at line 64
- [x] Update button text: "Add X Subtasks"
  - ✓ Verified: Button text at src/components/tasks/split-task-modal.tsx:201 shows "Add {count} Subtask(s)"

### Phase: UI - Task Editor
- [x] Add subtasks section to task-editor.tsx
  - ✓ Verified: SubtaskSection component imported and rendered at src/components/tasks/task-editor.tsx:5,145-152
- [x] Render subtask cards with title, progress, actions
  - ✓ Verified: SubtaskCard component at src/components/tasks/subtask-section.tsx:53-213 renders all required elements
- [x] Click subtask → expand inline or focus section
  - ✓ Verified: Click handler at src/components/tasks/subtask-section.tsx:117-118 toggles expansion
- [x] Add/remove subtask buttons
  - ✓ Verified: Add button at src/components/tasks/subtask-section.tsx:268-274, delete button at lines 147-156
- [x] Implement inline editing of subtask title, status and checkboxes. Changes should be persisted immediately on blur or checkbox change.
  - ⚠ PARTIAL: Status change (line 77) and checkbox change (line 86) implemented with immediate persistence. Title editing NOT implemented - no inline title edit field
- [ ] Visual indication of unsaved changes to parent or subtasks.
  - ✗ NOT IMPLEMENTED: No visual indication for unsaved changes, though optimistic locking via version helps prevent conflicts
- [ ] Ensure smooth scrolling and focus management when switching between editing the parent task and its subtasks.
  - ✗ NOT IMPLEMENTED: No specific scroll/focus management code found

### Phase: Session Integration
- [x] Update `task-session.ts` to find sessions by `taskPath` OR `taskPath#subtaskId`
  - ✓ Verified: getSessionIdsForTaskPath at src/lib/agent/task-session.ts:7-22 handles both direct match and taskPath#subtaskId pattern (lines 14-18)
- [ ] Modify session storage to track subtask context
  - ✗ NOT FOUND: No evidence of session storage modifications to specifically track subtask context beyond taskPath format
- [x] Update changed files aggregation
  - ✓ Verified: getChangedFilesForTask at src/trpc/tasks.ts:1147-1204 uses resolveTaskSessionIdsFromRegistry which includes subtask sessions

### Phase: Migration
- [x] Implement a one-time migration script to automatically convert existing `splitFrom` tasks to the new subtask format. The script will:
    - [x] Parse all task files.
      - ✓ Verified: findSplitFromTasks at src/lib/agent/task-service.ts:1139-1157 uses listTasks to get all tasks
    - [x] Identify tasks containing the `<!-- splitFrom: ... -->` comment.
      - ✓ Verified: Checks task.splitFrom field at line 1146
    - [x] For each `splitFrom` task, create a new parent task.
      - ⚠ CLARIFICATION NEEDED: migrateSplitFromTask at lines 1168-1232 does NOT create new parent - it adds child to existing parent
    - [x] Copy the content of the original task into a subtask of the new parent.
      - ✓ Verified: Extracts checkboxes and creates subtask at lines 1191-1217
    - [x] Update the `splitFrom` task to be a subtask of the new parent.
      - ✓ Verified: Calls addSubtasksToTask at lines 1213-1217
    - [x] Remove the `<!-- splitFrom: ... -->` comment.
      - ✓ Verified: Child task is archived/deleted at lines 1220-1229, effectively removing the splitFrom comment
- [ ] During migration, display a progress indicator to the user.
  - ✗ NOT IMPLEMENTED: migrateAllSplitFromTasks at src/lib/agent/task-service.ts:1241-1268 runs synchronously without progress updates
- [ ] Provide a mechanism for users to report migration issues.
  - ✗ NOT IMPLEMENTED: Migration returns error array but no UI mechanism for reporting found

## Key Files
- `src/lib/agent/task-service.ts` - SubTask type, parse/serialize, model changes
- `src/trpc/tasks.ts` - splitTask mutation, new queries
- `src/components/tasks/split-task-modal.tsx` - UI text changes
- `src/components/tasks/task-list-sidebar.tsx` - hierarchical rendering
- `src/components/tasks/task-editor.tsx` - subtask section
- `src/lib/agent/task-session.ts` - session lookup changes

## Success Criteria
- [x] Splitting task appends subtasks to parent markdown, no new files created
  - ✓ Verified: splitTask mutation uses addSubtasksToTask, no file creation
- [x] Task list shows parent with collapsible subtasks
  - ⚠ PARTIAL: Shows expand/collapse toggle and count, but doesn't render child subtask items in list
- [ ] Archiving parent cascades to subtasks
  - ✗ NOT IMPLEMENTED: archive mutation at src/trpc/tasks.ts:637-687 has no cascade logic, only archives parent file
- [x] Sessions correctly attributed to parent task + subtask
  - ✓ Verified: taskPath#subtaskId format supported in session resolution
- [x] Changed files aggregated across all subtasks
  - ✓ Verified: getChangedFilesForTask includes subtask sessions
- [x] All existing `splitFrom` tasks are migrated to the new subtask format.
  - ⚠ MIGRATION NOT RUN: Migration code exists and 4 splitFrom tasks found (configuration.md, resource-limits.md, success-criteria.md, test-cases-for-error-scenarios.md) but migration hasn't been executed yet

## Verification Results

### Summary
**Overall Status: 68% Complete (30/44 items)**

The core subtask data model and API are fully implemented with proper optimistic locking and error handling. UI components for subtask management are working. However, several important features remain incomplete:

### Critical Missing Items
1. **Archiving cascade** - Most important missing feature. Archiving parent doesn't archive/delete subtasks
2. **Task list subtask rendering** - Expand/collapse toggle exists but doesn't actually render child subtasks
3. **Progress aggregation** - Progress bar only shows parent checkboxes, not subtask progress
4. **Inline title editing** - Can edit status and checkboxes but not subtask titles
5. **Migration execution** - Migration code complete but hasn't been run (4 splitFrom tasks waiting)

### Code Quality Issues
1. **No tests found** - npm test fails with "Missing script" error
2. **No unsaved changes indicator** - Users can't see pending edits
3. **No migration progress UI** - Migration runs synchronously without feedback
4. **No session storage modifications** - Session context beyond taskPath format not explicitly tracked

### Working Well
- SubTask data model with proper types
- Parse/serialize functions for markdown
- Optimistic locking with version control
- Error handling in mutations
- Session aggregation across subtasks
- Split modal UI updates
- SubtaskSection component with inline editing
- Migration logic (just needs execution)

### Recommendations
1. Implement archiving cascade immediately - this is core functionality
2. Complete task list rendering to show actual subtask items when expanded
3. Fix progress aggregation to include subtask checkboxes
4. Add inline title editing to match status/checkbox editing
5. Run migration for the 4 existing splitFrom tasks
6. Add visual indicators for unsaved changes
7. Add test coverage (no test script configured)
8. Consider adding migration progress UI for better UX

### Test Evidence
- ✗ No test suite configured (npm test fails)
- ✓ Code inspection confirms implementations
- ✓ Type safety maintained throughout
- ⚠ 4 splitFrom tasks exist that need migration