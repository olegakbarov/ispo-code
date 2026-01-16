# why i see changes in web ui before the merge of corresponding feature?

## Problem Statement
UI changes visible pre-merge. Suspect active worktree or working dir on feature branch. Need confirm UI -> tRPC -> git/worktree resolution.

## Scope
**In:**
- working dir selection + persistence (`src/lib/stores/working-dir.ts`)
- session worktree creation + assignment (`src/lib/agent/manager.ts`, `src/lib/agent/git-worktree.ts`)
- tRPC working dir resolution (`src/lib/trpc-client.ts`, `src/routes/api/trpc/$.ts`)
- UI git status/diff + merge flow (`src/components/agents/thread-sidebar.tsx`, `src/routes/tasks/_page.tsx`)

**Out:**
- CI/CD deploy behavior
- GitHub merge policy
- non-git UI features

## Implementation Plan

### Phase: Trace Data Flow
- [x] Inspect working dir header logic in `src/lib/trpc-client.ts`
  - Verified: `X-Working-Dir` and `X-Session-Id` headers set in `src/lib/trpc-client.ts:39` and `src/lib/trpc-client.ts:47`.
- [x] Inspect session worktree override in `src/routes/api/trpc/$.ts`
  - Verified: session worktree resolution and fallback in `src/routes/api/trpc/$.ts:26` and `src/routes/api/trpc/$.ts:39`.
- [x] Inspect worktree creation/assignment in `src/lib/agent/manager.ts`
  - Verified: worktree creation and effective working dir assignment in `src/lib/agent/manager.ts:119` and `src/lib/agent/manager.ts:130`.
- [x] Inspect worktree isolation toggles in `src/lib/agent/git-worktree.ts`
  - Verified: isolation guard uses `DISABLE_WORKTREE_ISOLATION` in `src/lib/agent/git-worktree.ts:355`.

### Phase: UI Surface
- [x] Inspect worktree selector behavior in `src/routes/worktrees.tsx`
  - Verified: selection uses store state and updates in `src/routes/worktrees.tsx:15` and `src/routes/worktrees.tsx:22`.
- [x] Inspect session git status/diff UI in `src/components/agents/thread-sidebar.tsx`
  - Verified: session-scoped git status and diff queries in `src/components/agents/thread-sidebar.tsx:183` and `src/components/agents/thread-sidebar.tsx:194`.
- [x] Inspect merge workflow in `src/routes/tasks/_page.tsx`
  - Verified: merge/revert mutations and handler present in `src/routes/tasks/_page.tsx:724` and `src/routes/tasks/_page.tsx:1239`.

### Phase: Fix or Explain
- [x] Decide expected pre-merge visibility rule
  - Verified: documented in Root Cause Analysis section of this task doc.
- [x] Add active branch/worktree indicator in UI
  - Already exists: Branch name and "WT" badge in `thread-sidebar.tsx:331-335`
- [ ] Add help text for worktree selection
  - Optional enhancement, not required for task completion

## Key Files
- `src/lib/stores/working-dir.ts` - persisted working dir selection
- `src/lib/trpc-client.ts` - X-Working-Dir/X-Session-Id headers
- `src/routes/api/trpc/$.ts` - working dir/worktree resolution
- `src/lib/agent/manager.ts` - worktree creation and assignment
- `src/lib/agent/git-worktree.ts` - worktree isolation config
- `src/routes/worktrees.tsx` - UI worktree selection
- `src/components/agents/thread-sidebar.tsx` - session git status/diff
- `src/routes/tasks/_page.tsx` - merge action path

## Root Cause Analysis

### Finding: This is expected behavior, not a bug.

The UI shows feature branch changes pre-merge **by design** when viewing an agent session. Here's how the data flow works:

### Data Flow Summary

1. **Client sends headers** (`src/lib/trpc-client.ts:34-51`):
   - `X-Working-Dir`: from Zustand store (user-selected directory)
   - `X-Session-Id`: from query context (when viewing a specific session)

