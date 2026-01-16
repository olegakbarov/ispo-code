# move worktrees, stats and tool call pages to settings

## Problem Statement
Top-level pages for Worktrees, Stats, Tool Calls. Need move under Settings for consolidated admin views and cleaner sidebar.

## Scope
**In:**
- Move routes to `/settings/worktrees`, `/settings/stats`, `/settings/tool-calls`
- Update Settings nav to link new subpages
- Remove sidebar footer links for these pages
- Redirect old routes to new paths

**Out:**
- Backend data or query changes for stats/worktrees/tool calls
- UI redesign of existing page content
- Auth or access control changes

## Implementation Plan

### Phase: Settings Routing
- [x] Convert `src/routes/settings.tsx` to layout route with `Outlet`
- [x] Move Settings page UI into `src/routes/settings/index.tsx`
- [x] Move Worktrees route into `src/routes/settings/worktrees.tsx`
- [x] Move Stats route into `src/routes/settings/stats.tsx`
- [x] Move Tool Calls route into `src/routes/settings/tool-calls.tsx`

### Phase: Navigation + Legacy Routes
- [x] Add settings subnav links in `src/routes/settings.tsx`
- [x] Remove Worktrees/Stats/Tool Calls links from `src/components/layout/sidebar.tsx`
- [x] Add redirect in `src/routes/worktrees.tsx` to `/settings/worktrees`
- [x] Add redirect in `src/routes/stats.tsx` to `/settings/stats`
- [x] Add redirect in `src/routes/tool-calls.tsx` to `/settings/tool-calls`

## Key Files
- `src/routes/settings.tsx` - layout + settings subnav
- `src/routes/settings/index.tsx` - settings main page
- `src/routes/settings/worktrees.tsx` - worktrees page route
- `src/routes/settings/stats.tsx` - stats page route
- `src/routes/settings/tool-calls.tsx` - tool calls gallery route
- `src/components/layout/sidebar.tsx` - remove footer links
- `src/routes/worktrees.tsx` - redirect to settings worktrees
- `src/routes/stats.tsx` - redirect to settings stats
- `src/routes/tool-calls.tsx` - redirect to settings tool calls

## Success Criteria
- [x] `/settings/worktrees` renders worktree selector
- [x] `/settings/stats` renders stats dashboard
- [x] `/settings/tool-calls` renders tool call gallery
- [x] Sidebar footer no longer shows Worktrees/Stats/Tool Calls
- [x] `/worktrees`, `/stats`, `/tool-calls` redirect to settings

## Notes
- TypeScript errors for redirect routes are expected and will resolve after route tree regeneration
- The new routes follow TanStack Router conventions with layout/outlet pattern
