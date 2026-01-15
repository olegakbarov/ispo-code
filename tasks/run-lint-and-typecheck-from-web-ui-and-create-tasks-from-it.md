# Run lint and typecheck from web UI and create tasks from it

## Problem Statement
No UI to run lint/typecheck and surface errors. Users must run commands manually, then manually create tasks for fixes. Need integrated workflow: run → view errors → create tasks from violations.

## Scope
**In:**
- tRPC procedure to execute lint/typecheck
- UI trigger in tasks page/sidebar
- Results display modal/panel
- One-click task creation from errors

**Out:**
- Auto-fix capabilities
- Watch mode / continuous checking
- Custom lint rules configuration
- Agent-assisted fixing (future)

## Implementation Plan

### Phase 1: Backend - tRPC Procedure
- [ ] Add `npm run lint` and `npm run typecheck` scripts to package.json (eslint, tsc --noEmit)
- [ ] Create `src/trpc/lint.ts` router with `runLintAndTypecheck` procedure
- [ ] Parse lint output into structured format: `{ file, line, column, severity, message, rule }`
- [ ] Parse typecheck output: `{ file, line, column, message, code }`
- [ ] Return combined results with summary stats

### Phase 2: UI - Trigger & Results Display
- [ ] Add "Run Lint/Typecheck" button to tasks sidebar header
- [ ] Create `src/components/tasks/lint-results-modal.tsx`
- [ ] Display grouped by file with expandable error details
- [ ] Show severity badges (error/warning/info)
- [ ] Add "Create Task" button per file group or per individual error

### Phase 3: Task Creation Integration
- [ ] Add `createTaskFromLintErrors` mutation in tasks router
- [ ] Generate markdown task with file paths, line numbers, error messages
- [ ] Include actionable checklist from errors
- [ ] Navigate to created task after creation

## Key Files
- `package.json` - add lint/typecheck scripts
- `src/trpc/lint.ts` - new router for lint/typecheck execution
- `src/trpc/router.ts` - merge lint router
- `src/components/tasks/lint-results-modal.tsx` - new modal
- `src/components/tasks/task-sidebar.tsx` - add trigger button
- `src/trpc/tasks.ts` - add createTaskFromLintErrors mutation

## Success Criteria
- [ ] Single button runs lint+typecheck from UI
- [ ] Results display in modal with file/line/message
- [ ] Can create task from any subset of errors
- [ ] Created task has actionable checklist format

## Unresolved Questions
1. Lint tool: ESLint? Biome? (Biome faster, ESLint more ecosystem)
2. Should errors group by file or by rule/error-type?
3. Run in project root or respect session worktree context?
4. Persist results or ephemeral modal only?
