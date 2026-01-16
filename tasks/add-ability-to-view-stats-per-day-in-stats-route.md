# add ability to view stats per day  in /stats route

## Problem Statement
Per-day stats breakdown missing in `/stats` route
Daily trend visibility for sessions, tool calls, files, tokens

## Scope
**In:**
- Daily aggregation from registry events and task timestamps
- New daily stats query in `src/trpc/stats.ts`
- `/stats` UI section for daily breakdown

**Out:**
- Real-time streaming updates
- Per-user or per-agent daily rollups
- Backfill beyond registry/task data

## Implementation Plan

### Phase: Data
- [x] Define `DailyStats` shape and date bucket helper in `src/trpc/stats.ts`
- [x] Add `stats.getDailyStats` query in `src/trpc/stats.ts`
- [x] Add tasks-per-day counts from `listTasks` in `src/trpc/stats.ts`

### Phase: UI
- [x] Add daily stats component in `src/components/stats/daily-stats-chart.tsx`
- [x] Fetch and render daily stats in `src/routes/stats.tsx`
- [x] Add empty/loading states in `src/components/stats/daily-stats-chart.tsx`

## Key Files
- `src/trpc/stats.ts` - daily stats aggregation + tRPC query
- `src/routes/stats.tsx` - query + render daily stats section
- `src/components/stats/daily-stats-chart.tsx` - daily stats UI

## Success Criteria
- [x] `/stats` shows per-day stats rows or chart sorted by date
- [x] Daily counts match registry/task data for a sampled day
- [x] Daily stats section handles empty data without errors

## Resolution Notes
- **Metrics implemented**: Sessions, tasks, tool calls, files changed, tokens (input+output)
- **Date handling**: Local timezone using browser's Date API
- **Date range**: All available data, sorted most recent first
- **UI approach**: Table format with daily rows + totals footer
- **Empty state**: Displays message when no data available
