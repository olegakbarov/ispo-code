# archived tasks should be commited

## Problem Statement
Archive move uncommitted; task file rename, dirty repo. Archived tasks without commit history.

## Scope
**In:**
- Archive commit in `src/trpc/tasks.ts`
- Archive commit message helper in `src/lib/agent/task-service.ts`
- Archive UI handlers in `src/lib/hooks/use-task-actions.ts` and `src/components/tasks/commit-archive-modal.tsx`
**Out:**
- Task markdown format in `tasks/*.md`
- Archive path/date rules in `src/lib/agent/task-service.ts`
- Git API behavior in `src/trpc/git.ts`

## Implementation Plan

### Phase: Archive Commit Backend
- [ ] Update `src/trpc/tasks.ts` archive mutation to commit archive rename
- [ ] Add archive commit message helper in `src/lib/agent/task-service.ts`
- [ ] Add staged-file guard in `src/trpc/tasks.ts`
- [ ] Return archive path + commit hash from `src/trpc/tasks.ts`

### Phase: UI Wiring
- [ ] Update archive handler in `src/lib/hooks/use-task-actions.ts`
- [ ] Update archive handler in `src/components/tasks/commit-archive-modal.tsx`

### Phase: Verification
- [ ] Add `src/lib/agent/__tests__/task-archive-commit.test.ts`
- [ ] Manual check: clean `git status` after archive

## Key Files
- `src/trpc/tasks.ts` - archive mutation commit flow
- `src/lib/agent/task-service.ts` - archive path + message helper
- `src/lib/agent/git-service.ts` - scoped commit helper
- `src/lib/hooks/use-task-actions.ts` - archive handler
- `src/components/tasks/commit-archive-modal.tsx` - archive mutation usage
- `src/lib/agent/__tests__/task-archive-commit.test.ts` - archive commit coverage

## Success Criteria
- [ ] Archive move committed on archive action
- [ ] Clean `git status` after archive with no other changes
- [ ] Archived task visible in archive filter

## Unresolved Questions
- Commit message format for archive move?
- Archive commit separate vs bundled with work commit?
- Behavior when unrelated staged files exist?
