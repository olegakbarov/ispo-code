# add unarchive button to archived task that would allow to gather all context and add a user message. this would be used for bugs that were not fixed

## Problem Statement
Archived tasks: no unarchive flow with context + user message.
Unfixed bugs: need fast reopen with guidance for next run.

## Scope
**In:**
- unarchive CTA for archived task view
- message modal for unarchive
- server mutation to restore + build context + spawn session
- cache + navigation updates after restore
**Out:**
- new task type metadata
- redesign of task review UX
- auto-run without user message

## Implementation Plan

### Phase: UI + State
- [x] Add unarchive CTA in archived task review state
- [x] Add unarchive message modal component
- [x] Add reducer state + actions for unarchive modal

### Phase: Server Context + Mutation
- [x] Add tRPC mutation for unarchive-with-context flow
- [x] Add context builder for task content + session outputs
- [x] Spawn resume session using context + user message

### Phase: Client Wiring + Cache
- [x] Wire unarchive mutation in task actions and review panel
- [x] Update caches and navigate to restored task path
- [x] Surface new session in task sessions list

## Key Files
- `src/components/tasks/all-committed-state.tsx` - add unarchive CTA
- `src/components/tasks/task-review-panel.tsx` - unarchive handler + modal trigger
- `src/components/tasks/task-input.tsx` - reuse message input UI
- `src/lib/stores/tasks-reducer.ts` - unarchive modal state/actions
- `src/lib/hooks/use-task-actions.ts` - unarchive flow handler
- `src/lib/hooks/use-task-mutations.ts` - unarchive mutation wiring
- `src/trpc/tasks.ts` - unarchive-with-context mutation
- `src/lib/agent/task-session.ts` - session output lookup helper

## Success Criteria
- [x] Archived task shows unarchive CTA with message input
- [x] Unarchive restores task and starts session with user message + context
- [x] Task list updates to active and navigates to restored task

## Implementation Notes

**Answered Questions:**
- Unarchive CTA placed in AllCommittedState component for archived tasks
- Spawns agent session with context (not just restore)
- Context sources: task content + last 3 session outputs + edited files list
- Default agent: codex (configurable in modal)
- User message passed to agent prompt, not persisted in task file

**Architecture:**
- Modal: UnarchiveModal component with agent/model selection
- Mutation: tasks.unarchiveWithContext gathers context from registry + streams
- Context limit: 5000 chars per session, 3 sessions max
- Navigation: optimistic update + redirect to restored task path

**Files Modified:**
- `src/components/tasks/all-committed-state.tsx` - added unarchive button
- `src/components/tasks/unarchive-modal.tsx` - new modal component
- `src/components/tasks/task-review-panel.tsx` - wired onUnarchiveWithAgent
- `src/components/tasks/task-editor.tsx` - passed through handler
- `src/lib/stores/tasks-reducer.ts` - added unarchive state + actions
- `src/lib/hooks/use-task-actions.ts` - exposed unarchive handlers
- `src/lib/hooks/use-task-crud-actions.ts` - added unarchive actions
- `src/lib/hooks/use-task-mutations.ts` - added mutation + cache updates
- `src/trpc/tasks.ts` - added unarchiveWithContext mutation
- `src/routes/tasks/_page.tsx` - wired modal + handlers
