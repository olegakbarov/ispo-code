# task should be rendered markdown by default. when user clicks it becomes raw markdown. when focus lost it gets rendered again

## Problem Statement
Markdown preview not rendering in task view. Border around content unwanted. Fix preview render and remove border while keeping click-to-edit flow.

## Scope
**In:**
- Markdown renders by default in task description
- Toggle to raw editor on click, render on blur
- Remove border styling from rendered view
**Out:**
- New markdown parser features
- Global textarea restyling

## Implementation Plan

### Phase: Fix Markdown Rendering
- [x] Verify `MarkdownEditor` renders `StreamingMarkdown` in display state
- [x] Ensure `TaskEditor` uses `MarkdownEditor` for description view
- [x] Add or adjust props so empty state still renders placeholder

### Phase: Remove Border Styling
- [x] Locate border styles for rendered view
- [x] Remove border classes or style overrides from display state

## Key Files
- `src/components/ui/markdown-editor.tsx` - render logic, display styles
- `src/components/tasks/task-editor.tsx` - editor usage wiring

## Success Criteria
- [x] Task description renders markdown by default
- [x] Click switches to raw textarea; blur returns to rendered view
- [x] No border around rendered content
