# Git Subtree Isolation per Agent Session

## Problem Statement
Multiple agents working concurrently modify same files → conflicts, mixed commits. Need isolation: each agent works in git worktree/subtree, commits scoped per session, no cross-contamination.

## Scope
**In:**
- Per-session git worktrees (isolated working dirs)
- Session-scoped file tracking for commits
- Worktree creation/cleanup lifecycle
- Agent tools (Read/Write/Edit) constrained to session worktree
- Sidebar shows session-specific changes only
- Commit operations isolated per session

**Out:**
- Multi-branch merge workflows
- Worktree sharing between sessions
- Cross-session file conflict resolution
- Worktree-aware git operations beyond basics (rebase, cherry-pick)

## Implementation Plan

### Phase: Core Worktree Management
- [x] Add `worktreePath` field to `AgentSession` type
- [x] Create `git-worktree.ts` service: `createWorktree(sessionId, baseBranch)`, `deleteWorktree(worktreePath)`
- [x] Generate unique branch per session: `agentz/session-{sessionId}`
- [x] Store worktree → session mapping in session-store
- [x] Hook worktree creation into `AgentManager.spawn()` when enabled
- [x] Hook worktree cleanup into `AgentManager.delete()` and session cleanup

### Phase: Agent Tool Isolation
- [x] Update `PathValidator` to accept `workingDir` override (worktree path)
- [x] Pass worktree path to all tools in `CLIAgentRunner` and SDK agents
- [x] Modify `CerebrasAgent`, `OpencodeAgent` to use worktree as cwd
- [x] Validate all file operations stay within worktree boundaries

### Phase: Session-Scoped Git Operations
- [x] Update `git-service.ts`: accept optional worktree path param (via cwd parameter)
- [x] Modify `getGitStatus` to filter by worktree path (automatic via cwd)
- [x] Update `commitScopedChanges` to work within worktree context (automatic via cwd)
- [x] Add `getSessionChanges(sessionId)` to return worktree-specific diffs (via X-Session-Id header)
- [x] Update tRPC git router to accept optional `sessionId` for isolation (via X-Session-Id header)

### Phase: UI Integration
- [x] Update `SidebarCommitPanel` to show session worktree changes only
- [x] Filter `getChangedFiles` query by session worktree
- [x] Show worktree branch name in sidebar git panel
- [x] Add worktree indicator/badge in session UI (WT badge)

### Phase: Feature Flags & Migration
- [x] Add `ENABLE_WORKTREE_ISOLATION` env flag (default: false)
- [x] Support hybrid mode: worktree sessions + legacy shared workdir
- [x] Add worktree info to session metadata (worktreePath, worktreeBranch)
- [x] Document worktree lifecycle in CLAUDE.md

## Key Files
- `src/lib/agent/types.ts` - add worktreePath field
- `src/lib/agent/git-worktree.ts` - new worktree service
- `src/lib/agent/manager.ts` - integrate worktree lifecycle
- `src/lib/agent/path-validator.ts` - worktree-aware validation
- `src/lib/agent/git-service.ts` - worktree-scoped operations
- `src/lib/agent/cli-runner.ts` - pass worktree to CLI agents
- `src/lib/agent/cerebras.ts` - use worktree cwd
- `src/lib/agent/opencode.ts` - use worktree cwd
- `src/trpc/git.ts` - session-aware git queries
- `src/components/agents/sidebar-commit-panel.tsx` - session-scoped UI

## Success Criteria
- [x] Two concurrent agents modify different files → separate worktrees, no conflicts
- [x] Two concurrent agents modify same file → isolated changes in each worktree
- [x] Session commit only includes files changed in that worktree
- [x] Worktree branch auto-created on spawn, deleted on session cleanup
- [x] All agent tools (Read/Write/Edit) operate within worktree boundaries
- [x] Sidebar git panel shows session-specific changes, not global status

## Unresolved Questions
- Merge strategy when multiple session branches need integration back to main?
- Handle disk space with many concurrent worktrees (cleanup policy)?
- Support resuming sessions after server restart (worktree persistence)?
- Share base branch updates across active worktrees (fetch strategy)?
