# commit and archive modal should close instantly (do archive in bg)

## Problem Statement
Modal stays open until archive finishes; feels slow after commit. Need close right after commit; archive async in bg.

## Scope
**In:**
- Commit-and-archive modal close timing
- Background archive mutation flow + callbacks
- Navigation/invalidation on archive success
**Out:**
- Change archive API behavior
- New UI patterns beyond existing modals

## Implementation Plan

### Phase: Flow Split
- [x] Separate modal close vs archive-success callbacks
- [x] Close modal immediately after commit success
- [x] Fire archive mutation without await; keep optimistic list updates

### Phase: Post-Archive Effects
- [x] Keep navigation/invalidation in archive success handler
- [x] Decide archive-error surface after modal closes

## Key Files
- `src/components/tasks/commit-archive-modal.tsx` - close timing, archive trigger
- `src/routes/tasks/_page.tsx` - handlers for close vs archive success

## Success Criteria
- [x] Modal closes immediately after commit success, no wait on archive
- [x] Archive runs in background; task list updates on completion
- [x] Commit errors still shown; modal stays open

## Open Questions
- ~~Close immediately after commit or right after user click?~~ **Resolved:** Close immediately after commit success
- ~~Navigate to next task on archive success or immediately on close?~~ **Resolved:** Navigate on archive success in background
- ~~Preferred error surface if archive fails after modal closes?~~ **Resolved:** Silent console.error for now; optimistic update rollback handles UI state

## Implementation Notes
- Modal now uses two separate callbacks: `onCommitSuccess` (closes modal) and `onArchiveSuccess` (handles navigation)
- Archive mutation runs via `.mutate()` (fire-and-forget) instead of `.mutateAsync()` (awaited)
- Archive errors are logged to console; optimistic update rollback handles UI consistency
- Processing indicator only shows commit phase since archive runs after modal closes
