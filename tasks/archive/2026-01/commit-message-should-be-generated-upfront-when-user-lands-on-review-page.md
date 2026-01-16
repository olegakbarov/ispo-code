# commit message should be generated upfront when user lands on review page

## Problem Statement
Review page initial load skips commit message pregen. Commit modal opens empty; generation starts late. Need pregen on review landing.

## Scope
**In:**
- Review initial load pregen
- Review-mode task switch pregen
- Preserve current pregen triggers
**Out:**
- Commit message prompt/model changes
- Commit/archive UI changes
- Backend API changes outside existing tRPC calls

## Implementation Plan

### Phase: Review Entry Pregen
- [x] Review entry effect update in `src/lib/hooks/use-task-actions.ts` for initial review mount
- [x] Path-change trigger in `src/lib/hooks/use-task-actions.ts` for review mode
- [x] Test coverage in `src/lib/hooks/__tests__/use-task-actions.test.ts` for review mount pregen

## Key Files
- `src/lib/hooks/use-task-actions.ts` - review entry commit message pregen
- `src/lib/hooks/__tests__/use-task-actions.test.ts` - hook behavior coverage

## Success Criteria
- [x] Direct load of `/tasks/<path>/review` yields pending commit message before modal open

## Implementation Notes

### Changes Made

1. **Review Entry Effect (use-task-actions.ts:873-895)**
   - Removed "skip on initial mount" guard (`prevMode === undefined`)
   - Added `prevReviewPathRef` to track path changes within review mode
   - Effect now triggers on:
     - Initial mount in review mode (direct navigation to `/tasks/<path>/review`)
     - Mode transition to review (clicking "Review" button)
     - Path change while staying in review mode (switching tasks in review)

2. **Test Coverage (use-task-actions.test.ts:705-830)**
   - Added comprehensive test suite: "Commit Message Pregeneration - Review Mode Entry"
   - 9 test cases covering:
     - Initial mount in review mode (primary fix)
     - Mode transitions (edit → review)
     - Path changes within review mode
     - Edge cases (null paths, rapid transitions, same path re-renders)
   - All 25 tests pass

### How It Works

The effect uses two refs to track state:
- `prevModeRef`: Tracks previous mode (edit/review/debate)
- `prevReviewPathRef`: Tracks previous path only when in review mode

Trigger conditions:
```typescript
const isEnteringReview = (prevMode === undefined || prevMode !== 'review') && mode === 'review'
const isPathChangeInReview = prevPath !== null && prevPath !== selectedPath && mode === 'review'
```

The `triggerCommitMessageGeneration` helper already has guards to prevent duplicate generation if a message already exists or is currently generating.
