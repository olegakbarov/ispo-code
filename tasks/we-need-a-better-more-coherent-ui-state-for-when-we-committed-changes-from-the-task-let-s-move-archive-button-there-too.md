# Better post-commit UI state + relocate archive button

## Problem Statement
Archive button not appearing after commit. `commitMutation.onSettled` doesn't invalidate `hasUncommittedChanges` query → `allCommitted` stays false.

## Scope
**In:**
- Fix: invalidate `hasUncommittedChanges` in commit mutation
- Verify archive button renders post-commit

**Out:**
- UI changes (already correct)
- Backend changes

## Implementation Plan

### Phase: Bug Fix
- [x] Add `utils.tasks.hasUncommittedChanges.invalidate()` to `commitMutation.onSettled` in `task-review-panel.tsx:174-178`
- [ ] Test: commit files → archive button appears

## Key Files
- `src/components/tasks/task-review-panel.tsx:174-178` - missing invalidation

## Root Cause
**File:** `src/components/tasks/task-review-panel.tsx:174-178`

```tsx
onSettled: () => {
  utils.git.status.invalidate()
  utils.tasks.getChangedFilesForTask.invalidate()
  // MISSING: utils.tasks.hasUncommittedChanges.invalidate()
}
```

After commit:
- `changedFiles` → empty (optimistic update works)
- `uncommittedStatus.hasUncommitted` → **stale true** (query not refetched)
- `allCommitted = empty && !true` → **false**

## Success Criteria
- [ ] Archive button visible after committing all task files
