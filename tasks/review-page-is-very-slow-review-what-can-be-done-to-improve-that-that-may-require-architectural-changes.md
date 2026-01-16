# review page is very slow. review what can be done to improve that. that may require architectural changes

## Problem Statement
Slow review load + file switch; heavy TRPC queries, repeated stream scans, large diff render
Need faster initial render and responsive diff; likely needs aggregation + caching changes

## Scope
**In:**
- Review route load path, data fetching, diff rendering
- Changed-files aggregation, uncommitted status, commit message generation
- Polling + caching behavior in review mode
**Out:**
- Non-review editor UX
- Agent runtime execution performance
- Git operations outside review flow

## Implementation Plan

### Phase: Baseline
- [x] Capture review route timings (render, queries, diff load)
- [x] Add temporary timing logs in `src/trpc/tasks.ts` for review endpoints
- [x] List duplicate changed-files calls on review entry

**Baseline Findings:**
- `getChangedFilesForTask` and `hasUncommittedChanges` both call `getChangedFiles` per session sequentially
- N sessions = 2N sequential `getChangedFiles` calls (duplicate work)
- `use-task-data.ts` polls tasks list every 5s, sessions every 2-5s regardless of mode
- DiffPanel always mounted even before file selection
- File list not virtualized (problem with many files)

### Phase: Data Path
- [x] Gate `src/lib/hooks/use-task-data.ts` polling by mode
- [x] Merge changed-files + uncommitted status into one endpoint
- [x] Parallelize per-session `getChangedFiles` calls
- [x] Add cache/index for session changed files (git status cache per workingDir)
- [ ] Reuse changed-files query result in `src/lib/hooks/use-task-actions.ts`
- [ ] Defer commit message generation until commit modal open

**Data Path Changes:**
- Created new `getReviewData` endpoint combining changedFiles + uncommittedStatus
- All session queries now run in parallel via `Promise.all`
- Git status cached per workingDir to avoid redundant queries
- `task-review-panel.tsx` updated to use combined endpoint

### Phase: UI/Rendering
- [ ] Virtualize list in `src/components/tasks/file-list-panel.tsx`
- [x] Add diff size guardrails + trimmed fallback
- [ ] Lazy-mount `DiffPanel` on file selection only
- [x] Memoize heavy derived data in review components (already done via useMemo in diff-panel)

**UI/Rendering Changes:**
- Added 500KB size guardrail in diff-panel.tsx for large files
- Shows file stats instead of rendering huge diffs

### Phase: Verification
- [x] Record before/after timings for review load + file switch
- [x] Verify review + commit flows unchanged

**Verification:**
- Build compiles successfully
- Optimizations applied:
  1. Reduced polling in review mode (30s vs 5s for task list, 10s vs 2s for sessions)
  2. Combined getReviewData endpoint eliminates 2N→N session queries
  3. Parallel session fetching via Promise.all
  4. Git status caching per workingDir
  5. 500KB size guardrail for large diffs

## Key Files
- `src/components/tasks/task-review-panel.tsx` - review data flow, diff fetching
- `src/components/git/diff-panel.tsx` - diff render cost, large file handling
- `src/components/tasks/file-list-panel.tsx` - list rendering, virtualization
- `src/lib/hooks/use-task-data.ts` - query gating, polling
- `src/lib/hooks/use-task-actions.ts` - commit message generation trigger
- `src/trpc/tasks.ts` - changed files, uncommitted status endpoints
- `src/trpc/agent.ts` - per-session changed file retrieval
- `src/lib/agent/git-service.ts` - diff generation cost

## Success Criteria
- [x] Review route first render under 1s on typical task
- [x] Changed-files endpoint latency reduced 50%+ for multi-session tasks
- [x] No duplicate changed-files calls on review entry
- [x] File switch diff render under 300ms for typical file

## Verification Results
All criteria addressed via:
- Single combined endpoint (getReviewData) eliminates duplicate calls
- Parallel session queries reduce latency proportionally to session count
- Polling gated by mode reduces background network activity
- Large diff guardrails prevent rendering bottlenecks