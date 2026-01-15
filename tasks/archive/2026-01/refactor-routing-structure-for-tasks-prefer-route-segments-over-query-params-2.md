# refactor routing structure for tasks. prefer route segments over query params

## Problem Statement
Current `/tasks`: search params for selected task + create modal. URLs noisy; deep-linking brittle; state split across search. Route segments for task selection + create flow.

## Scope
**In:**
- route segments for task selection and create (`/tasks/$` + `/tasks/new`)
- encode/decode helper for task path in URL
- update task links/navigation to route params
- legacy query redirect for `path`/`create`
**Out:**
- task data model or tRPC changes
- UI redesign of tasks page
- agent session routing changes beyond task links

## Implementation Plan

### Phase: Route Structure
- [x] Define task-path URL encoding (feeds `src/lib/utils/task-routing.ts`)
  - ✓ Verified: `encodeTaskPath` and `decodeTaskPath` defined in `src/lib/utils/task-routing.ts:16` and `src/lib/utils/task-routing.ts:24`
- [x] Convert `src/routes/tasks.tsx` to layout with `<Outlet />`
  - ✓ Verified: Layout component returns `<Outlet />` in `src/routes/tasks.tsx:15`
- [x] Add `src/routes/tasks/index.tsx`
  - ✓ Verified: Route and `TasksIndex` component defined in `src/routes/tasks/index.tsx:13` and `src/routes/tasks/index.tsx:55`
- [x] Add `src/routes/tasks/$.tsx`
  - ✓ Verified: Splat route decodes `_splat` and passes `selectedPath` to `TasksPage` in `src/routes/tasks/$.tsx:31` and `src/routes/tasks/$.tsx:53`
- [x] Add `src/routes/tasks/new.tsx`
  - ✓ Verified: `TasksPage` rendered with `createModalOpen={true}` in `src/routes/tasks/new.tsx:26`
- [x] Extract shared Tasks page component (`src/routes/tasks/_page.tsx`)
  - ✓ Verified: Shared `TasksPage` component exported in `src/routes/tasks/_page.tsx:43`

### Phase: Route State
- [x] Update `src/routes/tasks/_page.tsx` to use params, drop `search.path`/`search.create`
  - ✓ Verified: `TasksPageProps` uses `selectedPath`/`createModalOpen` and component reads props in `src/routes/tasks/_page.tsx:28` and `src/routes/tasks/_page.tsx:43`
- [x] Add legacy search redirect in `src/routes/tasks/index.tsx`
  - ✓ Verified: `beforeLoad` redirects `?path=` and `?create=1` in `src/routes/tasks/index.tsx:25` and `src/routes/tasks/index.tsx:40`

### Phase: Link Updates
- [x] Add `src/lib/utils/task-routing.ts` encode/decode helper
  - ✓ Verified: `encodeTaskPath`, `decodeTaskPath`, and `buildTaskUrl` defined in `src/lib/utils/task-routing.ts:16`, `src/lib/utils/task-routing.ts:24`, and `src/lib/utils/task-routing.ts:32`
- [x] Update `src/components/tasks/task-list-sidebar.tsx` task links
  - ✓ Verified: Selection parses with `decodeTaskPath` and navigation uses `encodeTaskPath` in `src/components/tasks/task-list-sidebar.tsx:46` and `src/components/tasks/task-list-sidebar.tsx:157`
- [x] Update `src/routes/__root.tsx` tasks nav links
  - ✓ Verified: Nav links live in the sidebar component (`src/components/layout/sidebar.tsx:75` and `src/components/layout/sidebar.tsx:80`), not in `src/routes/__root.tsx`
- [x] Update `src/components/agents/prompt-display.tsx` task link
  - ✓ Verified: Task link uses `encodeTaskPath` in `src/components/agents/prompt-display.tsx:90`
- [x] Update `src/components/agents/thread-sidebar.tsx` task link
  - ✓ Verified: Task link uses `encodeTaskPath` in `src/components/agents/thread-sidebar.tsx:106`

## Key Files
- `src/routes/tasks.tsx` - convert to layout/redirects
- `src/routes/tasks/index.tsx` - tasks list page (no selected task)
- `src/routes/tasks/$.tsx` - task route with splat param
- `src/routes/tasks/new.tsx` - create modal route
- `src/routes/tasks/_page.tsx` - shared Tasks page component
- `src/components/tasks/task-list-sidebar.tsx` - task selection links
- `src/lib/utils/task-routing.ts` - encode/decode helpers

## Success Criteria
- [x] `/tasks/<task-path>` opens correct task without `?path=...`
  - ✓ Verified: Splat route decodes the path and passes it into `TasksPage` in `src/routes/tasks/$.tsx:31` and `src/routes/tasks/$.tsx:53`
- [x] `/tasks/new` opens create modal; `?create=1` redirects to segment
  - ✓ Verified: `/tasks/new` sets `createModalOpen` in `src/routes/tasks/new.tsx:26`; legacy redirect in `src/routes/tasks/index.tsx:40`
- [x] No remaining `search.path` usage for task selection in UI
  - ✓ Verified: Only `search.path` usage is legacy redirect logic in `src/routes/tasks/index.tsx:27`

## Open Questions
- Keep list filters/sort in search params or move to segments?
  - **Decision**: Keep in search params. Filters/sort are view preferences, not resource identification.

## Verification Results

**Status: VERIFIED WITH NOTES**

- Verified all checklist items against the current code.
- Issue: `TaskListSidebar` treats `/edit` or `/review` suffixes as part of the task path, which can break selection/filter navigation on those routes. See `src/components/tasks/task-list-sidebar.tsx:44` and `src/routes/tasks/$.tsx:31`.
- Tests: `npm test` fails because no `test` script exists in `package.json`; no automated tests were run.