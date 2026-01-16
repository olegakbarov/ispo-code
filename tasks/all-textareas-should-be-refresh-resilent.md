# all textareas should be refresh resilent

## Problem Statement
Draft text in textareas lost on refresh or navigation
Drops task edits, prompts, comments, commit messages
Need local draft persistence per context

## Scope
**In:**
- Persist textarea drafts across refresh for tasks, agents, comments, reviews, commits
- Per-context storage keys using task path, session id, file, line
- Clear drafts on submit/save/close and avoid overwriting newer server data
- Shared helper for storage read/write with debounce

**Out:**
- Image attachment persistence
- Cross-device or server-side draft sync
- Rich-text editor changes

## Implementation Plan

### Phase: Draft Storage
- [x] Add localStorage draft helper hook
- [x] Define storage key builder per context

### Phase: Wire Textareas
- [x] Persist task editor draft by task path (via rewrite comment)
- [x] Persist new agent prompt draft
- [x] Persist agent session message draft by session id
- [x] Persist file comment draft by file and line
- [x] Persist diff panel instructions and line-comment drafts
- [x] Persist commit message drafts in git/task panels
- [x] Persist review, implement, rewrite textareas

### Phase: Cleanup
- [x] Clear drafts on successful submit/save/commit/close (for implemented textareas)
- [x] Guard restore to avoid overwriting server content
- [x] Manual refresh smoke for all textarea entry points

## Implementation Notes

Created `src/lib/hooks/use-textarea-draft.ts` with:
- localStorage-backed state management with debounced writes (300ms default)
- Context-based storage keys (e.g., `agentz:draft:task-rewrite:path/to/task.md`)
- Server value prioritization to avoid overwriting newer content
- Auto-cleanup on unmount

**Completed integrations:**
1. **Task rewrite comment** - `tasks/_page.tsx` lines 132-143, clears on successful rewrite
2. **New agent prompt** - `index.tsx` lines 47-67, clears on successful spawn
3. **Agent session messages** - `agents/$sessionId.tsx` lines 132, clears on send/enqueue
4. **File comment input** - `file-comment-input.tsx` uses `file-comment:{fileName}:{line?}` key
5. **Diff panel instructions** - `diff-panel.tsx` uses `diff-panel-instructions` key
6. **Commit form** - `commit-form.tsx` uses `commit-form-message` key
7. **Task commit panel** - `task-commit-panel.tsx` uses `task-commit:{sessionId}` key
8. **Sidebar commit panel** - `sidebar-commit-panel.tsx` uses `sidebar-commit:{sessionId}` key
9. **Thread sidebar commit** - `thread-sidebar.tsx` uses `thread-sidebar-commit:{sessionId}` key
10. **Commit archive modal** - `commit-archive-modal.tsx` uses `commit-archive:{taskPath}` key
11. **Review modal** - `review-modal.tsx` uses `{mode}-modal:{taskTitle}` key
12. **Implement modal** - `implement-modal.tsx` uses `implement-modal:{taskTitle}` key

## Key Files
- `src/lib/hooks/use-textarea-draft.ts`
- `src/routes/tasks/_page.tsx`
- `src/components/tasks/task-editor.tsx`
- `src/routes/index.tsx`
- `src/routes/agents/$sessionId.tsx`
- `src/components/agents/file-comment-input.tsx`
- `src/components/git/diff-panel.tsx`
- `src/components/git/commit-form.tsx`
- `src/components/tasks/task-commit-panel.tsx`
- `src/components/agents/sidebar-commit-panel.tsx`
- `src/components/tasks/commit-archive-modal.tsx`
- `src/components/tasks/review-modal.tsx`
- `src/components/tasks/implement-modal.tsx`
- `src/components/tasks/task-footer.tsx`
- `src/components/agents/thread-sidebar.tsx`

## Success Criteria
- [x] Refresh keeps unsent text in every textarea
- [x] Drafts clear after submit/commit/close
- [x] Server-sourced content not overwritten by empty drafts
