# in sidebar currently requiring attention tasks should be first

## Problem Statement
Tasks with failed sessions show error icons but aren't prioritized in sort order. Users can miss critical failures when scrolling through long task lists sorted alphabetically or by date.

## Scope
**In:**
- Modify sort logic to surface "attention required" tasks first
- Consider failed sessions as primary attention indicator

**Out:**
- New sort dropdown options (use existing sort within attention groups)
- Changes to task failure detection logic
- UI redesign

## Implementation Plan

### Phase: Sort with Attention Priority
- [ ] In `task-list-sidebar.tsx`, modify `sortedTasks` logic (~line 247)
- [ ] Before applying current sort, partition tasks into: `hasFailedSession=true` vs `false`
- [ ] Apply existing sort within each partition
- [ ] Concat: attention tasks first, then rest

## Key Files
- `src/components/tasks/task-list-sidebar.tsx` - add partition-then-sort logic in `sortedTasks` useMemo

## Success Criteria
- [ ] Tasks with failed sessions appear at top regardless of sort option
- [ ] Within attention group, current sort order preserved
- [ ] No breaking changes to existing sort dropdown behavior
