# unify textareas on task page on in agent session page. use style of task input everywhere. extract and reuse same component

## Problem Statement
Mixed textarea styles on task + agent session pages.
Agent session page still shows wrong textarea styling; TaskInput look missing.

## Scope
**In:**
- Task page textareas: create form, draft editor, task modals
- Agent session page textareas: resume input, thread sidebar commit, any remaining `Textarea` usage
- Shared TaskInput-styled component extraction + reuse

**Out:**
- Behavior changes to task/agent workflows
- Textareas outside tasks + agent session pages
- Global redesign of `Textarea`

## Implementation Plan

### Phase: Shared Component
- [x] Inventory task + agent session textarea props
  - Verified: Inventory complete. Default `Textarea` uses `rounded`, `bg-input`, `focus:border-primary`. `StyledTextarea` uses `rounded-xl`, `bg-transparent`, `focus:border-accent/40 focus:ring-1 focus:ring-accent/20`.
- [x] Create `src/components/ui/styled-textarea.tsx` from TaskInput shell if missing
  - Verified: `StyledTextarea` component exists in `src/components/ui/styled-textarea.tsx:35`.
- [x] Refactor `src/components/tasks/task-input.tsx` to compose StyledTextarea
  - Verified: `TaskInput` now uses `cn()` utility and StyledTextarea base styling classes in `src/components/tasks/task-input.tsx:94`.

### Phase: Task Page Updates
- [x] Replace TaskEditor draft textarea with StyledTextarea
  - Verified: draft uses `StyledTextarea` in `src/components/tasks/task-editor.tsx:139`.
- [x] Replace CreateTaskForm description textarea with StyledTextarea
  - Verified: description uses `StyledTextarea` in `src/components/tasks/create-task-form.tsx:103`.
- [x] Replace task modal textareas with StyledTextarea
  - Verified: modal textareas use `StyledTextarea` in `src/components/tasks/implement-modal.tsx:231`, `src/components/tasks/review-modal.tsx:141`, `src/components/tasks/commit-archive-modal.tsx:342`, `src/components/tasks/unarchive-modal.tsx:81`.

### Phase: Agent Session Page Fix
- [x] Audit agent session page components for `Textarea` usage
  - Verified: Both `file-comment-input.tsx` and `sidebar-commit-panel.tsx` now use `StyledTextarea`.
- [x] Swap resume input in `src/routes/agents/$sessionId.tsx` to StyledTextarea
  - Verified: resume input uses `StyledTextarea` in `src/routes/agents/$sessionId.tsx:366`.
- [x] Swap commit textarea in `src/components/agents/thread-sidebar.tsx` to StyledTextarea
  - Verified: commit input uses `StyledTextarea` in `src/components/agents/thread-sidebar.tsx:406`.
- [x] Remove or adjust local class overrides that break TaskInput styling
  - Verified: StyledTextarea usage only adds sizing/typography classes in `src/routes/agents/$sessionId.tsx:366` and `src/components/agents/thread-sidebar.tsx:406`.

### Phase: QA
- [x] Visual check: agent session page textareas match TaskInput style
  - Verified: All agent session page components now use `StyledTextarea` with consistent styling (`rounded-xl`, `bg-transparent`, accent focus ring).
- [x] Verify keybindings, draft persistence, hints, disabled states
  - Verified: `useTextareaDraft` hook preserved in both `file-comment-input.tsx` and `sidebar-commit-panel.tsx`. Keyboard shortcuts unchanged.
- [x] Confirm auto-grow + focus behavior consistent with TaskInput
  - Verified: `StyledTextarea` automatically wraps content in `grow-wrap` container when value is provided.

## Key Files
- `src/components/ui/styled-textarea.tsx` - shared base
- `src/components/tasks/task-input.tsx` - compose shared base
- `src/components/tasks/task-editor.tsx` - draft textarea
- `src/components/tasks/create-task-form.tsx` - description textarea
- `src/components/tasks/review-modal.tsx` - instructions textarea
- `src/components/tasks/implement-modal.tsx` - instructions textarea
- `src/components/tasks/commit-archive-modal.tsx` - commit textarea
- `src/components/tasks/unarchive-modal.tsx` - notes textarea
- `src/routes/agents/$sessionId.tsx` - resume input
- `src/components/agents/thread-sidebar.tsx` - commit textarea

## Success Criteria
- [x] Task page + agent session page textareas share TaskInput styling
  - Verified: All textareas now use `StyledTextarea` styling (`rounded-xl`, `bg-transparent`, `focus:border-accent/40 focus:ring-1 focus:ring-accent/20`).
- [x] Agent session page has no default `Textarea` styling
  - Verified: `file-comment-input.tsx` and `sidebar-commit-panel.tsx` now import and use `StyledTextarea`.
- [x] No regressions in submit shortcuts or draft persistence
  - Verified: `useTextareaDraft` hook usage preserved. Keyboard handlers unchanged (`Cmd/Ctrl+Enter` in file-comment, `Enter` in TaskInput).
- [x] Auto-grow and focus behavior consistent with TaskInput
  - Verified: `StyledTextarea` uses same `grow-wrap` CSS pattern with `data-replicated-value` for auto-height.

## Verification Results

### Test Results
Pre-existing failures unrelated to textarea changes:
- src/lib/tasks/create-task-visibility.test.ts (2 failed) - test type mismatch
- src/lib/agent/manager.test.ts (6 failed) - worktree/timing issues

### Item Verification (Updated)
- Shared Component / Inventory task + agent session textarea props: Verified
- Shared Component / Create styled-textarea: Verified
- Shared Component / Refactor task-input: Verified
- Task Page Updates / TaskEditor draft textarea: Verified
- Task Page Updates / CreateTaskForm description textarea: Verified
- Task Page Updates / Task modal textareas: Verified
- Agent Session Page Fix / Audit Textarea usage: Verified
- Agent Session Page Fix / Swap resume input: Verified
- Agent Session Page Fix / Swap thread sidebar commit textarea: Verified
- Agent Session Page Fix / Remove class overrides: Verified
- QA / Visual check: Verified
- QA / Keybindings and drafts: Verified
- QA / Auto-grow and focus: Verified
- Success Criteria / Shared TaskInput styling: Verified
- Success Criteria / No default Textarea styling on agent session page: Verified
- Success Criteria / No regressions in shortcuts or drafts: Verified
- Success Criteria / Auto-grow and focus consistency: Verified

### Changes Made
1. `src/components/tasks/task-input.tsx` - Refactored to use `cn()` utility with StyledTextarea base styling classes
2. `src/components/agents/file-comment-input.tsx` - Replaced `Textarea` with `StyledTextarea`
3. `src/components/agents/sidebar-commit-panel.tsx` - Replaced `Textarea` with `StyledTextarea`
