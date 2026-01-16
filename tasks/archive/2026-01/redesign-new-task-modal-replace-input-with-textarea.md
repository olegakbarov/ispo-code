# redesign new task modal. replace input with textarea

## Problem Statement
Single-line input in new task modal; limits multi-line prompts. Need textarea for longer task descriptions.

## Scope
**In:**
- Replace title input with textarea in shared create task form
- Update modal/inline layout for textarea size and spacing
- Adjust submit key handling for textarea behavior

**Out:**
- New task flow logic or API changes
- Redesign of non-create task forms
- Styling changes outside new task UI

## Implementation Plan

### Phase: UI Swap
- [x] Replace `Input` with `Textarea` in create task form
  - Verified: title control uses `Textarea` in `src/components/tasks/create-task-form.tsx`.
- [x] Set textarea rows/min-height and class tweaks for modal layout
  - Verified: `rows={3}` plus `variant="sm"` and `className="bg-background"` on the textarea in `src/components/tasks/create-task-form.tsx`.

### Phase: Behavior
- [x] Update key handling for textarea submit vs newline
  - Verified: Cmd/Ctrl+Enter triggers submit without blocking plain Enter in `src/components/tasks/create-task-form.tsx`.
- [x] Confirm modal and inline create form render updated control
  - Verified: modal renders `CreateTaskForm` in `src/components/tasks/create-task-modal.tsx`; inline renders `CreateTaskForm` in `src/routes/tasks/_page.tsx`.

## Key Files
- `src/components/tasks/create-task-form.tsx` - swap to textarea, key handling
- `src/components/tasks/create-task-modal.tsx` - modal sizing if needed
- `src/routes/tasks/_page.tsx` - inline form layout if needed
- `src/components/ui/textarea.tsx` - base styles if tweaks required

## Success Criteria
- [x] New task modal uses textarea for title input
  - Verified: modal uses `CreateTaskForm` in `src/components/tasks/create-task-modal.tsx`, which renders a `Textarea` in `src/components/tasks/create-task-form.tsx`.
- [x] Inline create form uses same textarea
  - Verified: inline form uses `CreateTaskForm` in `src/routes/tasks/_page.tsx`, which renders a `Textarea` in `src/components/tasks/create-task-form.tsx`.
- [x] Submit behavior works without blocking multiline entry
  - Verified: `onKeyDown` only intercepts Cmd/Ctrl+Enter in `src/components/tasks/create-task-form.tsx`.

## Resolved Questions
- Submit shortcut: Cmd/Ctrl+Enter (with hint text shown below textarea)
- Default textarea height: 3 rows

## Verification Results
- Tests: `npm run test:run` (failed: 6 tests in `src/lib/agent/manager.test.ts`; vitest worker fork EAGAIN errors).
- Notes: Vitest warns `src/routes/tasks/_page.tsx` does not export a Route.