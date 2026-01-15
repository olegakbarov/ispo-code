# align all inputs in the project to use same base component

## Problem Statement
11+ files use inline `<textarea>` with 8+ styling variations (focus states, padding, placeholders). No `Textarea` base component exists. Input component is standardized but underutilized.

## Scope
**In:**
- Create `Textarea` component matching `Input` pattern
- Migrate all inline textareas to use base component
- Standardize focus states: `focus:outline-none focus:border-primary`

**Out:**
- Specialized input behaviors (character counts, keyboard shortcuts)
- ImageAttachmentInput changes (already specialized)
- Functional changes to existing components

## Implementation Plan

### Phase 1: Create Base Textarea Component
- [x] Create `src/components/ui/textarea.tsx` with variants sm|md, matching Input tokens
- [x] Export from ui index if exists

### Phase 2: Migrate Route Files (2 files)
- [x] `src/routes/index.tsx` - prompt textarea
- [x] `src/routes/agents/$sessionId.tsx` - message input textarea

### Phase 3: Migrate Git Components (2 files)
- [x] `src/components/git/commit-form.tsx` - commit message textarea
- [x] `src/components/git/diff-panel.tsx` - 2 textareas (comment + instructions)

### Phase 4: Migrate Task Components (5 files)
- [x] `src/components/tasks/task-editor.tsx` - editor textarea (full height variant)
- [x] `src/components/tasks/task-commit-panel.tsx` - commit textarea
- [x] `src/components/tasks/commit-archive-modal.tsx` - commit textarea
- [x] `src/components/tasks/task-footer.tsx` - rewrite textarea (custom border)
- [x] `src/components/tasks/review-modal.tsx` - instructions textarea

### Phase 5: Migrate Agent Components (3 files)
- [x] `src/components/agents/file-comment-input.tsx` - comment textarea
- [x] `src/components/agents/thread-sidebar.tsx` - commit textarea
- [x] `src/components/agents/sidebar-commit-panel.tsx` - commit textarea

## Key Files
- `src/components/ui/textarea.tsx` - NEW: base component
- `src/components/ui/input.tsx` - reference for pattern
- 12 files with inline textareas to migrate

## Success Criteria
- [x] Single `Textarea` component used across codebase
- [x] Consistent focus state: `focus:border-primary`
- [x] Consistent disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
- [x] Zero inline textarea styling (except className overrides)
- [x] TypeScript: no type errors after migration

## Notes
- Also migrated `src/components/tasks/implement-modal.tsx` (not in original plan)
- Total 13 files migrated to use the new Textarea component
