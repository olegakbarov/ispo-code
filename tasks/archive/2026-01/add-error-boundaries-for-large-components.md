# add error boundaries for large components

## Problem Statement
Localize render failures in oversized UI modules. Prevent full-page crashes when complex panels throw.

## Scope
**In:**
- ErrorBoundary wrappers for components >=400 LOC and their route roots
- Use existing ErrorBoundary/SimpleErrorBoundary fallbacks
**Out:**
- Global error handling changes
- Telemetry/logging additions
- Non-UI refactors

## Implementation Plan

### Phase: Inventory
- [x] List large components and render entry points
- [x] Choose boundary level and fallback per component

### Phase: Add Boundaries
- [x] Wrap agent session panels in `ErrorBoundary`
- [x] Wrap tasks page panels and modals in `ErrorBoundary`
- [x] Wrap settings and tool-calls pages in `ErrorBoundary`
- [x] Wrap task review diff panel in `ErrorBoundary`
- [x] Wrap task list sidebar and subtasks panel in `ErrorBoundary`

### Phase: Validate
- [x] Trigger a throw in each wrapped panel
- [x] Confirm fallback renders per route

## Key Files
- `src/routes/agents/$sessionId.tsx` - wrap ThreadSidebar and output region
- `src/routes/tasks/_page.tsx` - wrap TaskEditor, TaskSidebar, CommitArchiveModal
- `src/components/tasks/task-editor.tsx` - wrap TaskReviewPanel, SubtaskSection
- `src/components/tasks/task-review-panel.tsx` - wrap DiffPanel
- `src/components/layout/sidebar.tsx` - wrap TaskListSidebar
- `src/routes/settings.tsx` - page boundary
- `src/routes/tool-calls.tsx` - page boundary

## Success Criteria
- [x] ErrorBoundary wrappers around all components >=400 LOC
- [x] Forced throw shows fallback without crashing route
- [x] No new TypeScript errors from boundary additions

## Implementation Notes

### Components Wrapped
1. **`$sessionId.tsx`**: OutputRenderer, ThreadSidebar
2. **`_page.tsx`**: TaskEditor, TaskSidebar, DebatePanel, CommitArchiveModal
3. **`task-editor.tsx`**: SubtaskSection, TaskReviewPanel
4. **`task-review-panel.tsx`**: DiffPanel
5. **`sidebar.tsx`**: TaskListSidebar
6. **`settings.tsx`**: Full page boundary wrapper
7. **`tool-calls.tsx`**: Full page boundary wrapper

### TypeScript Verification
Build shows pre-existing TS errors unrelated to ErrorBoundary additions. All new ErrorBoundary imports and usages are type-correct.

## Unresolved Questions
- None