2. **Server resolves working directory** (`src/routes/api/trpc/$.ts:21-39`):
   ```
   Priority: X-Working-Dir > session.worktreePath > session.workingDir > DEFAULT_WORKING_DIR
   ```
   - If `X-Session-Id` is passed AND no explicit `X-Working-Dir`:
     - Server looks up the session
     - Uses `session.worktreePath` if it exists on disk
     - Falls back to `session.workingDir`

3. **Worktree creation** (`src/lib/agent/manager.ts:112-128`):
   - Each agent session creates isolated worktree at `.agentz/worktrees/{sessionId}`
   - Branch: `agentz/session-{sessionId}`
   - All file operations scoped to this worktree

4. **UI git status** (`src/components/agents/thread-sidebar.tsx:184-187`):
   - `trpc.git.status.useQuery()` passes `sessionId` via context
   - Git status/diff automatically scoped to session's worktree
   - Shows "WT" badge when session has worktree (line 332-335)

### Why You See Pre-Merge Changes

When viewing `/agents/{sessionId}`:
- UI passes `X-Session-Id` header on all tRPC calls
- Server resolves to session's worktree path (feature branch)
- Git status shows changes from that worktree, not main

This is **correct behavior** because:
- Agent sessions are isolated by design
- You're viewing the session's working context
- The "WT" badge indicates worktree is active

### When You DON'T See Feature Changes

- When viewing `/tasks` without a session context
- When you manually select main worktree via `/worktrees` page
- When `X-Working-Dir` header overrides session worktree

## Existing UI Indicators

The UI already shows active branch/worktree:

1. **Thread Sidebar** (`thread-sidebar.tsx:331-335`):
   - Shows current branch name
   - Shows "WT" badge when in worktree

2. **Worktrees Page** (`worktrees.tsx`):
   - Allows manual worktree selection
   - Shows which worktree is currently active

## Recommendations

### No code changes needed for core behavior.

The current design is intentional - you're viewing the agent's isolated workspace.

### Optional UI improvements:
- [ ] More prominent worktree indicator in header/sidebar
- [ ] Help text explaining "WT" badge meaning
- [ ] Warning when viewing pre-merge changes

## Success Criteria
- [x] Root cause traced to specific working dir/worktree path
  - Verified: session worktree resolution in `src/routes/api/trpc/$.ts:26` and worktree creation in `src/lib/agent/manager.ts:119`.
- [x] UI shows active branch/worktree when not main (already exists: "WT" badge + branch name)
  - Verified: branch label and "WT" badge render in `src/components/agents/thread-sidebar.tsx:331` and `src/components/agents/thread-sidebar.tsx:332`.
- [x] Pre-merge UI behavior matches documented rule (expected behavior)
  - Verified: session header propagation and worktree override align in `src/lib/trpc-client.ts:47` and `src/routes/api/trpc/$.ts:31`.

## Unresolved Questions (Answered)
- **Which worktree/branch active when issue occurs?** → Session's worktree (`agentz/session-{id}`)
- **Is `DISABLE_WORKTREE_ISOLATION` set at runtime?** → Default is enabled; check `process.env.DISABLE_WORKTREE_ISOLATION`
- **Should UI hide feature changes pre-merge or just label source?** → Current behavior (show with label) is correct for session context

## Verification Results
- Verified all completed checklist items against code and documented behavior.
- Tests not run (no test steps listed in the task).
- No missing files or obvious regressions found during verification.

## Task Completion Summary

**Status:** ✅ Complete

**Outcome:** Investigation successfully identified root cause as **expected behavior by design**.

**Key Findings:**
1. UI showing pre-merge changes is intentional when viewing agent sessions
2. Each session operates in an isolated worktree on branch `agentz/session-{id}`
3. Existing UI indicators (branch name + "WT" badge) properly communicate worktree context
4. Data flow correctly prioritizes session context over global working directory

**No code changes required.** The system is working as designed. The optional help text enhancement remains available for future improvement if desired.