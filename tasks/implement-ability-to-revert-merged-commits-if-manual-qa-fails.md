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
- [ ] On pass: finalize archive (handled in UI)
  - Not found: no UI wiring to call `setQAStatus` and then archive in `src/routes/tasks/_page.tsx`.
- [ ] On fail: enable revert action (handled in UI)
  - Not found: no UI wiring for revert action in `src/routes/tasks/_page.tsx`.

### Phase 5: UI Components
- [ ] Add "Merge to Main" button in task-sidebar (after commit)
  - Not wired: button exists in `src/components/tasks/task-sidebar.tsx`, but no handlers/props passed from `src/routes/tasks/_page.tsx`.
- [ ] Add QA status badge (pending/pass/fail) in task-sidebar
  - Not wired: badge exists in `src/components/tasks/task-sidebar.tsx`, but `qaStatus` not provided by `src/routes/tasks/_page.tsx`.
- [ ] Add QA pass/fail buttons post-merge
  - Not wired: buttons exist in `src/components/tasks/task-sidebar.tsx`, but handlers are not passed from `src/routes/tasks/_page.tsx`.
- [ ] Add "Revert Merge" button when qaStatus='fail'
  - Not wired: button exists in `src/components/tasks/task-sidebar.tsx`, but no revert handler is passed from `src/routes/tasks/_page.tsx`.
- [ ] Show merge history in task detail
  - Not found: no UI rendering of `mergeHistory` in `src/components/tasks` or `src/routes/tasks/_page.tsx`.

### Phase 6: Commit Archive Modal Update
- [ ] Replace direct archive with "Commit → Merge → QA" flow
  - Not implemented end-to-end: merge mode exists in `src/components/tasks/commit-archive-modal.tsx`, but is never enabled because `sessionId`/`worktreeBranch` are not passed from `src/routes/tasks/_page.tsx`, and no archive-after-QA flow is present.
- [ ] Add "Merge & Archive" vs "Commit Only" options
  - Not found: modal offers "Commit Only" and "Commit & Merge to Main" in `src/components/tasks/commit-archive-modal.tsx`, but no "Merge & Archive" option and merge mode is not enabled from `src/routes/tasks/_page.tsx`.
- [ ] Show warning if merging without QA
  - Not reachable: warning exists in `src/components/tasks/commit-archive-modal.tsx`, but merge option is disabled without `sessionId`/`worktreeBranch`.

## Key Files
- `src/lib/agent/git-service.ts` - add mergeBranch(), revertCommit(), revertMerge()
- `src/lib/agent/types.ts` - extend AgentSession with mergeCommitHash
- `src/lib/agent/task-service.ts` - persist merge history, QA status
- `src/trpc/git.ts` - new merge/revert endpoints
- `src/trpc/tasks.ts` - recordMerge, setQAStatus mutations
- `src/components/tasks/task-sidebar.tsx` - merge button, QA badge, revert button
- `src/components/tasks/commit-archive-modal.tsx` - update flow options

## Success Criteria
- [ ] Can merge session branch to main via UI
  - Not verified: merge UI not enabled because `CommitArchiveModal` lacks `sessionId`/`worktreeBranch` in `src/routes/tasks/_page.tsx`.
- [ ] Merge commit hash stored on task
  - Not verified: `recordMerge` exists in `src/trpc/tasks.ts`, but merge flow is not reachable from UI in `src/routes/tasks/_page.tsx`.
- [ ] Can set QA pass/fail status
  - Not verified: `setQAStatus` exists in `src/trpc/tasks.ts` but no UI calls it.
- [ ] Can revert merged commits when QA fails
  - Not verified: `revertMerge`/`recordRevert` exist in `src/trpc/git.ts` and `src/trpc/tasks.ts`, but no UI wiring.
- [ ] Main branch restored to pre-merge state after revert
  - Not verified: no executed revert path, and tests could not be run.

## Unresolved Questions
1. Should revert auto-delete the worktree branch or keep for debugging?
2. Multiple sessions per task - merge all at once or individually?
3. If QA fails multiple times, track revert history or just latest state?
4. Should "Commit & Archive" flow remain for simple cases without merge?

## Verification Results
- Tests: `npm run test:run` failed with `spawn sh EAGAIN`; no test results produced.
- Verified backend additions: git-service merge/revert helpers and task-service merge history/QA metadata are present.
- UI workflow is incomplete: merge/QA/revert controls are not wired in `src/routes/tasks/_page.tsx`, and merge history is not displayed.