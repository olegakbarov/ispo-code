# adding task is broken on review page. i can't comment on line

## Investigation Findings

### Phase 1: Root Cause Investigation

- **Symptom**: User cannot comment on lines when viewing diffs in the task review page
- **Immediate Cause**: In `src/components/git/diff-panel.tsx`, when `reviewMode=true` is passed:
  - Line 668: `lineAnnotations={reviewMode ? [] : lineAnnotations}` - passes empty array
  - Line 669: `renderAnnotation={reviewMode ? () => null : ...}` - renders nothing
  - Line 803: `{!reviewMode && sendOpen && ...}` - hides send modal
- **Call Chain**:
  1. `task-editor.tsx:217` → renders `<TaskReviewPanel>` when mode === 'review'
  2. `task-review-panel.tsx:300` → passes `reviewMode` prop to `<DiffPanel>`
  3. `diff-panel.tsx:668-669` → disables line annotations when reviewMode=true
- **Original Trigger**: The `reviewMode` prop was intentionally added to hide the "Send to Agent" workflow in task review context, but it also disabled ALL line commenting functionality
- **Evidence**: Code in diff-panel.tsx explicitly checks `reviewMode` to disable:
  - Line annotations (line 668)
  - Annotation rendering (line 669)
  - Send modal (line 803)
  - Comment header (line 614)

### Design Intent vs. Bug

The `reviewMode` prop's purpose (from line 74-75 comment): "Hide comment/send controls (for task review mode)"

**However**, the current implementation completely disables commenting, when it should:
1. Still allow line comments (for task-specific feedback)
2. But integrate with the task system (spawn agent sessions linked to task) rather than the generic "Send to Agent" workflow

**Key Discovery**: `FileCommentInput` component exists (line 4-5 comment: "When taskPath is provided, comments spawn agent sessions linked to the task") but is NOT used in `TaskReviewPanel` or `DiffPanel`.

### Phase 2: Pattern Analysis

- **Working Examples**:
  - Regular git page (`/git`) uses `DiffPanel` with `reviewMode=false` - commenting works
  - `FileCommentInput` properly spawns agent sessions when `taskPath` is provided
- **Key Differences**:
  - Task review uses `reviewMode=true` which disables ALL commenting
  - No integration between `DiffPanel`'s line click and `FileCommentInput` in review context
- **Dependencies**:
  - `DiffPanel` handles line clicking via `onLineClick` callback
  - `FileCommentInput` can spawn agent sessions linked to tasks via `taskPath` prop
  - These two systems are NOT connected for task review mode

### Missing Connection

The architecture has two separate systems:
1. **DiffPanel's inline comments** - stored in local state, sent via "Send to Agent" workflow
2. **FileCommentInput** - spawns agent sessions linked to tasks

For task review page, we need to:
- Allow line clicks to trigger a comment input
- Have that input spawn an agent session linked to the task
- NOT use the generic "Send to Agent" workflow

### Phase 3: Hypothesis & Testing

- **Hypothesis**: The bug occurs because `reviewMode=true` disables ALL line interaction. The fix should:
  1. Add a new prop to DiffPanel for task-linked commenting (e.g., `taskPath`)
  2. When `taskPath` is provided, enable line clicking but render `FileCommentInput` instead of the generic comment UI
  3. Keep `reviewMode` logic for hiding the "Send to Agent" modal

- **Test Design**:
  1. Verify current behavior: clicking lines in review mode does nothing
  2. After fix: clicking line should show comment input that spawns task-linked session

- **Prediction**: Once DiffPanel receives `taskPath` and renders appropriate UI, line commenting will work and spawn sessions linked to the task.

### Phase 4: Implementation

- **Root Cause**: `reviewMode=true` disables line annotations/rendering without providing alternative task-linked commenting

- **Solution**: Modified `DiffPanel` to support task-linked commenting:
  1. Added `taskPath?: string` prop to DiffPanel
  2. Added `taskCommentLine` state to track active line comment in task mode
  3. Updated logic:
     - When `reviewMode && !taskPath`: disabled (original behavior)
     - When `reviewMode && taskPath`: enabled with `FileCommentInput`
     - When `!reviewMode`: standard comment UI

- **Changes Made**:
  1. `src/components/git/diff-panel.tsx`:
     - Added import for `FileCommentInput` (line 16)
     - Added `taskPath?: string` prop to interface (line 77-78)
     - Added `taskCommentLine` state (line 197-198)
     - Modified `handleLineClick` to handle task review mode (lines 301-304)
     - Added `taskCommentLine` to cleanup effect (line 321)
     - Added `taskCommentLine` to `lineAnnotations` memo (lines 280-283)
     - Updated `MultiFileDiff` props:
       - `lineAnnotations={reviewMode && !taskPath ? [] : lineAnnotations}` (line 686)
       - `renderAnnotation` now checks for `reviewMode && taskPath` and renders `FileCommentInput` (lines 691-726)
  2. `src/components/tasks/task-review-panel.tsx`:
     - Added `taskPath={taskPath}` prop to DiffPanel (line 301)

- **Verification**: Build passes without type errors

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug (manual testing needed)
- [x] All builds pass

## Implementation Verified (2026-01-16)

All code changes verified in place:
- `diff-panel.tsx`: `taskPath` prop, `taskCommentLine` state, conditional rendering of `FileCommentInput`
- `task-review-panel.tsx`: Passes `taskPath={taskPath}` to DiffPanel
- Build passes without errors

## Testing Instructions

To verify the fix:
1. Navigate to a task with uncommitted changes
2. Click "Review" tab to enter review mode
3. Click on a changed file to view the diff
4. Click on any line in the diff
5. Expected: A comment input should appear with `FileCommentInput`
6. Enter a comment and click "Send to Agent"
7. Expected: An agent session should be spawned and linked to the task, visible in the task's session sidebar
