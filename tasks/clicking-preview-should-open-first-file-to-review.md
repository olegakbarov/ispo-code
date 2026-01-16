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
- [ ] Add one-time effect in review panel: if no `reviewFile` and no active file, open first uncommitted file
- [ ] Reuse existing diff fetch path; set active/open state and workingDir for that file
- [ ] Ensure URL sync writes `reviewFile` after auto-open

### Phase: Validation
- [ ] Enter review via preview action; first uncommitted file diff visible
- [ ] Enter review with zero uncommitted files; no auto-open, empty state unchanged

## Key Files
- `src/components/tasks/task-review-panel.tsx` - auto-open first file + URL sync guard
- `src/lib/hooks/use-task-navigation.ts` - confirm reviewFile sync behavior

## Success Criteria
- [ ] Preview action opens review with first uncommitted file active
- [ ] URL includes `reviewFile` after auto-open
- [ ] No auto-open when no uncommitted files
