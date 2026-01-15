# we need to generate commit message as soon as implementation step is done and pre-populate the textarea in 'commit and archive'

## Problem Statement
Commit messages generated only when modal opens, causing UX delay. Need pre-generation when agent completes implementation so message is ready instantly.

## Scope
**In:**
- Pre-generate commit message on agent session completion
- Store pending message in task-level state
- Pre-populate modal textarea with cached message
- Show loading state if generation still in progress

**Out:**
- Progress-based generation (only on full completion)
- Persistent storage of pending messages
- Multiple message caching per task

## Implementation Plan

### Phase: State Management
- [x] Add `pendingCommitMessage` state to tasks page (`_page.tsx`)
  - ✓ Verified: `pendingCommit` state added in `tasks-reducer.ts:61-66` as `PendingCommitState = Record<string, PendingCommitEntry>`, destructured and used in `_page.tsx:120,125-127`
- [x] Add `isGeneratingCommitMessage` loading state
  - ✓ Verified: `isGenerating` property in `PendingCommitEntry` interface (`tasks-reducer.ts:63`), accessed as `pendingCommitGenerating` in `_page.tsx:127`
- [x] Pass `pendingCommitMessage` to `CommitArchiveModal` as `initialMessage` prop
  - ✓ Verified: Props passed at `_page.tsx:1324-1325`: `initialMessage={pendingCommitMessage}` and `isGeneratingInitial={pendingCommitGenerating}`

### Phase: Trigger on Completion
- [x] Detect session completion transition (pattern: `useAudioNotification.ts:96-108`)
  - ✓ Verified: Pattern correctly replicated using `prevAgentStatusRef` in `_page.tsx:761-832`
- [x] Add `useEffect` watching `agentSession?.status` for `completed` transition
  - ✓ Verified: Effect at `_page.tsx:762-832` watches `agentSession?.status` in dependency array (line 825)
- [x] Call `generateCommitMessage` mutation when agent completes
  - ✓ Verified: `utils.client.git.generateCommitMessage.mutate()` called at `_page.tsx:800-811`
- [x] Store result in `pendingCommitMessage` state
  - ✓ Verified: Dispatch at `_page.tsx:807-810` stores message via `SET_PENDING_COMMIT_MESSAGE` action

### Phase: Modal Integration
- [x] Add `initialMessage?: string` prop to `CommitArchiveModal`
  - ✓ Verified: Props defined in interface at `commit-archive-modal.tsx:16-19`: `initialMessage?: string | null` and `isGeneratingInitial?: boolean`
- [x] Use `initialMessage` to pre-populate `commitMessage` state if provided
  - ✓ Verified: `useEffect` at `commit-archive-modal.tsx:102-122` sets `commitMessage` from `initialMessage` at line 107: `setCommitMessage(initialMessage)`
- [x] Skip auto-generation in modal if `initialMessage` exists
  - ✓ Verified: Conditional at `commit-archive-modal.tsx:106-109` returns early if `initialMessage` provided; line 112 checks `isGeneratingInitial` before auto-generating
- [x] Clear `pendingCommitMessage` after modal closes
  - ✓ Verified: `handleCloseCommitArchiveModal` at `_page.tsx:1057-1062` dispatches `RESET_PENDING_COMMIT`; also in `handleCommitArchiveSuccess` at `_page.tsx:1066-1068`

### Phase: Edge Cases
- [x] Reset `pendingCommitMessage` when task selection changes
  - ✓ Verified: The per-task keyed state (`Record<string, PendingCommitEntry>`) means each task has its own state; selecting a different task accesses that task's entry via `pendingCommit[selectedPath]` at `_page.tsx:125`
- [x] Handle generation failure gracefully (fallback to modal generation)
  - ✓ Verified: Catch block at `_page.tsx:813-815` logs error; modal's `useEffect` at `commit-archive-modal.tsx:115-121` will auto-generate if no `initialMessage` exists
- [x] Avoid duplicate generation if already pending
  - ✓ Verified: Guard at `_page.tsx:770` checks `pendingCommitGenerating || pendingCommitMessage` before starting; modal checks `generateMutation.isPending` at line 115

## Key Files
- `src/routes/tasks/_page.tsx:139` - add state, completion detection
- `src/components/tasks/commit-archive-modal.tsx:30,72-81` - accept/use initial message
- `src/lib/hooks/use-audio-notification.ts` - pattern reference for status transition

## Success Criteria
- [x] Message pre-generated before modal opens
  - ✓ Verified: Generation triggers on status transition to `completed` (`_page.tsx:779`), which happens before user opens modal
- [x] Modal shows message immediately (no loading spinner)
  - ✓ Verified: When `initialMessage` is provided, `useEffect` at `commit-archive-modal.tsx:106-109` sets it immediately without calling `generateMutation`
- [x] Regenerate button still works
  - ✓ Verified: `handleRegenerate` function at `commit-archive-modal.tsx:132-139` allows manual regeneration regardless of initial message
- [x] No duplicate API calls
  - ✓ Verified: Multiple guards in place: `_page.tsx:770` checks existing message/generating state; `commit-archive-modal.tsx:115` checks `generateMutation.isPending`

## Implementation Notes

### Changes Made:

1. **tasks-reducer.ts**: Added `PendingCommitState` interface and `pendingCommit` state with actions:
   - `SET_PENDING_COMMIT_MESSAGE`
   - `SET_PENDING_COMMIT_GENERATING`
   - `RESET_PENDING_COMMIT`

2. **_page.tsx**: Added completion detection effect that:
   - Uses `prevAgentStatusRef` to track status transitions (pattern from `use-audio-notification.ts`)
   - Triggers on transition from `running`/`pending` → `completed`
   - Fetches changed files and generates commit message via `utils.client.git.generateCommitMessage.mutate()`
   - Stores result in `pendingCommit.message`
   - Resets on task selection change

3. **commit-archive-modal.tsx**: Added `initialMessage` and `isGeneratingInitial` props:
   - Uses `initialMessage` if provided (skips auto-generation)
   - Waits for `isGeneratingInitial` to complete before falling back to auto-generation
   - Regenerate button still works for manual refresh

## Verification Results

**All 16 checklist items verified as complete.** The implementation:

1. **State Management**: Properly adds per-task pending commit state to the reducer with message and loading flag
2. **Completion Detection**: Correctly follows the `use-audio-notification.ts` pattern using refs to track status transitions
3. **Modal Integration**: Modal accepts and uses pre-generated messages, with proper fallback to auto-generation
4. **Edge Cases**: Handles task switching (per-task state), generation failures (console.error + fallback), and duplicate prevention (multiple guards)

**Code Quality Notes:**
- Clean separation between reducer state and component logic
- Proper error handling with console.error and fallback behavior
- The per-task keyed state is more robust than a simple single-value state

**No issues found.** All items are correctly implemented and verified.