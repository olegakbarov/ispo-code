# Auto-Run Task Phases: Planning → Implementation → Verification

## Problem Statement
Currently all phase transitions (planning→impl→verify) require manual button clicks. Add checkbox to auto-progress through phases when each completes.

## Scope
**In:**
- Checkbox in CreateTaskModal (default: checked)
- Store autoRun flag in task state
- Auto-trigger implementation after planning completes
- Auto-trigger verification after implementation completes

**Out:**
- Auto-merge to main
- Auto-archive
- Auto-pass/fail QA

## Implementation Plan

### Phase: State & Storage
- [x] Add `autoRun: boolean` to task state in `src/lib/stores/tasks-reducer.ts`
- [x] Add `autoRun` field to `CreateModalState` in reducer
- [x] Persist autoRun in task markdown metadata: `<!-- autoRun: true -->`

### Phase: UI - Create Modal
- [x] Add checkbox to `src/components/tasks/create-task-form.tsx`
- [x] Label: "Auto-run phases" with explanation text
- [x] Default checked, wire to form state

### Phase: Auto-Transition Logic
- [x] In `use-task-actions.ts`: detect planning session completion
- [x] If autoRun && planning done → auto-call `handleStartImplement()` with stored prefs
- [x] Detect implementation session completion
- [x] If autoRun && impl done → auto-call `handleStartVerify()`

### Phase: Session Monitoring
- [x] Monitor agentSession status changes via useEffect
- [x] Track session type via title/prompt (planning/execution/verify)
- [x] Trigger next phase on status transition to 'completed'

## Key Files
- `src/lib/stores/tasks-reducer.ts` - autoRun state management
- `src/components/tasks/create-task-modal.tsx` - modal props
- `src/components/tasks/create-task-form.tsx` - checkbox UI
- `src/lib/hooks/use-task-actions.ts` - auto-trigger logic
- `src/lib/agent/task-service.ts` - parse/persist autoRun metadata
- `src/trpc/tasks.ts` - API mutations with autoRun support

## Success Criteria
- [x] Checkbox visible in create modal, default checked
- [x] Creating task with autoRun → autoRun metadata persisted to task file
- [x] Session monitoring detects planning completion
- [x] Auto-triggers implementation after planning completes (2s delay)
- [x] Auto-triggers verification after implementation completes (2s delay)
- [x] Can uncheck to disable auto-progression
