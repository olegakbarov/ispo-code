# tasks without "plan with ai" should proceed straight to impl phase

<!-- autoRun: true -->

## Problem Statement

When creating a task without "Plan with AI" checked, the task was being created with a skeleton plan (`## Plan\n- [ ] Define scope\n- [ ] Implement\n- [ ] Validate`) and then using the generic "execute a task plan" prompt. This was confusing because:
1. The skeleton plan has no meaningful content
2. The execution prompt assumed there was a real plan to follow

## Implementation Plan

- [x] Add `buildDirectImplementationPrompt` function for no-plan tasks (direct implementation prompt)
- [x] Add `createAndExecute` tRPC endpoint that creates task and immediately spawns implementation agent
- [x] Update `use-task-mutations.ts` to include `createAndExecuteMutation`
- [x] Update `use-task-create-actions.ts` to use new `createAndExecuteMutation` instead of `create` + `assignToAgent` chain
- [x] Update `use-task-actions.ts` interface and parameters
- [x] Update `_page.tsx` to use new mutation

## Key Files Changed

- `src/trpc/tasks.ts` - Added `buildDirectImplementationPrompt` function and `createAndExecute` endpoint
- `src/lib/hooks/use-task-mutations.ts` - Added `createAndExecuteMutation` with optimistic updates
- `src/lib/hooks/use-task-create-actions.ts` - Updated to use `createAndExecuteMutation` for no-plan tasks
- `src/lib/hooks/use-task-actions.ts` - Updated interface and composition to pass new mutation

## Changes Summary

### Before
1. User creates task without "Plan with AI"
2. `createMutation` creates task with skeleton plan content
3. On success, `assignToAgentMutation` is called with 500ms delay
4. Agent receives "execute a task plan" prompt with meaningless skeleton content

### After
1. User creates task without "Plan with AI"
2. `createAndExecuteMutation` creates task and spawns agent in one step
3. Task content is `# {title}\n\n_Implementing..._\n` (no skeleton plan)
4. Agent receives "direct implementation" prompt that tells it to analyze the task, explore the codebase, and implement directly

## Success Criteria

- [x] Tasks without "Plan with AI" create and execute in one API call
- [x] No skeleton plan in task content
- [x] Agent receives appropriate prompt for direct implementation
- [x] Optimistic updates work correctly
