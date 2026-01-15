# Better post-commit UI state + relocate archive button

## Problem Statement
Archive button not appearing after commit.

## Root Cause Analysis

### Original (Incorrect) Analysis
The original analysis claimed missing `hasUncommittedChanges.invalidate()` was the cause. That invalidation was already present at line 178.

### Actual Root Cause
The `allCommitted` condition logic was wrong:

```tsx
// WRONG (original)
const allCommitted = changedFiles.length === 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted
```

**Why it failed:**
- `changedFiles` comes from `getChangedFilesForTask` which returns ALL files ever changed by session streams
- These files persist in stream history even after commit
- So `changedFiles.length === 0` is **always false** after any work is done → `allCommitted` never true

## Fix Applied

### 1. Fixed `allCommitted` condition (line 205)
```tsx
// CORRECT - work exists (>0) AND all committed
const allCommitted = changedFiles.length > 0 && uncommittedStatus && !uncommittedStatus.hasUncommitted
```

### 2. Filter displayed files to only uncommitted (lines 207-225)
```tsx
const uncommittedFiles = useMemo(() => {
  if (!uncommittedStatus?.uncommittedFiles) return changedFiles
  const uncommittedSet = new Set(uncommittedStatus.uncommittedFiles)
  return changedFiles.filter(f => {
    const gitPath = f.repoRelativePath || f.relativePath || f.path
    return uncommittedSet.has(gitPath)
  })
}, [changedFiles, uncommittedStatus])

const filesBySession = useMemo(() => {
  const grouped = new Map<string, typeof uncommittedFiles>()
  for (const file of uncommittedFiles) { ... }
}, [uncommittedFiles])
```

### 3. Updated all UI references
Changed all display logic to use `uncommittedFiles` instead of `changedFiles`.

## Key File
- `src/components/tasks/task-review-panel.tsx`

## Success Criteria
- [x] Archive button visible after committing all task files
- [x] File list only shows uncommitted files
- [x] Build passes
