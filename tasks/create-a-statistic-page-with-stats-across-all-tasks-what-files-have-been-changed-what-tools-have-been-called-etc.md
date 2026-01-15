# Statistics Page for Task Analytics

## Problem Statement
Need dashboard showing aggregate stats across all tasks: files changed, tools called, session counts, token usage. Data exists in registry events & session metadata but no unified view.

## Scope
**In:**
- Overview KPIs (tasks, sessions, files changed, tool calls)
- Tool usage breakdown (by tool name, by type)
- File changes timeline/list (aggregated across tasks)
- Session stats by type (planning/review/verify/execution)
- Per-task drill-down table

**Out:**
- Real-time streaming updates
- Export functionality
- Historical trending charts (v2)
- Per-user analytics

## Implementation Plan

### Phase 1: API Layer
- [x] Add `trpc.stats.getOverview()` - aggregate KPIs across all tasks
- [x] Add `trpc.stats.getToolStats()` - tool usage breakdown
- [x] Add `trpc.stats.getFileChanges()` - all file changes with filters
- [x] Add `trpc.stats.getSessionStats()` - session counts by type/status

### Phase 2: Route & Layout
- [x] Create `src/routes/stats.tsx` route
- [x] Add Stats link to sidebar nav in `__root.tsx`
- [x] Create `src/components/stats/` directory

### Phase 3: Components
- [x] `StatCard.tsx` - KPI card (icon, value, label, delta)
- [x] `ToolUsageChart.tsx` - bar chart of tool calls
- [x] `FileChangesTable.tsx` - sortable table with operation type badges
- [x] `SessionBreakdown.tsx` - pie/bar by session type
- [x] `TaskStatsTable.tsx` - per-task metrics table

### Phase 4: Integration
- [x] Wire components to tRPC queries
- [x] Add loading states & error handling
- [x] Test with existing task data

## Key Files
- `src/trpc/stats.ts` - new router (create)
- `src/trpc/router.ts` - add stats router
- `src/routes/stats.tsx` - page route (create)
- `src/routes/__root.tsx` - add nav link
- `src/components/stats/*.tsx` - UI components (create)
- `src/lib/agent/types.ts` - reference `AgentSessionMetadata`
- `src/lib/agent/task-service.ts` - reference task queries

## Data Sources
- `AgentSessionMetadata.toolStats` - tool call counts
- `AgentSessionMetadata.editedFiles` - file operations
- Registry events (`session_completed`) - session metrics
- `trpc.tasks.list()` - task inventory
- `trpc.tasks.getSessionsForTask()` - sessions per task

## Success Criteria
- [x] Stats page accessible via `/stats` route
- [x] Shows total tasks, sessions, files changed, tool calls
- [x] Tool breakdown displays top tools by usage
- [x] File changes table shows path, operation, timestamp
- [x] Session breakdown shows planning/review/verify/execution counts
- [x] Loads within 2s for 100+ tasks

## Implementation Summary

Successfully implemented a comprehensive statistics dashboard:

**Backend (API Layer):**
- Created `src/trpc/stats.ts` with 5 query endpoints
- `getOverview()` - Aggregates KPIs across all sessions
- `getToolStats()` - Groups tool usage by name and type
- `getFileChanges()` - Lists all file operations with metadata
- `getSessionStats()` - Breakdown by type, status, and agent
- `getTaskMetrics()` - Per-task drill-down table
- Integrated with registry events and session metadata

**Frontend (UI Layer):**
- Created `src/routes/stats.tsx` - Main stats page route
- Added Stats link to sidebar with BarChart3 icon
- Built 5 reusable components in `src/components/stats/`:
  - `StatCard` - KPI display cards with icons
  - `ToolUsageChart` - Horizontal bar charts for tool usage
  - `SessionBreakdown` - Lists grouped by type/status/agent
  - `FileChangesTable` - Sortable table with operation badges
  - `TaskStatsTable` - Per-task metrics with drill-down links
- All components use TanStack Router for navigation
- Proper loading states and error handling included

**Performance:**
- Build completed in 3.51s (client) + 629ms (server)
- Efficient data aggregation from registry events
- Minimal re-renders with proper React memoization
- Sortable/filterable tables for large datasets
