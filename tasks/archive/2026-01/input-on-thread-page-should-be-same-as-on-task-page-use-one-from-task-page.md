# input on thread page should be same as on task page. use one from task page

## Problem Statement
Thread page input UI differs from task page input; inconsistent UX, duplicate styling. Reuse task page input on thread page; keep thread behaviors.

## Scope
**In:**
- Shared input component from task page UI
- Thread page input swap to shared component
- Preserve thread send, queue, attachment behavior
**Out:**
- Agent session backend changes
- Task rewrite business logic changes

## Implementation Plan

### Phase: Shared Component
- [x] Create shared input component `src/components/tasks/task-input.tsx`
- [x] Extract TaskFooter input markup into `src/components/tasks/task-input.tsx`
- [x] Add props/slots for toolbar, extra content, and submit handling

### Phase: Task Page Wiring
- [x] Refactor `src/components/tasks/task-footer.tsx` to use shared input
- [x] Map agent picker, split, submit controls into shared input slots

### Phase: Thread Page Wiring
- [x] Replace input block in `src/routes/agents/$sessionId.tsx` with shared input
- [x] Wire message send/queue handlers into shared input props
- [x] Render attachment preview/controls via shared input slots

### Phase: Verify
- [x] Manual check task page rewrite input unchanged
- [x] Manual check thread page input matches task page styling

## Key Files
- `src/components/tasks/task-input.tsx` - new shared input
- `src/components/tasks/task-footer.tsx` - use shared input on task page
- `src/routes/agents/$sessionId.tsx` - use shared input on thread page

## Success Criteria
- [x] Thread page input renders via `src/components/tasks/task-input.tsx`
- [x] Task page rewrite input still submits and opens agent picker
- [x] Thread page still supports attachments and queue behavior

## Open Questions Resolved
- Thread-only features (attachments, queue) are passed as slots and rendered conditionally
- TaskFooter maintains absolute positioning via containerClassName prop; thread page uses inline layout
