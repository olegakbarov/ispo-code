# improve stats page. i want to know more about task done each day

<!-- autoRun: true -->

## Plan

Enhance daily stats to show more task-specific information:

- [x] Analyze current daily stats implementation
- [x] Extend `getDailyStats` API to include task completion counts
- [x] Add `tasksCompleted` field to track finished work vs created work
- [x] Enhance `DailyStatsChart` component to show completion metrics
- [x] Add session success/failure breakdown per day

## Changes Made

### API (`src/trpc/stats.ts`)

Extended `DailyStats` interface with new fields:
- `sessionsCompleted` - sessions that finished successfully per day
- `sessionsFailed` - sessions that failed per day
- `tasksCompleted` - unique tasks that had sessions complete that day

Added logic to track:
- Session task path mapping for completion attribution
- Per-day session outcome counting (success vs failure)
- Unique task completion tracking per day using Set

### UI (`src/components/stats/daily-stats-chart.tsx`)

Enhanced table to show:
- **Tasks column**: `done / new` format (green for completed, blue for created)
- **Sessions column**: `✓ / ✗` format with success/failure icons and counts
- Color-coded totals row with same formatting

## Result

The Daily Activity table now shows at a glance:
1. How many tasks were completed vs created each day
2. Session success rate per day (completed vs failed)
3. All existing metrics (tool calls, files changed, tokens)
