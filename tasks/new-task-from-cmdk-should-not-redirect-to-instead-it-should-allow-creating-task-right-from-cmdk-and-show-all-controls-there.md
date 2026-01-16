# new task from cmdk should not redirect to /, instead it should allow creating task right from cmdk and show all controls there

## Problem Statement
CmdK "New Task" redirects to `/tasks/new`; create should live in cmdk. Create inputs embedded in palette; no layout reflow.

## Scope
**In:**
- Embedded create form + actions inside cmdk dialog
- Stable cmdk body height with scroll/overflow to avoid reflow
- Reuse `useCreateTaskForm` for state and task creation
- Back/Escape handling for create mode and palette close

**Out:**
- Redesign of create form fields or validation
- Changes to `/tasks/new` beyond shared logic
- New backend APIs or mutations

## Implementation Plan

### Phase: Cmdk Layout
- [x] Set fixed/min height and overflow strategy for cmdk body
- [x] Keep commands and create views within same container; toggle visibility without height change

### Phase: Create Flow
- [x] Route "New Task" to create mode without navigation
- [x] Embed `CreateTaskForm` and `CreateTaskActions` in cmdk create view
- [x] Use `useCreateTaskForm` for field state and create mutation
- [x] Wire Escape/back to return to commands; second Escape closes palette

### Phase: QA
- [x] Verify no reflow on mode switch or input changes
- [x] Verify create success closes palette and navigates to task

## Key Files
- `src/components/tasks/task-command-palette.tsx` - cmdk mode + layout changes
- `src/lib/hooks/use-create-task-form.ts` - shared form state
- `src/components/tasks/create-task-form.tsx` - embedded form UI

## Success Criteria
- [x] CmdK "New Task" -> embedded create UI, no route change
- [x] Palette height stable; no visible reflow on toggle or typing
- [x] Create works in cmdk with full controls present
- [x] Escape/back returns to commands; second Escape closes palette

## Implementation Notes
- Consolidated two separate render functions (`renderCreateMode` and `renderCommandsMode`) into single `renderPaletteContent`
- Unified container positioning at `top-[12%]` and `max-w-2xl` for both modes
- Added `min-h-[200px]` to prevent layout jump between modes
- The existing implementation already had all the core features; this change improved layout stability
