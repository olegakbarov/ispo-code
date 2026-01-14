# sidebar should contain information about changed files within the session. it also should let commit those changes

## Problem Statement
ThreadSidebar shows edited files list (links to /git) but no git status or commit functionality. Task commit panel exists in separate component. Need centralized git workflow in sidebar for session-scoped commits.

## Scope
**In:**
- Display git status (staged/modified/untracked counts) in sidebar
- Show changed files with selection checkboxes
- Commit form with message input in sidebar
- Scoped commit (selected files only)
- Success/error feedback in sidebar

**Out:**
- Branch management (stays in /git)
- Full git operations (push/pull/fetch)
- Diff viewer in sidebar (link to /git)
- Multi-session git operations

## Implementation Plan

### Phase: Add Git Status Section
- [x] Add `GitStatusSection` to `thread-sidebar.tsx` below edited files
- [x] Query `trpc.git.status` in sidebar
- [x] Display staged/modified/untracked file counts
- [x] Show current branch name

### Phase: Add Commit UI
- [x] Create `SidebarCommitPanel` component in `src/components/agents/`
- [x] Add file checkboxes to edited files list in sidebar
- [x] Add commit message textarea
- [x] Wire `trpc.git.commitScoped` mutation
- [x] Show commit hash on success

### Phase: Link Files to Commit Flow
- [x] Track selected files in sidebar state
- [x] Filter edited files to only show session changes
- [x] Add "select all" / "deselect all" toggle

## Key Files
- `src/components/agents/thread-sidebar.tsx` - add git status section + commit UI
- `src/components/agents/sidebar-commit-panel.tsx` - new component for commit form
- `src/trpc/git.ts` - status/commitScoped already exist
- `src/components/tasks/task-commit-panel.tsx` - reference for commit logic

## Success Criteria
- [x] Sidebar shows git status (branch, staged/modified/untracked counts)
- [x] Can select files from edited list
- [x] Can commit selected files with message
- [x] Shows commit hash or error feedback
- [x] Commit refreshes git status and edited files list

## Implementation Notes

**Architecture**:
- Collapsible panel fixed at sidebar bottom
- Git status queries only when expanded (3s polling)
- Session-scoped file list from `trpc.agent.getChangedFiles`
- Uses existing `trpc.git.commitScoped` for commits

**UI Design**:
- Compact 10px VCR font styling matches sidebar aesthetic
- Shows change count badge when collapsed
- Operation indicators: + (create), ~ (edit), − (delete)
- Success/error states with color-coded feedback

**Files Created**:
- `src/components/agents/sidebar-commit-panel.tsx` (217 lines)

**Files Modified**:
- `src/components/agents/thread-sidebar.tsx` (+3 lines import, +3 lines component)
