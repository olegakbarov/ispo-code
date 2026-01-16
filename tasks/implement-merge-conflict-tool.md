# implement merge conflict resolution tool

## Problem Statement
When merging worktree branches to main, conflicts are detected but not resolvable in UI.
User must manually resolve via CLI. Need in-app conflict resolution workflow.

## Scope
**In:**
- `src/lib/agent/git-service.ts` - conflict detection, file content retrieval, resolution
- `src/trpc/git.ts` - endpoints for conflict state, resolution actions
- `src/components/git/merge-conflict-modal.tsx` - conflict resolution UI
- `src/components/git/conflict-diff-view.tsx` - side-by-side/unified conflict viewer
- `src/lib/hooks/use-task-qa-actions.ts` - wire conflict flow into merge workflow

**Out:**
- 3-way merge algorithm (use git's)
- Automatic conflict resolution / AI suggestions (future)
- Rebase conflict handling (merge only)

## Implementation Plan

### Phase: Backend
- [ ] Add `getConflictDetails(cwd)` in `src/lib/agent/git-service.ts` - returns files with conflict markers, ours/theirs/base content
- [ ] Add `resolveConflict(cwd, file, resolution)` in `src/lib/agent/git-service.ts` - write resolved content, stage file
- [ ] Add `abortMerge(cwd)` in `src/lib/agent/git-service.ts` - git merge --abort
- [ ] Add `continueMerge(cwd)` in `src/lib/agent/git-service.ts` - git commit (after all resolved)
- [ ] Add tRPC endpoints: `git.conflictDetails`, `git.resolveConflict`, `git.abortMerge`, `git.continueMerge`

### Phase: UI Components
- [ ] Create `src/components/git/merge-conflict-modal.tsx` - modal shell, file list, progress
- [ ] Create `src/components/git/conflict-diff-view.tsx` - show ours vs theirs with conflict markers
- [ ] Add resolution actions: accept ours, accept theirs, manual edit
- [ ] Show resolution preview before confirming

### Phase: Integration
- [ ] Modify `mergeBranch` response to include conflict file list when `hasConflicts: true`
- [ ] Open conflict modal from `commit-archive-modal.tsx` when merge fails with conflicts
- [ ] Open conflict modal from `use-task-qa-actions.ts` handleMergeToMain when conflicts
- [ ] After all conflicts resolved, complete merge and continue normal flow

## Key Files
- `src/lib/agent/git-service.ts` - conflict detection + resolution logic
- `src/trpc/git.ts` - conflict endpoints
- `src/components/git/merge-conflict-modal.tsx` - main conflict UI
- `src/components/git/conflict-diff-view.tsx` - diff viewer for conflicts
- `src/components/tasks/commit-archive-modal.tsx` - trigger conflict flow

## Success Criteria
- [ ] When merge has conflicts, UI shows which files conflict
- [ ] User can view ours/theirs diff for each conflicted file
- [ ] User can choose: accept ours, accept theirs, or edit manually
- [ ] After resolving all files, merge completes successfully
- [ ] User can abort merge and return to previous state

## Unresolved Questions
- Should conflict resolution support inline editing or external editor only?
- Show base (common ancestor) content for true 3-way view?
- AI-assisted conflict resolution as future enhancement?
