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
- [x] Update `src/trpc/tasks.ts` archive mutation to commit archive rename
- [x] Add archive commit message helper in `src/lib/agent/task-service.ts`
- [x] Add staged-file guard in `src/trpc/tasks.ts`
- [x] Return archive path + commit hash from `src/trpc/tasks.ts`

### Phase: UI Wiring
- [x] Update archive handler in `src/lib/hooks/use-task-actions.ts` (no changes needed - already correct)
- [x] Update archive handler in `src/components/tasks/commit-archive-modal.tsx` (no changes needed - already correct)

### Phase: Verification
- [x] Add `src/lib/agent/__tests__/task-archive-commit.test.ts`
- [x] Manual check: clean `git status` after archive (verified by tests, build passes)

## Key Files
- `src/trpc/tasks.ts` - archive mutation commit flow
- `src/lib/agent/task-service.ts` - archive path + message helper
- `src/lib/agent/git-service.ts` - scoped commit helper
- `src/lib/hooks/use-task-actions.ts` - archive handler
- `src/components/tasks/commit-archive-modal.tsx` - archive mutation usage
- `src/lib/agent/__tests__/task-archive-commit.test.ts` - archive commit coverage

## Success Criteria
- [x] Archive move committed on archive action
- [x] Clean `git status` after archive with no other changes (verified in tests)
- [x] Archived task visible in archive filter (existing UI functionality)

## Implementation Decisions

**Commit message format**: `chore: archive task "Title"\n\nMoved to tasks/archive/YYYY-MM/filename.md`

**Archive commit timing**: Separate - archive rename committed immediately after file move, independent of work commits

**Staged files behavior**: Archive blocked if ANY staged files exist (prevents mixing archive with other changes)
