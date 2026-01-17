# add plan regenerate if planning session fails

<!-- taskId: 8FJpJdzyne -->

<!-- autoRun: true -->

## Problem Statement
Planning session fails; plan stays placeholder, no retry path. Users forced to create new task or manual rerun. Need regenerate action when planning fails.

## Scope
**In:**
- Failed planning detection in `src/routes/tasks/_page.tsx`
- Regenerate plan CTA in `src/components/tasks/task-editor.tsx`
- Regenerate plan mutation in `src/trpc/tasks.ts`
- Client mutation + optimistic sessions in `src/lib/hooks/use-task-mutations.ts`
**Out:**
- Debug task retry flow in `src/trpc/tasks.ts`
- Plan rewrite UX changes in `src/components/tasks/task-footer.tsx`
- Auto-retry without user action in `src/lib/hooks/use-task-agent-actions.ts`

## Implementation Plan

### Phase: Server
- [x] Add regenerate plan mutation in `src/trpc/tasks.ts`
- [x] Reuse planning prompt builder in `src/trpc/tasks.ts`
- [x] Preserve autoRun metadata in `src/trpc/tasks.ts`
- [x] Reset placeholder only when unchanged in `src/trpc/tasks.ts`

### Phase: Client
- [x] Add regenerate mutation hook in `src/lib/hooks/use-task-mutations.ts`
- [x] Seed active session cache in `src/lib/hooks/use-task-mutations.ts`
- [x] Seed planning session list in `src/lib/hooks/use-task-mutations.ts`
- [x] Wire regenerate mutation in `src/lib/hooks/use-task-actions.ts`
- [x] Add regenerate handler in `src/lib/hooks/use-task-agent-actions.ts`
- [x] Add failed-plan helper in `src/lib/tasks/plan-regenerate.ts`
- [x] Compute failed-plan state in `src/routes/tasks/_page.tsx`
- [x] Pass failed-plan props in `src/routes/tasks/_page.tsx`
- [x] Render regenerate CTA in `src/components/tasks/task-editor.tsx`

### Phase: Tests
- [x] Add helper test in `src/lib/tasks/plan-regenerate.test.ts`

## Key Files
- `src/trpc/tasks.ts` - add regenerate plan mutation
- `src/lib/hooks/use-task-mutations.ts` - client mutation + optimistic sessions
- `src/lib/hooks/use-task-actions.ts` - mutation wiring
- `src/lib/hooks/use-task-agent-actions.ts` - regenerate handler wiring
- `src/lib/tasks/plan-regenerate.ts` - failed-plan helper
- `src/routes/tasks/_page.tsx` - failed-plan detection + props
- `src/components/tasks/task-editor.tsx` - regenerate CTA UI

## Success Criteria
- [x] Failed planning shows regenerate action in task editor
- [x] Regenerate starts new planning session and shows planning output
- [x] Placeholder replaced by new plan after regeneration

## Unresolved Questions
- None
