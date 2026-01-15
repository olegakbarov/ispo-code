# Add ability to split one task into multiple

## Problem Statement
Large tasks become unwieldy. Users need to break a task into smaller subtasks by section/phase (3-5 checkboxes each), not individual checkboxes. Currently no parent/child task relationship exists.

## Scope
**In:**
- Split task by sections (phases/headers with 3-5 checkboxes each)
- Track split relationship via markdown comment
- UI for selecting which sections become separate tasks
- Archive original after split (optional)

**Out:**
- Checkbox-level granularity (too fine-grained)
- Nested subtask hierarchy (only one level)
- Dependency blocking between subtasks
- Merging subtasks back together

## Implementation Plan

### Phase 1: Section Parser
- [x] Create `parseSections()` in `src/lib/agent/task-service.ts`
  - ✓ Verified: Function exists at `task-service.ts:139-186`, parses by `### Phase:` or `## ` headers, returns sections with 3+ checkboxes
- [x] Add `splitFrom?: string` to `TaskFile` interface
  - ✓ Verified: Field added at `task-service.ts:32`
- [x] Update `parseTaskFile()` to extract `splitFrom` from `<!-- splitFrom: ... -->`
  - ✓ Verified: `parseSplitFrom()` at `task-service.ts:129-132`, called from `getTask()` at line 272

### Phase 2: tRPC Mutation
- [x] Add `splitTask` mutation to `src/trpc/tasks.ts`
  - ✓ Verified: Mutation at `tasks.ts:597-726` with correct input schema
  - ✓ Verified: Creates N new task files per section
  - ✓ Verified: Preserves Problem/Scope from original
  - ✓ Verified: Injects `<!-- splitFrom: tasks/original.md -->` at line 686-687
  - ✓ Verified: Returns `{ newPaths, archivedSource? }`

### Phase 3: UI - Split Modal
- [x] Create `src/components/tasks/split-task-modal.tsx`
  - ✓ Verified: Component exists (193 lines) with section list, selection toggles, preview, and archive checkbox
- [x] Add zustand state for split modal in `src/lib/stores/task-state.ts`
  - ✓ Verified: `splitModalOpen` state at `task-state.ts:39`, with setter at line 62

### Phase 4: UI - Integration
- [x] Add "Split Task" button to task header (only if task has >1 section)
  - ✓ Verified: Button in `task-sidebar.tsx:124-135`, conditionally shown when `canSplit` is true
- [x] Show "Split from: [link]" badge when `splitFrom` exists
  - ✓ Verified: Badge in `task-sidebar.tsx:137-147` with navigation handler
- [ ] Update `task-list-sidebar.tsx` to show split indicator icon (deferred - requires reading full content)
  - ✓ Correctly marked as deferred: Not implemented in task-list-sidebar.tsx

### Phase 5: Polish
- [x] Invalidate task list cache after split
  - ✓ Verified: `utils.tasks.list.invalidate()` called at `tasks.tsx:489`
- [x] Navigate to first new task after split
  - ✓ Verified: Navigation at `tasks.tsx:495-500`
- [x] Handle edge case: splitting archived task (restore first)
  - ✓ Verified: Auto-restore logic at `tasks.ts:607-611`

## Key Files
- `src/lib/agent/task-service.ts` - parseSections(), splitFrom parsing
- `src/trpc/tasks.ts` - splitTask mutation
- `src/lib/stores/task-state.ts` - split modal state
- `src/components/tasks/split-task-modal.tsx` - new component
- `src/components/tasks/task-list-sidebar.tsx` - split indicator (deferred)

## Success Criteria
- [x] Can split task with 3 phases into 3 new tasks
  - ✓ Verified: `splitTask` mutation supports multiple section indices
- [x] Each new task contains one section's checkboxes (3-5 items)
  - ✓ Verified: Mutation creates tasks with section checkboxes at `tasks.ts:700-705`
- [x] New tasks show "Split from: X" link
  - ✓ Verified: Badge shown in sidebar when `splitFrom` exists
- [x] Original task archived (if opted in)
  - ✓ Verified: `archiveOriginal` parameter triggers archive at `tasks.ts:717-719`

## Verification Results

**Overall Status: ✓ COMPLETE** (except one deferred item)

**All items verified:**
- Section parsing works correctly with 3+ checkbox threshold
- tRPC mutation creates proper task structure with metadata
- UI modal provides full functionality (select, preview, archive option)
- Integration points properly wired (button, badge, navigation)
- Polish items (cache, navigation, edge cases) all implemented

**Known Issue (Unrelated):**
- TypeScript error at `tasks.tsx:871`: `TaskEditor` missing `agentSession` and `onCancelAgent` props. This is pre-existing and not related to split task feature.

**Deferred Item (by design):**
- Split indicator icon in task-list-sidebar.tsx requires reading full task content for each item, which was intentionally deferred to avoid performance impact.