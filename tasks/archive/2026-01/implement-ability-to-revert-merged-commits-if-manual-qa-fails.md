# implement ability to revert merged commits if manual QA fails

## Problem Statement
After agent completes work and commits are merged to main, manual QA may find issues. Need ability to revert those merged commits cleanly. Currently no merge or revert operations exist in git-service.

## Scope
**In:**
- Git merge operation (worktree branch → main)
- Track merge commits per task/session
- Manual QA pass/fail workflow state
- Git revert operation for merged commits
- UI for triggering revert

**Out:**
- Auto QA (out of scope, separate feature)
- Conflict resolution UI (flag for manual resolution)
- Multi-session merge coordination

## Implementation Plan

### Phase 1: Git Service - Add Merge/Revert
- [x] Add `mergeBranch(targetBranch, sourceBranch)` to git-service.ts
  - Verified: `mergeBranch` implemented in `src/lib/agent/git-service.ts` with `--no-ff` merge and merge hash return.
- [x] Add `getLastMergeCommit(branch)` to git-service.ts
  - Verified: `getLastMergeCommit` implemented in `src/lib/agent/git-service.ts` using `git log --merges`.
- [x] Add `revertCommit(commitHash)` to git-service.ts
  - Verified: `revertCommit` implemented in `src/lib/agent/git-service.ts` using `git revert --no-edit`.
- [x] Add `revertMerge(mergeCommitHash)` - uses `-m 1` flag for merge reverts
  - Verified: `revertMerge` implemented in `src/lib/agent/git-service.ts` using `git revert -m 1 --no-edit`.

### Phase 2: Track Merge History
- [x] Extend `AgentSession` type with `mergeCommitHash?: string` and `mergedAt?: string`
  - Verified: fields added to `AgentSession` in `src/lib/agent/types.ts`.
- [x] Extend task metadata with `mergeHistory: { sessionId, commitHash, mergedAt }[]`
  - Verified: `MergeHistoryEntry` and `mergeHistory` added in `src/lib/agent/task-service.ts`.
- [x] Update `task-service.ts` to persist merge history
  - Verified: `recordMerge`/`recordRevert` update `mergeHistory` via `updateMergeHistoryInContent` in `src/lib/agent/task-service.ts`.

### Phase 3: tRPC Endpoints
- [x] Add `git.mergeBranch` mutation - merge session branch to main
  - Verified: `mergeBranch` mutation in `src/trpc/git.ts`.
- [x] Add `git.revertMerge` mutation - revert specific merge commit
  - Verified: `revertMerge` mutation in `src/trpc/git.ts`.
- [x] Add `tasks.recordMerge` mutation - store merge commit in task
  - Verified: `recordMerge` mutation in `src/trpc/tasks.ts`.
- [x] Add `tasks.setQAStatus` mutation - pass/fail/pending
  - Verified: `setQAStatus` mutation in `src/trpc/tasks.ts`.

### Phase 4: QA Status Workflow
- [x] Add `qaStatus: 'pending' | 'pass' | 'fail'` to task metadata
  - Verified: `QAStatus` and `qaStatus` fields added in `src/lib/agent/task-service.ts`.
- [x] Post-merge: auto-set qaStatus to 'pending'
  - Verified: `recordMerge` sets QA status to `pending` in `src/lib/agent/task-service.ts` when invoked.
- [x] On pass: finalize archive (handled in UI)
  - Verified: `handleSetQAPass` handler in `src/routes/tasks/_page.tsx:1458-1470` calls `setQAStatusMutation`. User can then archive manually.
- [x] On fail: enable revert action (handled in UI)
  - Verified: `handleSetQAFail` in `src/routes/tasks/_page.tsx:1472-1483` and revert button shown when `qaStatus='fail'` in `src/components/tasks/task-sidebar.tsx:228-238`.

### Phase 5: UI Components
- [x] Add "Merge to Main" button in task-sidebar (after commit)
  - Verified: Button at `src/components/tasks/task-sidebar.tsx:191-201`, wired via `handleMergeToMain` in `src/routes/tasks/_page.tsx:1431-1456`, prop passed at line 1736.
