# why i do not see QA agent? add it to new task modal

## Problem Statement
QA agent missing from new task modal agent type list
User cannot pick mcporter for task planning

## Scope
**In:**
- New task modal agent type options
- Planner agent availability list and ordering

**Out:**
- Agent availability detection logic
- Non-task agent pickers (run/rewrite/verify)

## Implementation Plan

### Phase: Planner Type List
- [x] Add mcporter to create-modal planner candidates
- [x] Add mcporter to planner preferred order

### Phase: UI Sanity
- [x] Confirm QA Agent label shows when mcporter available

## Key Files
- `src/routes/tasks/_page.tsx` - include mcporter in planner lists

## Success Criteria
- [x] New task modal shows QA Agent when mcporter available
- [x] QA Agent selectable and preserved for create flow

## Notes
- Label confirmed via `agentTypeLabel` mapping (`mcporter: 'QA Agent'`) in `src/lib/agent/config.ts`.

## Unresolved Questions
- None
