# Task Integration with Git

## Problem Statement

Currently, the task execution system and git workflow are disconnected. When an agent works on a task:

1. **No file visibility in thread**: Users can't see which files the agent modified directly in the agent session view
2. **No diff viewing in context**: Users must switch to `/git` to see diffs, losing context of the agent's work
3. **No inline feedback**: Users can't comment on specific file changes or diffs and send feedback to the agent
4. **Manual commit workflow**: After agent completes a task, users must manually switch to git UI, stage files, and commit
5. **No scoped commits**: Users can't easily commit only the files related to a specific task when multiple tasks are running
6. **Subtree incompatibility**: This feature must work with the proposed subtree working directory feature (see `make-agents-work-in-subtrees.md`)

**Goal**: Integrate git file changes directly into the task/agent thread UI, allowing users to see diffs, comment on them, send feedback to agents, and commit task-scoped files without leaving the context.

## Scope

### In Scope
- Display edited files inline in agent session view (from `EditedFileInfo` metadata)
- Show file diffs within the thread for files modified by the agent
- Allow users to add comments/feedback on specific file changes
- Submit comments back to the agent for multi-turn refinement
- Commit only files associated with a specific task/agent session
- Filter git status to show only files modified by the current agent
- Support working directory scoping (relative paths from agent's `workingDir`)
- Real-time updates as agent modifies files
- Link from file list to git diff view

### Out of Scope
- Interactive diff editing (not modifying diffs inline)
- Cherry-picking hunks from diffs (stage entire files only)
- Conflict resolution UI (use standard git UI for conflicts)
- Multi-task concurrent commits (commit one task at a time)
- Squashing commits or advanced git operations
- History rewriting or interactive rebase

## Implementation Plan

### Phase 1: Backend - File Change Tracking
- [ ] Update `MetadataAnalyzer` to track file changes per agent session
  - Already tracks `EditedFileInfo` with path, operation, timestamp, toolUsed
  - Add method `getChangedFilesSinceStart()` to return list of modified files
- [ ] Add tRPC query `agent.getChangedFiles` to return files changed by a session
  - Input: `{ sessionId: string }`
  - Output: `EditedFileInfo[]` with absolute paths
- [ ] Add tRPC mutation `git.getDiffForFiles` to get diffs for specific files
  - Input: `{ files: string[], view: 'working' | 'staged' }`
  - Output: Map of file paths to diff data
- [ ] Add tRPC mutation `git.stageFiles` (already exists, verify it works)
- [ ] Add tRPC mutation `git.commitWithMessage` scoped to specific files
  - Input: `{ files: string[], message: string }`
  - Output: `{ success: boolean, hash?: string }`

### Phase 2: Frontend - File List Display
- [ ] Create `<ChangedFilesList>` component for agent session view
  - Display list of files from `EditedFileInfo[]`
  - Show operation badge (create/edit/delete)
  - Show tool used badge (Write/Edit/bash)
  - Show timestamp relative to session start
  - Group by operation type (created, modified, deleted)
- [ ] Add `<ChangedFilesList>` to agent session sidebar (`thread-sidebar.tsx`)
  - Place below "Thread" section, above "Context" section
  - Real-time updates as metadata changes
- [ ] Make file names clickable to expand inline diff viewer
  - Track which files are expanded in local state
  - Fetch diff on-demand when user clicks file

### Phase 3: Frontend - Inline Diff Viewer
- [ ] Create `<InlineDiffViewer>` component
  - Use react-diff-view or similar library for syntax-highlighted diffs
  - Support side-by-side and unified views
  - Show file path header with git status icon
  - Support light/dark theme (inherit from theme context)
- [ ] Integrate `<InlineDiffViewer>` into expanded file items
  - Lazy load diff data when file is expanded
  - Show loading state while fetching diff
  - Handle empty diffs (binary files, renames, etc.)
- [ ] Add file action buttons to diff viewer
  - "View in Git" button → link to `/git` with file pre-selected
  - "Stage file" button → stage this specific file
  - "Discard changes" button → discard with confirmation

### Phase 4: Frontend - Comment System
- [ ] Create `<FileCommentInput>` component
  - Textarea for user feedback on file changes
  - "Send to Agent" button to submit as follow-up message
  - Character counter for feedback length
- [ ] Add `<FileCommentInput>` below each expanded diff
  - Track comments per file in local state
  - Clear input after sending to agent
- [ ] Implement comment submission
  - Use existing `agent.sendMessage` mutation
  - Format message: "Feedback on {fileName}:\n{userComment}"
  - Include file path context for agent
  - Update thread output to show user comment

### Phase 5: Frontend - Task-Scoped Commit UI
- [ ] Create `<TaskCommitPanel>` component for task editor
  - List files changed by task's agent (if active session exists)
  - Checkbox selection for files to commit
  - Commit message textarea
  - Preview of selected files with stats
  - "Commit Selected Files" button
- [ ] Add `<TaskCommitPanel>` to task editor (`tasks/-task-editor.tsx`)
  - Show below agent progress section
  - Only visible when task has an active or completed agent session
  - Display "No changes yet" state when no files modified
- [ ] Implement commit action from task view
  - Validate at least one file selected
  - Validate commit message not empty
  - Call `git.commitWithMessage` with selected files
  - Show success notification with commit hash
  - Refresh git status after commit

### Phase 6: Working Directory Path Handling
- [ ] Update `EditedFileInfo` to store both absolute and relative paths
  - Add `relativePath` field (relative to agent's workingDir)
  - Add `repoRelativePath` field (relative to git root)
- [ ] Update `MetadataAnalyzer.trackFileOperation()` to calculate relative paths
  - Use agent's `workingDir` from session metadata
  - Use `path.relative(workingDir, absolutePath)` for relative path
  - Use git service to get repo root for repo-relative path
- [ ] Update UI components to display relative paths by default
  - Show `relativePath` in file lists (cleaner, contextual)
  - Show absolute path in hover tooltip
  - Link to git UI using `repoRelativePath`
- [ ] Test with subtree agents (workingDir != git root)
  - Verify paths resolve correctly
  - Verify git operations work with repo-relative paths
  - Verify diffs show correct file content

### Phase 7: Real-Time Updates
- [ ] Add polling for file changes in agent session view
  - Poll `agent.getChangedFiles` every 2s while agent is running
  - Update file list reactively as new files are modified
  - Show "New change" badge for files modified since last view
- [ ] Add WebSocket support for file change events (optional enhancement)
  - Emit `file_changed` event from MetadataAnalyzer
  - Subscribe to events in frontend
  - Real-time updates without polling
- [ ] Update thread sidebar file count in real-time
  - Show total files changed badge
  - Link to scroll to file list section

### Phase 8: Integration with Existing Git UI
- [ ] Add "View in Task" link from git UI file list
  - Show link when file is associated with an active task/agent
  - Link to agent session view with file pre-expanded
- [ ] Add task context to git commit form
  - Auto-populate commit message with task title (if committing from task)
  - Show task link in git UI when viewing task-related commits
- [ ] Sync git status between task view and git view
  - Invalidate git queries when committing from task view
  - Invalidate agent metadata when committing from git view

### Phase 9: Testing & Edge Cases
- [ ] Test with multiple concurrent agent sessions
  - Verify each session tracks only its own files
  - Test committing files from one task doesn't affect another
- [ ] Test with file rename operations
  - Verify renames show correct old → new path
  - Verify diffs handle renames properly
- [ ] Test with binary files
  - Show "Binary file" indicator instead of diff
  - Handle images with preview if possible
- [ ] Test with deleted files
  - Show deletion diff (old content → empty)
  - Handle staging deleted files correctly
- [ ] Test with working directory != git root (subtree mode)
  - Spawn agent in subdirectory
  - Verify file paths resolve correctly
  - Verify git operations use correct paths
- [ ] Test with large diffs (>1000 lines)
  - Implement diff truncation with "Show more" button
  - Show file stats (lines added/removed) without loading full diff
- [ ] Test error handling
  - Handle missing files (deleted externally)
  - Handle git errors (repo in bad state)
  - Handle agent crashes mid-edit

### Phase 10: UI/UX Polish
- [ ] Add file icons based on file type
  - Use file extension to show language icon
  - Differentiate code, config, markdown, etc.
- [ ] Add animation for new files appearing
  - Subtle fade-in when file list updates
  - Highlight newly changed files
- [ ] Add keyboard shortcuts
  - `Cmd/Ctrl+Enter` to submit comment
  - Arrow keys to navigate between files
  - `Space` to expand/collapse diff
- [ ] Add bulk actions for file list
  - "Stage all" button
  - "Discard all" button (with confirmation)
  - Select/deselect all checkboxes

## Key Files

### Backend
- `src/lib/agent/types.ts` - Update `EditedFileInfo` type with relative paths
- `src/lib/agent/metadata-analyzer.ts` - Add relative path calculation in `trackFileOperation()`
- `src/trpc/agent.ts` - Add `getChangedFiles` query
- `src/trpc/git.ts` - Add `commitWithMessage` mutation for scoped commits
- `src/lib/agent/git-service.ts` - Add helper to get repo-relative paths

### Frontend Components
- `src/components/agents/changed-files-list.tsx` - **NEW**: File list component
- `src/components/agents/inline-diff-viewer.tsx` - **NEW**: Diff viewer component
- `src/components/agents/file-comment-input.tsx` - **NEW**: Comment input component
- `src/components/agents/thread-sidebar.tsx` - Update to include file list
- `src/routes/agents/$sessionId.tsx` - Add file list section to main view
- `src/routes/tasks/-task-editor.tsx` - Add task commit panel
- `src/routes/tasks/-task-commit-panel.tsx` - **NEW**: Commit UI for tasks
- `src/routes/git.tsx` - Add task context links

### Utilities
- `src/lib/utils/path-utils.ts` - **NEW**: Path resolution helpers (relative, repo-relative, absolute)
- `src/lib/utils/file-icon.ts` - **NEW**: File type icon mapping

## Testing

### Unit Tests
- [ ] Test `EditedFileInfo` relative path calculation
- [ ] Test path resolution utilities (absolute ↔ relative ↔ repo-relative)
- [ ] Test `MetadataAnalyzer.getChangedFilesSinceStart()`
- [ ] Test commit file filtering logic

### Integration Tests
- [ ] Test agent modifies file → appears in thread file list
- [ ] Test clicking file → fetches and displays diff
- [ ] Test submitting comment → sends message to agent
- [ ] Test staging file from thread → updates git status
- [ ] Test committing files from task → creates git commit
- [ ] Test subtree agent → paths resolve correctly
- [ ] Test concurrent tasks → file lists don't overlap

### Manual Testing
- [ ] Run agent on a task that modifies 3+ files
- [ ] Verify files appear in thread view as agent modifies them
- [ ] Expand each file and verify diff is correct
- [ ] Add comment on one file and verify it sends to agent
- [ ] Stage 2 files and commit from task view
- [ ] Verify commit appears in git log with correct files
- [ ] Test with agent in subdirectory (subtree mode)

## Success Criteria

- [ ] Users can see all files modified by an agent directly in the agent session view
- [ ] Users can view diffs for modified files without leaving the thread
- [ ] Users can add comments on file changes and send them back to the agent
- [ ] Agent receives file-specific feedback and can iterate based on comments
- [ ] Users can commit only files associated with a specific task
- [ ] Commit message auto-populated with task context
- [ ] File paths display correctly relative to agent's working directory
- [ ] Feature works seamlessly with subtree working directories
- [ ] Real-time updates show new files as agent modifies them
- [ ] Users can navigate between thread view and git view maintaining context

## Dependencies

### Upstream: Make Agents Work in Subtrees
This feature **depends on** the subtree task (`make-agents-work-in-subtrees.md`) for:
- `workingDir` field in `AgentSession`
- Path validation utilities
- Relative path calculation from working directory

**Recommendation**: Either implement subtree task first, OR stub out `workingDir` fields with `process.cwd()` as a default and enhance later.

### Libraries to Add
- [ ] `react-diff-view` - High-quality diff rendering component
  - `npm install react-diff-view`
  - Supports unified and split views
  - Syntax highlighting via prism or highlight.js
- [ ] `diff` - Diff generation library (if not already included)
  - `npm install diff`
  - Generate diffs from old/new content
- [ ] Optional: `file-icons-js` - File type icons
  - Or use lucide-react icons for common file types

## Technical Considerations

### Path Resolution Strategy

For an agent with `workingDir = "/repo/packages/backend"`:
- Agent edits file: `/repo/packages/backend/src/api/handler.ts`
- Store in `EditedFileInfo`:
  - `path`: `/repo/packages/backend/src/api/handler.ts` (absolute)
  - `relativePath`: `src/api/handler.ts` (relative to workingDir)
  - `repoRelativePath`: `packages/backend/src/api/handler.ts` (relative to git root)

Display in UI:
- Thread view: Show `relativePath` (cleaner for agent context)
- Git view link: Use `repoRelativePath` (git operates on repo-relative paths)
- Tooltip: Show `path` (full context)

### Git Operation Scoping

When committing from task view:
1. Get list of files from `EditedFileInfo`
2. Filter to only files user selected (checkboxes)
3. Convert paths to repo-relative for git operations
4. Stage only those files: `git add <repo-relative-path>`
5. Commit: `git commit -m <message>`
6. Refresh git status in both task and git views

### Comment Formatting for Agent

When user comments on a file:
```
User feedback on src/api/handler.ts:

The error handling looks good, but can you also add logging
for the edge case when the user ID is null?
```

Agent receives this as a user message and can:
- Read the file again to see current state
- Make requested changes
- Respond with confirmation

### Real-Time Diff Updates

Challenge: Agent is actively editing file, user has diff open
- Option A: Lock diff to version when opened (show "File changed, refresh to see latest")
- Option B: Auto-refresh diff every 5s (may be jarring if user is reading)
- **Recommendation**: Option A (show notification, manual refresh)

### UI Layout Options

**Option 1: Sidebar File List** (Recommended)
- File list in right sidebar (below metadata)
- Click file → expand inline diff in main thread
- Pros: Maintains thread readability, files are accessible
- Cons: Sidebar gets long with many files

**Option 2: Inline File Cards**
- Insert file cards into thread output at point of modification
- Pros: Chronological context, see when file changed
- Cons: Clutters thread, hard to find files later

**Option 3: Separate Tab**
- Add "Files" tab next to agent output
- Pros: Clean separation, doesn't clutter thread
- Cons: Requires tab switching, loses context

**Decision**: Use Option 1 (sidebar) with Option 2 elements (show file change events in thread output as breadcrumbs)

### Security Considerations

- Validate file paths are within git repository (use path-validator.ts)
- Validate file paths are within or below agent's workingDir (subtree boundary)
- Sanitize commit messages (prevent injection attacks)
- Escape HTML in diff viewer (prevent XSS from malicious file content)
- Rate-limit comment submissions (prevent spam to agent)

## Migration Path

This is a **new feature** that enhances existing workflows:
- Existing task execution continues to work (agent modifies files)
- Existing git workflow continues to work (manual staging/commit)
- New UI provides additional visibility and shortcuts
- No breaking changes to existing APIs or components
- Feature is progressive enhancement (gracefully degrades if metadata missing)

## User Stories

### Story 1: Developer reviews agent's work
> As a developer, I want to see which files my agent modified so I can review its changes before committing.

**Flow**:
1. Run agent on a task
2. Agent modifies 3 files
3. Files appear in thread sidebar with badges (Edit, Create)
4. Click each file to see diff
5. Add comment: "Can you add error handling here?"
6. Agent receives feedback and makes changes
7. Review updated diff
8. Commit files from task view

### Story 2: Developer commits task-scoped changes
> As a developer, I want to commit only the files related to a specific task, not all uncommitted changes in my repo.

**Flow**:
1. Have uncommitted changes from previous work
2. Run agent on new task
3. Agent modifies 2 files
4. Task commit panel shows only those 2 files
5. Select files, write commit message
6. Commit only task files
7. Previous uncommitted changes remain untouched

### Story 3: Developer works in monorepo subdirectory
> As a developer, I want my agent to work in a specific package directory and only see files relative to that directory.

**Flow**:
1. Set working directory to `packages/backend`
2. Spawn agent with task
3. Agent edits `src/api/handler.ts`
4. UI shows relative path: `src/api/handler.ts` (not full path)
5. Diff and commit operations work correctly
6. Git log shows proper repo-relative paths

## Future Enhancements (Out of Scope for v1)

- **Inline commenting on specific lines**: Add comments to specific line ranges in diff
- **Code review workflow**: Approve/reject changes before committing
- **Stacked diffs**: View series of changes across multiple agent turns
- **Diff search**: Search within diffs for specific patterns
- **Suggested commits**: Agent proposes commit message based on changes
- **Automatic conventional commits**: Format commit messages following conventions
- **Undo/redo file changes**: Revert specific file to previous state
- **Compare with remote**: Show diff between local changes and remote branch
