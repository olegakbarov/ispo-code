# filter and sort should be in localstorage no in query params

## Problem Statement
Filter/sort prefs in query params; noisy URLs, routing coupling.
Persist archive/sort prefs in localStorage; URLs clean, reviewFile stays in URL.

## Scope
**In:**
- localStorage-backed prefs for archiveFilter, sortBy, sortDir
- remove archive/sort from tasks route search + redirects
- update task navigation/links to stop passing archive/sort in search

**Out:**
- server-side task list filtering/sorting
- reviewFile URL param behavior
- UI redesign for filters/sort controls

## Implementation Plan

### Phase: State Persistence
- [x] Add persisted store/hook for archiveFilter, sortBy, sortDir defaults
- [x] Use prefs store in `TaskListSidebar`, drop router search usage
- [x] Update `use-task-navigation` to read prefs; search params only for reviewFile

### Phase: Routing Cleanup
- [x] Remove archive/sort from validateSearch and redirects in tasks routes
- [x] Remove archive/sort from navigate/Link search in tasks flows
- [x] Update stats/agent task links to set prefs before navigation

## Key Files
- `src/lib/stores/task-list-preferences.ts` - new persisted prefs store
- `src/components/tasks/task-list-sidebar.tsx` - read/write prefs, remove search params
- `src/lib/hooks/use-task-navigation.ts` - drop archive/sort in search params
- `src/lib/hooks/use-task-actions.ts` - remove archive/sort in navigation
- `src/lib/hooks/use-task-mutations.ts` - remove archive/sort in navigation
- `src/routes/index.tsx` - remove archive/sort from search schema/redirects
- `src/routes/tasks/index.tsx` - remove archive/sort from search schema/redirects
- `src/routes/tasks/new.tsx` - remove archive/sort from search schema
- `src/routes/tasks/$.tsx` - keep reviewFile only, drop archive/sort

## Success Criteria
- [x] Task URLs never include `archiveFilter`, `sortBy`, or `sortDir`
- [x] archive/sort prefs persist across reload via localStorage
- [x] task links still open with intended archive filter

## Unresolved Questions
- Should the text search filter persist in localStorage too?
- Should legacy query params seed localStorage once, then strip?
- Scope prefs per working dir/repo or global?
