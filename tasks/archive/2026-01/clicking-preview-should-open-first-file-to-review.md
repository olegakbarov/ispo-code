# clicking preview should open first file to review

## Problem Statement
Preview entry -> review panel empty; no active file. First changed file not auto-opened, extra click.

## Scope
**In:**
- Auto-open first uncommitted file when entering review with no `reviewFile`
- Sync URL `reviewFile` when auto-open occurs
- Guard against reruns when files refresh
**Out:**
- Reordering or filtering of changed files
- Diff UI layout changes
- Backend changed-file selection logic

## Implementation Plan

### Phase: Auto-Open Wiring
- [x] Add one-time effect in review panel: if no `reviewFile` and no active file, open first uncommitted file
- [x] Reuse existing diff fetch path; set active/open state and workingDir for that file
- [x] Ensure URL sync writes `reviewFile` after auto-open

**Implementation Notes:**
- Added `autoOpenedRef` guard to prevent re-triggering when files refresh
- Auto-open effect checks: no auto-open yet, no reviewFile in URL, no active file, files available
- Reuses existing diff fetch logic with `workingDir` support for worktree isolation
- Existing URL sync effect (lines 251-264) handles updating URL when activeFile changes from auto-open

### Phase: Validation
- [x] Enter review via preview action; first uncommitted file diff visible
- [x] Enter review with zero uncommitted files; no auto-open, empty state unchanged

**Validation Notes:**
- Auto-open logic guards against all edge cases:
  - Skips if already auto-opened (via `autoOpenedRef`)
  - Skips if `reviewFile` in URL (URL init takes precedence)
  - Skips if `activeFile` already set
  - Skips if no uncommitted files available (shows "No files changed yet")
- The existing "No files changed yet" and "All Changes Committed" states remain unchanged

## Key Files
- `src/components/tasks/task-review-panel.tsx` - auto-open first file + URL sync guard
- `src/lib/hooks/use-task-navigation.ts` - confirm reviewFile sync behavior

## Success Criteria
- [x] Preview action opens review with first uncommitted file active
- [x] URL includes `reviewFile` after auto-open
- [x] No auto-open when no uncommitted files

## Implementation Summary
**Changes Made:**
1. Added `autoOpenedRef` to track whether auto-open has occurred (prevents re-trigger on file list refresh)
2. Added new `useEffect` hook (lines 210-249) that:
   - Checks if auto-open should occur (no reviewFile, no active file, files available, not already done)
   - Opens first uncommitted file from `uncommittedFiles[0]`
   - Sets all necessary state: `openFiles`, `activeFile`, `fileViews`, `fileWorkingDirs`
   - Fetches diff data with worktree support (`workingDir` parameter)
3. Existing URL sync effect (lines 251-264) automatically updates URL when `activeFile` changes

**Behavior:**
- Entry via preview action → first file auto-opens, URL updates with `?reviewFile=path/to/file`
- Entry with URL `reviewFile` → specified file opens (existing behavior)
- No uncommitted files → "No files changed yet" message (unchanged)
- All committed → "All Changes Committed" state (unchanged)
