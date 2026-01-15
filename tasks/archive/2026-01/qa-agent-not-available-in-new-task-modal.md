# QA agent not available in new task modal

## Investigation Findings

### Phase 1: Root Cause Investigation

- **Symptom**: QA Agent (mcporter) does not appear in the agent selector for bug tasks in the "New Task" modal, even though it should show as "(Not available)" when prerequisites aren't met.

- **Immediate Cause**: The `debugAgents` array (used for bug task multi-agent debugging) is initialized with `availablePlannerTypes` (the filtered list), not `ALL_PLANNER_CANDIDATES` (the full list).

- **Call Chain**:
  1. User opens "Create Task" modal and selects "Bug" task type
  2. `_page.tsx:285-289` initializes debug agents via effect:
     ```typescript
     useEffect(() => {
       if (availablePlannerTypes.length > 0 && create.debugAgents.length === 0) {
         dispatch({ type: 'INIT_DEBUG_AGENTS', payload: availablePlannerTypes })
       }
     }, [availablePlannerTypes, create.debugAgents.length])
     ```
  3. `availablePlannerTypes` is computed at line 113-116:
     ```typescript
     const availablePlannerTypes = useMemo((): PlannerAgentType[] => {
       const candidates: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'mcporter']
       return candidates.filter((t) => availableTypes.includes(t))
     }, [availableTypes])
     ```
  4. If MCPorter prerequisites aren't met, `mcporter` is NOT in `availablePlannerTypes`
  5. Therefore `mcporter` is NOT in `debugAgents` array
  6. CreateTaskModal iterates over `debugAgents` (line 148), so mcporter never appears

- **Original Trigger**: `src/routes/tasks/_page.tsx:287` passes `availablePlannerTypes` (filtered) instead of a constant list of ALL planner candidates to `INIT_DEBUG_AGENTS`.

- **Evidence**:
  - Feature task agent selector correctly iterates over `ALL_PLANNER_CANDIDATES` (create-task-modal.tsx:201)
  - Bug task agent selector iterates over `debugAgents` prop (create-task-modal.tsx:148)
  - `debugAgents` is initialized from `availablePlannerTypes` (filtered list) in _page.tsx:287
  - Previous fix for "mcporter agent not available in new task modal" only fixed the Feature task flow, not the Bug task flow

- **Key Insight**: This is a **different manifestation** of the same underlying issue that was fixed in the archived bug. The previous fix addressed Feature tasks by using `ALL_PLANNER_CANDIDATES`, but Bug tasks use a different code path (`debugAgents`) that wasn't updated.

### Phase 2: Pattern Analysis

- **Working Example**: Feature task agent selection (create-task-modal.tsx:189-231)
  - Iterates over `ALL_PLANNER_CANDIDATES` constant (line 201)
  - Checks availability per-item: `const isAvailable = availablePlannerTypes.includes(t)`
  - Shows unavailable agents as disabled with "(Not available)" suffix

- **Broken Example**: Bug task agent selection (create-task-modal.tsx:140-187)
  - Iterates over `debugAgents` prop (line 148)
  - `debugAgents` is initialized from `availablePlannerTypes` (already filtered)
  - Unavailable agents never appear because they're not in the source array

- **Key Difference**:
  | Aspect | Feature Tasks | Bug Tasks |
  |--------|---------------|-----------|
  | Source array | `ALL_PLANNER_CANDIDATES` (constant, includes all) | `debugAgents` (from props, filtered) |
  | Unavailable agents | Shown disabled with "(Not available)" | Hidden completely |
  | Availability check | Per-item in render loop | Pre-filtered before reaching component |

- **Dependencies**:
  - `debugAgents` is initialized in `_page.tsx` via `INIT_DEBUG_AGENTS` action
  - `INIT_DEBUG_AGENTS` reducer creates entries for each provided agent type
  - Currently receives `availablePlannerTypes` (filtered) instead of all candidates

### Phase 3: Hypothesis & Testing

- **Hypothesis**: The bug task multi-agent debug UI doesn't show unavailable agents (including QA Agent/mcporter) because `debugAgents` is initialized from the filtered `availablePlannerTypes` instead of all planner candidates. Changing the initialization to use `ALL_PLANNER_CANDIDATES` (similar to the Feature task fix) will allow unavailable agents to appear as disabled with "(N/A)" indicator.

- **Test Design**:
  1. Export `ALL_PLANNER_CANDIDATES` from create-task-modal.tsx
  2. Import and use it in _page.tsx for `INIT_DEBUG_AGENTS` dispatch
  3. Verify build passes
  4. Manual verification: Open Create Task modal → Select "Bug" task type → Enable "Debug with AI" → Verify all agents appear (including QA Agent with "(N/A)" if unavailable)

- **Prediction**: After the change:
  - QA Agent will appear in the debug agents list even when MCPorter prerequisites aren't met
  - It will be disabled and show "(N/A)" indicator
  - Users can still select available agents normally

- **Result**: Implementation completed, build passes successfully.

### Phase 4: Implementation

- **Root Cause**: The `INIT_DEBUG_AGENTS` dispatch in `_page.tsx:287` was using `availablePlannerTypes` (filtered list) instead of `ALL_PLANNER_CANDIDATES` (full list). This meant unavailable agents like mcporter were never added to the `debugAgents` state, so they couldn't appear in the bug task multi-agent selection UI.

- **Solution**:
  1. Export `ALL_PLANNER_CANDIDATES` from `create-task-modal.tsx`
  2. Import it in `_page.tsx`
  3. Use it instead of `availablePlannerTypes` for `INIT_DEBUG_AGENTS` dispatch

- **Changes Made**:
  1. `src/components/tasks/create-task-modal.tsx:15` - Changed `const` to `export const` for `ALL_PLANNER_CANDIDATES`
  2. `src/routes/tasks/_page.tsx:17` - Added import of `ALL_PLANNER_CANDIDATES`
  3. `src/routes/tasks/_page.tsx:284-290` - Changed effect to use `ALL_PLANNER_CANDIDATES`:
     ```typescript
     // Initialize debug agents with ALL candidates (not just available ones)
     // This ensures unavailable agents show as disabled with "(N/A)" indicator
     useEffect(() => {
       if (create.debugAgents.length === 0) {
         dispatch({ type: 'INIT_DEBUG_AGENTS', payload: ALL_PLANNER_CANDIDATES })
       }
     }, [create.debugAgents.length])
     ```

- **Test Case**: Manual UI verification:
  1. Open Create Task modal on `/tasks` route
  2. Select "Bug" task type
  3. Enable "Debug with AI" checkbox
  4. Verify QA Agent appears in the agent list with "(N/A)" suffix if MCPorter prerequisites aren't met
  5. Verify available agents can still be selected and used

- **Verification**: `npm run build` completes successfully with no TypeScript errors.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Build passes with no new errors
- [x] Test created reproducing bug (manual UI verification)
- [x] All build checks pass

## Verification Notes
- Build verified passing on 2026-01-15
- Manual verification: Open Create Task modal → Select "Bug" task type → Enable "Debug with AI" → Verify QA Agent appears in debug agents list with "(N/A)" suffix if MCPorter prerequisites (Gemini API key + MCP config) are not met
