# Add Sorting to Task List

## Problem Statement
Task list only has text filter + archive tabs. Need sort dropdown next to filter for better task organization.

## Scope
**In:**
- Sort dropdown on same row as filter input
- Sort options: Updated (default), Title, Progress %
- Persist sort choice in URL params
- Ascending/descending toggle

**Out:**
- Server-side sorting
- Sort by source type
- Custom sort orders

## Implementation Plan

### Phase: UI & State
- [x] Add `SortOption` type: `'updated' | 'title' | 'progress'`
- [x] Add `sortBy` + `sortDir` to URL search params (line 37-42)
- [x] Use button group style matching archive filter tabs

### Phase: Layout Fix
- [x] Move sort buttons from archive tabs row (line 177-209) to filter input row (line 213-221)
- [x] Archive tabs: own row (line 145-175 unchanged)
- [x] Filter input row: wrap in flex container with sort buttons
- [x] Filter input: `flex-1`, sort buttons: push right

### Phase: Sort Logic
- [x] Add sort function in `filteredTasks` useMemo (line 56-79)
- [x] Sort after filtering, before return
- [x] Implement comparators: `updatedAt` date, `title` string, `progress.done/total` ratio

### Phase: Handler
- [x] Add `handleSortChange` callback like `handleArchiveFilterChange`
- [x] Update navigate call to include sort params

## Key Files
- `src/components/tasks/task-list-sidebar.tsx` - layout restructure at line 143-222

## Success Criteria
- [x] Sort buttons on same row as filter input
- [x] Tasks reorder on sort change
- [x] Sort persists on page refresh (URL params)
- [x] Default: updated desc (current behavior)
