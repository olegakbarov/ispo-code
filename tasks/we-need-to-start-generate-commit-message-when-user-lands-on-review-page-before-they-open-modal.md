# we need to start generate commit message when user lands on review page (before they open modal)

## Problem Statement
Commit message generation starts only after agent completion or modal open. Review page entry still waits for generation, slower commit flow. Need pre-gen on review landing.

## Scope
**In:**
- Trigger commit message generation on review mode entry
- Use pending commit state for pre-gen result/loading
- Skip or reset when no changed files
**Out:**
- Commit modal UX changes
- Generation in edit/debate modes
- Backend commit message logic changes

## Implementation Plan

### Phase: Hook Wiring
- [x] Add review-entry pre-gen trigger gated by `mode === 'review'` and pending commit state
- [x] Extract shared pre-gen helper used by agent-complete and review-entry triggers
- [x] Pass `mode` into `use-task-actions` from `TasksPage`

### Phase: Validation
- [ ] Open `/review` with changes, confirm pending commit generation starts before modal open
- [ ] Open `/review` with no changes, confirm pending commit state cleared

## Key Files
- `src/lib/hooks/use-task-actions.ts` - review-entry trigger + shared helper
- `src/routes/tasks/_page.tsx` - pass mode into hook

## Success Criteria
- [ ] Entering `/review` starts commit message generation without opening modal
- [ ] Commit modal opens with prefilled message or active pending state
- [ ] No duplicate generation when pending message already set

## Implementation Notes

### Changes Made

1. **Added `mode` parameter to `UseTaskActionsParams`** (line 55)
   - Allows hook to know current mode (edit/review/debate)

2. **Extracted shared `triggerCommitMessageGeneration` helper** (lines 677-730)
   - Consolidates pre-gen logic used by both triggers
   - Checks `pendingCommitGenerating` and `pendingCommitMessage` to prevent duplicates
   - Resets pending commit if no changed files found

3. **Refactored agent completion trigger** (lines 736-753)
   - Now uses shared helper instead of inline logic
   - Maintains same behavior: generates on agent completion

4. **Added review mode entry trigger** (lines 759-776)
   - Tracks previous mode with `useRef`
   - Triggers generation when transitioning TO review mode
   - Skips initial mount to avoid premature generation

5. **Passed `mode` from TasksPage to useTaskActions** (line 265)
   - Enables the hook to react to mode changes

### How It Works

When user navigates to `/review`:
1. URL changes to `/tasks/{task-path}/review`
2. TasksPage receives `mode="review"` prop
3. useTaskActions detects mode transition in effect (line 771)
4. Calls `triggerCommitMessageGeneration()` (line 774)
5. Helper checks for duplicates, fetches changed files, generates message
6. Message stored in `pendingCommit[taskPath]` state
7. CommitArchiveModal receives pre-filled message via `initialMessage` prop
8. User opens modal → instant commit message display

### Build Status
✅ TypeScript compilation successful (no type errors)