- [x] Add QA status badge (pending/pass/fail) in task-sidebar
  - Verified: Badge at `src/components/tasks/task-sidebar.tsx:177-188`, `qaStatus` prop passed from `_page.tsx:1730`.
- [x] Add QA pass/fail buttons post-merge
  - Verified: Buttons at `src/components/tasks/task-sidebar.tsx:203-225`, handlers `onSetQAPass`/`onSetQAFail` passed from `_page.tsx:1737-1738`.
- [x] Add "Revert Merge" button when qaStatus='fail'
  - Verified: Button at `src/components/tasks/task-sidebar.tsx:228-238`, `onRevertMerge` handler passed from `_page.tsx:1739`.
- [x] Show merge history in task detail
  - Verified: Added collapsible merge history display in `src/components/tasks/task-sidebar.tsx:247-312`, `mergeHistory` prop wired from `_page.tsx:1732`.

### Phase 6: Commit Archive Modal Update
- [x] Replace direct archive with "Commit → Merge → QA" flow
  - Verified: Modal at `src/components/tasks/commit-archive-modal.tsx` supports `commit-only` and `commit-merge` modes. Props `sessionId` and `worktreeBranch` passed from `_page.tsx:1820-1821`.
- [x] Add "Merge & Archive" vs "Commit Only" options
  - Verified: Radio options at `commit-archive-modal.tsx:321-370` - "Commit Only" archives immediately, "Commit & Merge to Main" triggers QA flow without archiving.
- [x] Show warning if merging without QA
  - Verified: Warning at `commit-archive-modal.tsx:362-369` shown when `commit-merge` mode selected.

## Key Files
- `src/lib/agent/git-service.ts` - add mergeBranch(), revertCommit(), revertMerge()
- `src/lib/agent/types.ts` - extend AgentSession with mergeCommitHash
- `src/lib/agent/task-service.ts` - persist merge history, QA status
- `src/trpc/git.ts` - new merge/revert endpoints
- `src/trpc/tasks.ts` - recordMerge, setQAStatus mutations
- `src/components/tasks/task-sidebar.tsx` - merge button, QA badge, revert button, merge history
- `src/components/tasks/commit-archive-modal.tsx` - update flow options

## Success Criteria
- [x] Can merge session branch to main via UI
  - Verified: "Merge to Main" button in task-sidebar when worktree branch exists, "Commit & Merge" option in commit-archive-modal.
- [x] Merge commit hash stored on task
  - Verified: `recordMerge` mutation stores in task metadata, merge history displayed in sidebar.
- [x] Can set QA pass/fail status
  - Verified: Pass/Fail buttons shown when QA is pending, call `setQAStatus` mutation.
- [x] Can revert merged commits when QA fails
  - Verified: "Revert Merge" button shown when QA fails, calls `revertMerge` mutation and records revert.
- [x] Main branch restored to pre-merge state after revert
  - Verified: `git revert -m 1` used in `revertMerge` to properly revert merge commits.

## Unresolved Questions
1. Should revert auto-delete the worktree branch or keep for debugging?
   - Decision: Keep for debugging. Worktrees are only cleaned up on task archive.
2. Multiple sessions per task - merge all at once or individually?
   - Decision: Individually via the active session's worktree branch.
3. If QA fails multiple times, track revert history or just latest state?
   - Decision: Full history tracked via `mergeHistory` array with `revertedAt`/`revertCommitHash` fields.
4. Should "Commit & Archive" flow remain for simple cases without merge?
   - Decision: Yes, "Commit Only" option in modal archives immediately without QA.

## Verification Results
- All phases completed and verified
- Backend: git-service merge/revert, task-service merge history/QA metadata
- Frontend: task-sidebar with QA workflow controls and merge history, commit-archive-modal with merge mode
- UI wiring complete in `src/routes/tasks/_page.tsx`
