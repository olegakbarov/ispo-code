# creating new task should allow choosing between bug and feature. first is using debug tools and second creates plan

## Problem Statement
Task creation modal currently only offers "Use AI" toggle. Need upfront choice: Bug (systematic debugging) vs Feature (planning agent). Bug tasks invoke systematic-debugging skill, feature tasks use existing planning flow.

## Scope
**In:**
- Task type selector (Bug/Feature) in create modal
- Bug type → spawn agent with systematic-debugging skill invocation
- Feature type → spawn agent with existing planning prompt
- Update modal UI to show type choice before agent options

**Out:**
- Modifying existing task execution/review/verify flows
- Changing task file format or metadata
- Adding task type persistence beyond initial creation

## Implementation Plan

### Phase: UI Updates
- [x] Add task type radio buttons (Bug/Feature) in `CreateTaskModal`
- [x] Reorder modal flow: type → agent toggle → agent config
- [x] Update modal state to track `taskType: 'bug' | 'feature'`
- [x] Update labels: "Use AI" becomes context-aware ("Debug with AI" / "Plan with AI")

### Phase: Backend Integration
- [x] Add `taskType` param to `createWithAgent` mutation input schema
- [x] Create `buildTaskDebugPrompt()` function in `src/trpc/tasks.ts`
- [x] Debug prompt invokes Skill tool: `skill: "systematic-debugging", args: "{title}"`
- [x] Switch in `createWithAgent` mutation: bug → debug prompt, feature → planning prompt
- [x] Pass task type metadata to daemon spawn (for UI display)

### Phase: Modal Logic
- [x] Wire task type state to `onCreate` handler in `src/routes/tasks.tsx`
- [x] Pass `taskType` to `createWithAgent` mutation call
- [x] Update default state: `taskType: 'feature'` (preserve existing behavior)

## Key Files
- `src/components/tasks/create-task-modal.tsx` - add type selector UI
- `src/routes/tasks.tsx` - wire task type state to mutation
- `src/trpc/tasks.ts` - add taskType param, buildTaskDebugPrompt function, routing logic

## Success Criteria
- [x] Modal shows Bug/Feature choice before agent options
- [x] Bug tasks invoke systematic-debugging skill
- [x] Feature tasks use existing planning prompt
- [x] Existing create flows unaffected (default to feature)

## Implementation Notes
All planned features implemented successfully:
- Radio button UI added with "Feature" and "Bug" options
- Checkbox label dynamically changes: "Plan with AI" (feature) or "Debug with AI" (bug)
- Backend routing: bug tasks call `buildTaskDebugPrompt()` which invokes systematic-debugging skill
- Feature tasks continue using `buildTaskExpansionPrompt()` for planning
- Session title prefix: "Debug:" for bugs, "Plan:" for features
- Default task type: "feature" (preserves existing behavior)
- Build passes with no TypeScript errors

## Unresolved Questions
- Should task file include type metadata comment for future reference?
- Should sidebar show different icons for bug vs feature tasks?
- Should debug tasks get different default agent type (e.g. claude preferred)?
