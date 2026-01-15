# Add ARIA Labels for Accessibility

**Priority**: Medium
**Category**: Accessibility
**Status**: Completed

## Problem

0 ARIA attributes found in component files. Many toggle buttons and interactive elements lack proper accessibility.

## Examples

### task-list-sidebar.tsx (line 147)
```tsx
// Bad
<button
  onClick={() => handleArchiveFilterChange('all')}
  className="px-2 py-1 rounded text-[10px]..."
>
  All
</button>

// Good
<button
  onClick={() => handleArchiveFilterChange('all')}
  aria-label="Show all tasks"
  aria-pressed={archiveFilter === 'all'}
  className="..."
>
  All
</button>
```

### thread-sidebar.tsx (line 348)
```tsx
// Bad
<button onClick={toggleAll}>
  {selectedFiles.size === changedFiles.length ? "none" : "all"}
</button>

// Good
<button
  onClick={toggleAll}
  aria-label={selectedFiles.size === changedFiles.length ? "Deselect all files" : "Select all files"}
  aria-pressed={selectedFiles.size === changedFiles.length}
>
  {selectedFiles.size === changedFiles.length ? "none" : "all"}
</button>
```

## Locations to Fix

- [x] `src/components/tasks/task-list-sidebar.tsx` - Filter toggle buttons
  - ✓ Verified: `role="tablist"` at line 145, `role="tab"` and `aria-selected` on All/Active/Archived buttons at lines 148-183, `role="group"` for sort options at line 198, `aria-label` and `aria-pressed` on sort buttons
- [x] `src/components/agents/thread-sidebar.tsx` - File selection toggle
  - ✓ Verified: `aria-label` and `aria-pressed` on toggleAll button at lines 350-351, `aria-label` on AI generate button (line 408), `aria-label` on commit button (line 436), `aria-hidden="true"` on Loader2, Sparkles, GitCommit icons
- [x] `src/components/git/diff-panel.tsx` - Tab buttons, close buttons
  - ✓ Verified: `role="tablist"` at lines 988 and 1048, `role="tab"` and `aria-selected` on file tabs (lines 1001-1002) and Working/Staged buttons (lines 1051-1066), `aria-label` on close buttons (line 1032), keyboard handlers with Enter/Space at lines 1006-1010, `tabIndex` at line 1004, `aria-hidden="true"` on badge (line 1023)
- [x] `src/components/tasks/task-review-panel.tsx` - Various action buttons
  - ✓ Verified: `aria-label` and `aria-pressed` on select all button (lines 481-482), `aria-expanded` and `aria-label` on session accordion buttons (lines 499-500), `aria-expanded` on commit history toggle (line 567), `aria-expanded` on individual commit buttons (lines 603-604), `aria-label` on generate message button (line 670), `aria-labelledby` on textarea (line 680), `aria-label` on commit button (line 693), `aria-label` on archive/restore buttons (lines 429, 450), `aria-hidden="true"` on all decorative icons
- [x] All icon-only buttons across components
  - ✓ Verified: Icons inside buttons have appropriate `aria-hidden="true"` or buttons have `aria-label` attributes

## Additional Fixes

- [x] Add `role="tablist"` to tab containers
  - ✓ Verified: Found in task-list-sidebar.tsx:145, diff-panel.tsx:988, diff-panel.tsx:1048
- [x] Add `role="tab"` and `aria-selected` to tab buttons
  - ✓ Verified: Found in task-list-sidebar.tsx (3 instances), diff-panel.tsx (3 instances)
- [x] Ensure keyboard navigation with `onKeyDown` handlers for Enter/Space
  - ✓ Verified: diff-panel.tsx:1006-1010 has keyboard handler for file tabs
- [ ] Check contrast ratios for `text-muted-foreground` on `bg-secondary/60` (not code-related)

## Implementation Summary

### task-list-sidebar.tsx
- Added `role="tablist"` and `aria-label="Task filter"` to archive filter container
- Added `role="tab"`, `aria-selected`, and `aria-label` to All/Active/Archived buttons
- Added `role="group"` and `aria-label="Sort options"` to sort buttons container
- Added `aria-label` and `aria-pressed` to sort buttons
- Added `aria-hidden="true"` to decorative icons

### thread-sidebar.tsx
- Added `aria-label` and `aria-pressed` to select all/none toggle button
- Added `aria-label` to AI commit message generation button
- Added `aria-label` to commit button
- Added `aria-hidden="true"` to decorative icons (Loader2, Sparkles, GitCommit)

### diff-panel.tsx
- Added `role="tablist"` and `aria-label="Open files"` to file tabs container
- Added `role="tab"`, `aria-selected`, `aria-label`, and keyboard handlers to file tabs
- Added `aria-label` to close file buttons
- Added `role="tablist"` and `role="tab"` to Working/Staged view toggle
- Added `aria-label` to "To Agent", "Close all", "Submit file", "Submit all" buttons
- Added `aria-label` to modal close button
- Added `aria-hidden="true"` to decorative badge elements
- Added `tabIndex` and `onKeyDown` for keyboard navigation

### task-review-panel.tsx
- Added `aria-label` and `aria-pressed` to select all toggle button
- Added `aria-expanded` and `aria-label` to session accordion buttons
- Added `aria-expanded` and `aria-label` to commit history toggle
- Added `aria-expanded` and `aria-label` to individual commit toggle buttons
- Added `aria-label` to generate commit message button
- Added `aria-labelledby` to commit message textarea
- Added `aria-label` to commit button
- Added `aria-label` to archive/restore buttons
- Added `aria-hidden="true"` to decorative icons (ChevronDown, ChevronRight, History, Loader2, GitCommit, Archive, RotateCcw)

## Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| task-list-sidebar.tsx ARIA | ✓ Complete | 15 ARIA attributes found, including `role="tablist"`, `role="tab"`, `aria-selected`, `aria-label`, `aria-pressed`, `role="group"`, `aria-hidden` |
| thread-sidebar.tsx ARIA | ✓ Complete | 8 ARIA attributes found, including `aria-label`, `aria-pressed`, `aria-hidden` on decorative icons |
| diff-panel.tsx ARIA | ✓ Complete | 18 ARIA attributes found, including `role="tablist"`, `role="tab"`, `aria-selected`, `aria-label`, `aria-hidden`, keyboard handlers |
| task-review-panel.tsx ARIA | ✓ Complete | 26 ARIA attributes found, including `aria-label`, `aria-pressed`, `aria-expanded`, `aria-labelledby`, `aria-hidden` |
| Keyboard navigation | ✓ Complete | `onKeyDown` handler for Enter/Space in diff-panel.tsx:1006-1010, `tabIndex` management at line 1004 |
| Icon-only buttons | ✓ Complete | All icon-only buttons have `aria-label` or icons have `aria-hidden="true"` |

**Total ARIA attributes found**: 67 across 4 files (verified via grep)

**Verification Date**: 2026-01-15