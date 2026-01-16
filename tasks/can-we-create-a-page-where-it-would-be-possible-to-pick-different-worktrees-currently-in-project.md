# can we create a page where it would be possible to pick different worktrees currently in project?

## Problem Statement
Missing UI to view/switch git worktrees in current repo. Need page to list worktrees and set active working dir.

## Scope
**In:**
- List git worktrees for repo root
- Select worktree to set `X-Working-Dir` via store
- UI page + sidebar nav entry

**Out:**
- Create/delete worktrees
- Session-specific worktree management
- Cross-repo browsing

## Implementation Plan

### Phase: Backend
- [x] Add worktree list parser in `src/lib/agent/git-worktree.ts`
- [x] Expose `git.worktrees` query in `src/trpc/git.ts`

### Phase: UI
- [x] Add `src/routes/worktrees.tsx` page with list + select action
- [x] Wire selection to `src/lib/stores/working-dir.ts`
- [x] Add `/worktrees` link in `src/components/layout/sidebar.tsx`

## Key Files
- `src/lib/agent/git-worktree.ts` - parse worktree list details
- `src/trpc/git.ts` - new worktrees query
- `src/routes/worktrees.tsx` - page UI
- `src/components/layout/sidebar.tsx` - nav link
- `src/lib/stores/working-dir.ts` - selection store

## Success Criteria
- [x] `/worktrees` lists repo worktrees with branch + path
- [x] Selecting a worktree updates working dir and data refreshes

## Implementation Notes
- Added `WorktreeDetails` interface and `listWorktreesDetailed()` function to parse detailed worktree info (path, branch, HEAD, bare, isMain)
- Selection persists via localStorage (zustand persist middleware in working-dir store)
- Lists ALL git worktrees (not just `.agentz/worktrees/*`) for flexibility

## Open Questions (Resolved)
- Should list include only `.agentz/worktrees/*` or all git worktrees?
  - **Decision**: All git worktrees - more flexible for various use cases
- Should selection persist across reload or be session-only?
  - **Decision**: Persists via localStorage (existing behavior of working-dir store)
