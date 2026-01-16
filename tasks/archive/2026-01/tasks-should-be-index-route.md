# tasks should be index route

## Problem Statement
Landing page is New Agent at `/`; tasks UI at `/tasks`.
Need tasks as default landing; keep New Agent access.

## Scope
**In:**
- Make `/` land on tasks page
- Move New Agent page to `/agents` or `/agents/new`
- Update redirects/links that point to `/`
**Out:**
- Task data or tRPC changes
- Task URL shape changes under `/tasks`
- UI redesign

## Implementation Plan

### Phase: Routing
- [x] Pick new path for New Agent page → `/agents/new`
- [x] Update `src/routes/index.tsx` to tasks landing
- [x] Update `src/routes/agents/index.tsx` to new New Agent route
- [x] Move or reuse New Agent component for new route → created `src/routes/agents/new.tsx`

### Phase: Navigation
- [x] Update sidebar brand/nav links for new landing (brand link to `/` now shows tasks - correct)
- [x] Fix any `/` redirects to preserve expected flows (updated `agents/$sessionId.tsx` links)

## Key Files
- `src/routes/index.tsx` - root route switch to tasks
- `src/routes/agents/index.tsx` - New Agent landing route
- `src/routes/agents/new.tsx` - New Agent page (new file)
- `src/routes/agents.tsx` - agents layout for nested route
- `src/routes/tasks/index.tsx` - tasks landing behavior
- `src/components/layout/sidebar.tsx` - brand/nav links

## Success Criteria
- [x] `/` shows tasks page
- [x] New Agent page reachable at new route (`/agents/new`)
- [x] `/agents/` and `/tasks` still work

## Resolved Questions
- `/` renders TasksPage directly (no redirect) - cleaner URL
- New Agent path: `/agents/new` - consistent with existing pattern

## Implementation Notes
- `src/routes/index.tsx`: Now renders TasksPage component directly, includes search param handling for filters
- `src/routes/agents/new.tsx`: Created with full New Agent form (copied from old index.tsx)
- `src/routes/agents/index.tsx`: Redirects to `/agents/new`
- `src/routes/agents/$sessionId.tsx`: Updated "Return to dashboard" links to say "Return to tasks"
- Build passes successfully
