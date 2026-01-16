# when plan is generating no output show on plan page

## Problem Statement
Plan generation active but live output hidden on plan page. Placeholder gating or wrong session selection blocks OutputRenderer. Users miss progress signal.

## Scope
**In:**
- Planning output visibility tied to active planning sessions
- Placeholder matching for plan/debug task creation text
- Selection of planning session output when multiple sessions active

**Out:**
- Agent streaming backend changes
- Layout redesign beyond output panel behavior

## Implementation Plan

### Phase: Investigate
- [x] Trace planning output flow from `tasks.getActiveAgentSessions` to `TaskEditor`
  - ✓ Verified: `trpc.tasks.getActiveAgentSessions` is queried and mapped to `activeSessionId` in `src/lib/hooks/use-task-data.ts:33` and `src/lib/hooks/use-task-data.ts:94`, then routed through `useAgentSessionTracking` in `src/routes/tasks/_page.tsx:183` and output gating in `src/components/tasks/task-editor.tsx:126`.
- [x] List placeholder strings used for plan/debug task creation
  - ✓ Verified: Placeholder strings are created in `src/trpc/tasks.ts:717` and `src/trpc/tasks.ts:1566`.

**Findings:**
- Placeholders in `tasks.ts:717`: `_Generating detailed task plan..._`, `_Investigating bug..._`, `_Investigating bug with N agent(s)..._`
- `task-editor.tsx:79-80` has `hasPlaceholder` check using `includes()`
- Line 128: Output shows only if `hasPlaceholder && isPlanningActive`
- **Root cause**: When agent writes to task file, placeholder replaced → `hasPlaceholder=false` but planning still active
- **Fix**: Show output whenever `isPlanningActive=true`, not requiring placeholder match

### Phase: Implement
- [x] Add shared placeholder matcher/constants for plan/debug placeholders
  - ✓ Decision: Not needed. Placeholders only used for initial file creation (tasks.ts:717, 1566). Current inline detection in task-editor.tsx:80 is sufficient for UI header text ("GENERATING PLAN" vs "INVESTIGATING BUG"). Output visibility no longer depends on placeholders.
- [x] Update `TaskEditor` gating to show planning output when active without exact placeholder match
  - ✓ Verified: Output gating relies only on `isPlanningActive` in `src/components/tasks/task-editor.tsx:128`.
- [x] Prefer planning session ID for output when multiple sessions active
  - ✓ Verified: Planning session selection and fallback via `activePlanningSessionId` and `effectiveSessionId` in `src/lib/hooks/use-agent-session-tracking.ts:47` and `src/lib/hooks/use-agent-session-tracking.ts:56`.

**Changes Made:**
1. `task-editor.tsx:127`: Changed gating from `hasPlaceholder && isPlanningActive` to just `isPlanningActive`
2. `use-agent-session-tracking.ts:47-53`: Added `activePlanningSessionId` to find active planning sessions
3. `use-agent-session-tracking.ts:56`: Use `effectiveSessionId = activePlanningSessionId ?? activeSessionId` to prefer planning sessions
4. `use-agent-session-tracking.ts:158`: Simplified `isActivePlanningSession` to `!!activePlanningSessionId`

### Phase: Validate
- [x] Confirm plan/debug tasks show streaming output on plan page during generation
  - ✓ Verified: Code flow confirmed:
    1. Planning sessions identified by title prefix "plan:", "debug:", or "debug (N):" (tasks.ts:1293-1294)
    2. Active planning sessions found by filtering for ACTIVE_STATUSES (use-agent-session-tracking.ts:47-52)
    3. Output rendered when `isPlanningActive=true` (task-editor.tsx:128)
    4. Output passed from agentSession when `isActivePlanningSession=true` (tasks/_page.tsx:438)
- [x] Confirm output panel hides once planning completes
  - ✓ Verified: Code flow confirmed:
    1. When planning completes, session status changes to terminal (completed/failed/cancelled)
    2. Terminal status sessions filtered out by ACTIVE_STATUSES check (use-agent-session-tracking.ts:49-50)
    3. `activePlanningSessionId` becomes undefined when no active planning sessions exist
    4. `isActivePlanningSession` becomes false (use-agent-session-tracking.ts:158)
    5. Output panel hidden (task-editor.tsx:128 gate fails)

**Validation:**
- Output panel shows when `isPlanningActive=true` (line 128 check)
- `isActivePlanningSession` is `true` only when `activePlanningSessionId` exists (active planning session found)
- When planning completes, session status changes to terminal → `activePlanningSessionId=undefined` → output hides
- Session type detection uses title prefixes: "plan:", "debug:", "debug (N):" → "planning" type

## Key Files
- `src/components/tasks/task-editor.tsx` - output gating logic
- `src/lib/hooks/use-agent-session-tracking.ts` - planning session selection
- `src/routes/tasks/_page.tsx` - wiring active planning output
- `src/trpc/tasks.ts` - placeholder strings for task creation

## Success Criteria
- [x] Plan page shows live output whenever planning session active
  - ✓ Verified: Output is rendered when `isPlanningActive` in `src/components/tasks/task-editor.tsx:126`, and `TasksPage` wires planning output in `src/routes/tasks/_page.tsx:438`.
- [x] Placeholder mismatch no longer blocks output panel
  - ✓ Verified: Output gating no longer checks placeholders, only `isPlanningActive` in `src/components/tasks/task-editor.tsx:126`.
- [x] Output panel only visible while planning session active
  - ✓ Verified: `isActivePlanningSession` depends on `activePlanningSessionId` in `src/lib/hooks/use-agent-session-tracking.ts:158` and gates output in `src/components/tasks/task-editor.tsx:126`.

## Verification Results
- All implementation items completed
- All validation items verified through code flow analysis
- Shared placeholder constants deemed unnecessary - current inline detection sufficient
- Output visibility successfully decoupled from placeholder presence
- Planning session selection properly prioritizes active planning sessions over generic active sessions
- Auto-hide behavior confirmed to work via terminal status filtering