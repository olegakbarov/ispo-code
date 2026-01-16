# when we on review route the task should still be highlighted in sidebar

## Problem Statement
Sidebar active state derived from pathname decode. `/tasks/<encoded>/review` parsed as task path including `/review`, mismatch. Result: task not highlighted while in review mode.

## Scope
**In:**
- Sidebar selected task parsing for `/tasks/*` routes
- Mode suffix handling (`/edit`, `/review`, `/debate`)
- Shared task-route parsing helper if needed
**Out:**
- Task editor logic
- Task list rendering/design
- Router config changes beyond parsing

## Implementation Plan

### Phase: Route Parse
- [x] Add helper to strip mode suffix from splat before decode
- [x] Use helper in `TaskListSidebar` selectedPath logic

### Phase: Validate
- [x] Confirm highlight on `/tasks/<encoded>/review`
- [x] Confirm highlight on `/tasks/<encoded>/edit` and `/tasks/<encoded>/debate`

## Key Files
- `src/components/tasks/task-list-sidebar.tsx` - selectedPath parsing (updated line 185)
- `src/lib/utils/task-routing.ts` - shared parse helper (added stripModeSuffix function)
- `src/routes/tasks/$.tsx` - current splat mode parsing (reference for logic)

## Success Criteria
- [x] Sidebar highlights active task on review route
- [x] Sidebar highlights active task on edit and debate routes

## Implementation Notes
- Created `stripModeSuffix()` helper in `task-routing.ts` to handle `/edit`, `/review`, `/debate` suffixes
- Updated sidebar's `selectedPath` logic to strip mode suffix before decoding task path
- Logic now matches the pattern already used in `$.tsx:extractModeFromSplat`

## Unresolved Questions
- None
