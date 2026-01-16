# improve stats route. add more useful stats

## Problem Statement
Stats page shows totals only; limited efficiency/quality insight.
Missing token cost, duration, success rate, context pressure.

## Scope
**In:**
- Aggregate session efficiency metrics from registry metadata
- Surface new KPIs on stats page
- Add session/output metrics section
**Out:**
- Changes to metadata capture pipeline
- Stats page redesign
- New storage/backfill jobs

## Implementation Plan

### Phase: Data
- [x] Define new overview fields in `src/trpc/stats.ts`
- [x] Aggregate duration and success rate in `src/trpc/stats.ts`
- [x] Aggregate token, context, message/output metrics in `src/trpc/stats.ts`
- [x] Expose new payload via `getOverview` or new endpoint in `src/trpc/stats.ts`

### Phase: UI
- [x] Add KPI cards for new overview fields in `src/routes/stats.tsx`
- [x] Add session/output metrics component in `src/components/stats/session-metrics.tsx`
- [x] Wire new query and render section in `src/routes/stats.tsx`

## Key Files
- `src/trpc/stats.ts` - add aggregates, payloads
- `src/routes/stats.tsx` - fetch + render new stats
- `src/components/stats/session-metrics.tsx` - new UI for session/output metrics
- `src/components/stats/stat-card.tsx` - reuse for new KPI cards

## Success Criteria
- [x] KPI row includes tokens, success rate, avg duration, avg context use
- [x] New section shows message/output metrics with per-session averages
- [x] Stats page renders with new stats and no runtime errors

## Unresolved Questions
- Preferred KPIs: tokens, duration, success rate, context use, output metrics?
- Averages: mean, median, or both?
- Need time window filters (7/30/all)?

## Implementation Notes
- Added 6 new fields to `StatsOverview` interface: `successRate`, `avgDurationMs`, `avgContextUtilization`, `avgOutputTokens`, `totalMessages`, `avgMessagesPerSession`
- Updated `getOverview` query to aggregate duration, context utilization, output tokens, and messages from session metadata
- Added second row of KPI cards showing efficiency metrics
- Created new `SessionMetrics` component with detailed token/message breakdowns
- Modified `StatCard` to accept string values for formatted percentages/durations
- Pre-existing TypeScript errors in unrelated files (mcporter tests, cli-runner, etc.) - not introduced by this change
