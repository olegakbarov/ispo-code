# Apply React.memo for Performance

**Priority**: High
**Category**: Performance

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

- `src/components/git/diff-panel.tsx` - FileTab, DiffViewer
- `src/components/agents/changed-files-list.tsx` - FileItem
- `src/components/tasks/task-list-sidebar.tsx` - TaskItem
- `src/components/agents/tool-result.tsx` - ToolResultCard

## Also Fix

`changed-files-list.tsx` line 18 - mutable default Set:
```tsx
// Bad: Creates new Set on every call
expandedFiles = new Set()

// Good: Use module-level constant
const DEFAULT_EXPANDED_FILES = new Set<string>()
expandedFiles = DEFAULT_EXPANDED_FILES
```
