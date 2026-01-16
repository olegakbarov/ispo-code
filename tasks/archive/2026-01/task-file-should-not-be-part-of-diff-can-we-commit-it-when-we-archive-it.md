# task file should not be part of diff. can we commit it when we archive it?

## Problem Statement
Task markdown file shows in task review diffs, noisy. Hide from diff UI but still commit on archive for history.

## Scope
**In:**
- filter taskPath from diff list in `src/components/tasks/task-review-panel.tsx`
- include task file in archive commit set in `src/components/tasks/commit-archive-modal.tsx`
- align archive/uncommitted checks in `src/trpc/tasks.ts`
**Out:**
- global git diff views in `src/components/git/`
- task file format changes in `tasks/*.md`
- archive storage changes in `src/lib/agent/task-service.ts`

## Implementation Plan

### Phase: Discovery
- [x] trace task file inclusion from `src/lib/agent/metadata-analyzer.ts` into `src/trpc/tasks.ts`
- [x] map diff display + commit list usage in `src/components/tasks/task-review-panel.tsx` and `src/components/tasks/commit-archive-modal.tsx`

### Phase: Diff Exclusion
- [x] filter taskPath out of `uncommittedFiles` in `src/components/tasks/task-review-panel.tsx`
  - Added filter in useMemo: `if (gitPath === taskPath) return false`
- [x] keep filtered list used by `src/components/tasks/file-list-panel.tsx`
  - No changes needed, uses filtered `uncommittedFiles`

### Phase: Commit on Archive
- [x] add taskPath back into commit file list when modified in `src/components/tasks/commit-archive-modal.tsx`
  - Added useMemo to check git status and include taskPath if modified
- [x] adjust archive guard for task file if needed in `src/trpc/tasks.ts`
  - No changes needed, archive validation checks git status directly

### Phase: Verification
- [x] confirm task file hidden in review list/diff in `src/components/tasks/task-review-panel.tsx`
  - ✓ Build passes, filter logic verified in uncommittedFiles useMemo
- [x] confirm commit-and-archive includes task file in `src/components/tasks/commit-archive-modal.tsx`
  - ✓ Build passes, gitRelativeFiles useMemo includes taskPath when modified

## Key Files
- `src/components/tasks/task-review-panel.tsx` - filter task file from diff list
- `src/components/tasks/commit-archive-modal.tsx` - ensure task file committed on archive
- `src/trpc/tasks.ts` - uncommitted/archiving checks and changed-files aggregation
- `src/lib/agent/metadata-analyzer.ts` - source of task file in changed files

## Success Criteria
- [x] task file path not shown in task review diff list
- [x] commit-and-archive commits task markdown when modified
- [x] archive succeeds with task file committed

## Implementation Notes
- Task file filtered at UI layer only (task-review-panel.tsx)
- Commit layer includes task file if modified (commit-archive-modal.tsx)
- No changes to backend needed (git status already tracks task file)
- Task file included in commit message generation (acceptable - shows implementation progress)

## Resolved Questions
- **Task file excluded only in task review UI** - Correct, global git views unchanged (out of scope)
- **Task file included in commit message generation** - Yes, acceptable since it documents implementation
- **Uncommitted status includes task file** - Yes, correct behavior for archive validation
