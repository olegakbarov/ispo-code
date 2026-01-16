# we need 0ms latency on creating new task.

## Problem Statement
Instant task create UX; no wait after Create.
Avoid blocking on server path/IO; keep list + editor in sync.

## Scope
**In:**
- Optimistic path generation + immediate navigation
- Seed task list + task content caches for new task
- Reconcile optimistic path with server result, rollback on error

**Out:**
- Backend filesystem performance tuning
- Agent execution latency after create
- UI redesign beyond create flow

## Implementation Plan

### Phase: Optimistic Create
- [x] Add shared slugify helper for client/server parity (`src/lib/utils/slugify.ts`)
- [x] Compute optimistic path from cached tasks in `src/lib/hooks/use-task-actions.ts`
- [x] Navigate immediately to optimistic path on create trigger
- [x] Seed `tasks.list` cache with optimistic task entry in `src/lib/hooks/use-task-mutations.ts`
- [x] Seed `tasks.get` cache with optimistic task content in `src/lib/hooks/use-task-mutations.ts`

### Phase: Reconcile + Guards
- [x] Replace optimistic cache entries with server path on create success
- [x] Redirect route if server path differs from optimistic path
- [x] Roll back optimistic cache entries on create error
- [x] Skip `use-task-refresh` fetch while optimistic content cached
- [ ] Add tests for optimistic create + reconciliation (`src/lib/hooks/__tests__/use-task-actions.test.ts`)

## Key Files
- `src/lib/agent/task-service.ts` - reuse shared slugify for path generation
- `src/lib/utils/slugify.ts` - shared slugify helper (new)
- `src/lib/hooks/use-task-actions.ts` - optimistic path + immediate navigation
- `src/lib/hooks/use-task-mutations.ts` - cache seeding and reconciliation
- `src/lib/hooks/use-task-refresh.ts` - guard fetch errors for optimistic tasks
- `src/lib/hooks/__tests__/use-task-actions.test.ts` - optimistic create coverage

## Success Criteria
- [x] Create click -> task visible in list + editor without network wait
- [x] No "Failed to load task" flash during optimistic create
- [x] Final path matches server or auto-redirects within one response

## Unresolved Questions
- Should 0ms apply to create-with-agent and debug-with-agents flows?
  - **Decision**: No, these flows navigate to agent session page immediately, so task editor latency not relevant
- Accept optimistic path collision redirect, or block when slug exists?
  - **Decision**: Accept redirect - optimistic path generation handles collisions same as server

## Implementation Notes

### Shared Slugify Utility
Created `src/lib/utils/slugify.ts` with:
- `slugifyTitle()` - basic slug generation (matches server logic)
- `generateShortSlug()` - smart slug with stopwords filtering
- `generateOptimisticTaskPath()` - path generation with collision detection

Updated `task-service.ts` to import and re-export for backward compatibility.

### Optimistic Cache Seeding
In `use-task-mutations.ts` `createMutation`:
- Generate optimistic path using task list for collision detection
- Seed `tasks.list` cache with optimistic task entry
- Seed `tasks.get` cache with optimistic content (3 checkboxes)
- On success: redirect if server path differs, invalidate to get fresh data
- On error: roll back both cache entries

### Immediate Navigation
In `use-task-actions.ts` `handleCreate`:
- Generate optimistic path from current task list
- Navigate immediately (0ms) for basic create
- Fire mutation in background (fire-and-forget)
- Agent flows skip immediate navigation (go to agent session instead)

### Cache-First Loading
In `use-task-refresh.ts`:
- Check for cached optimistic data before fetching
- Use cached content immediately if available
- Fall back to server fetch only if cache miss
- Prevents "Failed to load task" flash during optimistic create
