# Apply React.memo for Performance

**Priority**: High
**Category**: Performance
**Status**: ✅ Completed

## Problem

Only 7 instances of `React.memo` in entire components directory. Large components re-render fully on any state change.

Key offenders:
- `diff-panel.tsx` - Multiple state sources trigger full re-renders
- `task-review-panel.tsx` - Complex state causes unnecessary renders
- `thread-sidebar.tsx` - File list re-renders on unrelated changes

## Fix

Apply `React.memo` to stable sub-components:

```tsx
// Example: diff-panel.tsx
export const FileTab = React.memo(({ file, isActive, onClose }: Props) => {
  // ...
})

export const DiffViewer = React.memo(({ diff, theme }: Props) => {
  // ...
})
```

## Target Components

- [x] `src/components/git/diff-panel.tsx` - DiffTabsHeader (memoized)
- [x] `src/components/agents/changed-files-list.tsx` - FileItem, FileGroup (memoized)
- [x] `src/components/tasks/task-list-sidebar.tsx` - TaskItem (extracted and memoized)
- [x] `src/components/agents/tool-result.tsx` - ToolResult (memoized)

## Also Fix

- [x] `changed-files-list.tsx` line 18 - mutable default Set (fixed with module-level constant)

```tsx
// Bad: Creates new Set on every call
expandedFiles = new Set()

// Good: Use module-level constant
const DEFAULT_EXPANDED_FILES = new Set<string>()
expandedFiles = DEFAULT_EXPANDED_FILES
```

## Completed Changes

1. **changed-files-list.tsx**:
   - Added `DEFAULT_EXPANDED_FILES` module-level constant
   - Wrapped `FileItem` with `memo()`
   - Wrapped `FileGroup` with `memo()`

2. **diff-panel.tsx**:
   - Wrapped `DiffTabsHeader` with `memo()`

3. **task-list-sidebar.tsx**:
   - Extracted inline task rendering into `TaskItem` component
   - Wrapped `TaskItem` with `memo()`

4. **tool-result.tsx**:
   - Wrapped `ToolResult` with `memo()`
