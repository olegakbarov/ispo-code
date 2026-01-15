# stats route: we need to show files with highest change traffic and more details on all tool calls

## Problem Statement
Current stats page shows flat list of file changes (one row per operation). Need aggregated view showing files with most edit activity across sessions. Tool call display lacks detail—only shows totals and top 10 tools, no arguments/results/timestamps.

## Scope
**In:**
- New "Hot Files" section: files ranked by edit frequency
- Expandable tool call details: arguments, timestamps, sessions
- Per-tool breakdown with success/failure rates (if available)
- Drill-down from file to sessions that modified it

**Out:**
- Tool execution time tracking (requires metadata-analyzer changes)
- Tool result content capture (storage concerns)
- Real-time tool call streaming

## Implementation Plan

### Phase 1: Backend - Hot Files Aggregation
- [x] Add `getHotFiles` endpoint to `src/trpc/stats.ts`
  - Verified: `getHotFiles` procedure defined in `src/trpc/stats.ts:486`.
- [x] Aggregate file changes by path across sessions
  - Verified: aggregation map and event loop in `src/trpc/stats.ts:505`.
- [x] Include: edit count, last modified, operation breakdown, sessions list
  - Verified: `hotFiles.push` includes edit count, last modified, ops, sessions in `src/trpc/stats.ts:560`.
- [x] Sort by total modifications descending
  - Verified: `hotFiles.sort` by `editCount` descending in `src/trpc/stats.ts:569`.

### Phase 2: Backend - Enhanced Tool Stats
- [x] Add `getToolCallDetails` endpoint to `src/trpc/stats.ts`
  - Verified: `getToolCallDetails` procedure defined in `src/trpc/stats.ts:578`.
- [x] Return per-tool: call count, sessions used, first/last used timestamps
  - Verified: `ToolCallDetails` rows include calls, sessions, first/last used in `src/trpc/stats.ts:644`.
- [ ] Include tool arguments preview (from metadata if stored)
  - Not found: `ToolCallDetails` has no argument fields in `src/trpc/stats.ts:99` and UI renders only timestamps/sessions in `src/components/stats/tool-usage-chart.tsx:138`.
- [ ] Add optional `bySession` param for filtering (deferred - not needed for initial version)

### Phase 3: UI - Hot Files Component
- [x] Create `src/components/stats/hot-files-table.tsx`
  - Verified: `HotFilesTable` component exists in `src/components/stats/hot-files-table.tsx:34`.
- [x] Show: file path, edit count, operation breakdown, linked sessions
  - Verified: row renders path/count/ops and session links in `src/components/stats/hot-files-table.tsx:173`.
- [x] Sortable columns: path, count, last modified
  - Verified: sort state and header buttons for all columns in `src/components/stats/hot-files-table.tsx:31` and `src/components/stats/hot-files-table.tsx:121`.
- [x] Click row → expand to show session list that touched file
  - Verified: row click toggles session list expansion in `src/components/stats/hot-files-table.tsx:161` and `src/components/stats/hot-files-table.tsx:197`.

### Phase 4: UI - Enhanced Tool Usage
- [x] Extend `tool-usage-chart.tsx` with expandable rows
  - Verified: expanded state and detail panel in `src/components/stats/tool-usage-chart.tsx:35` and `src/components/stats/tool-usage-chart.tsx:138`.
- [x] Add click handler on tool name → expand details
  - Verified: tool row click toggles expansion in `src/components/stats/tool-usage-chart.tsx:109`.
- [x] Show: session breakdown, timeline of usage (first/last used timestamps)
  - Verified: timestamps and session list rendered in `src/components/stats/tool-usage-chart.tsx:140`.
- [ ] Add filter: by session type, by agent type (deferred - can be added later if needed)

### Phase 5: Integration
- [x] Add new sections to `src/routes/stats.tsx`
  - Verified: Tool Usage and Hot Files sections rendered in `src/routes/stats.tsx:92`.
- [x] Add tRPC queries for new endpoints
  - Verified: `getToolCallDetails` and `getHotFiles` queries in `src/routes/stats.tsx:26` and `src/routes/stats.tsx:27`.
- [ ] Add navigation tabs: Overview | Hot Files | Tools | Sessions (deferred - single page is cleaner for now)

## Key Files
- `src/trpc/stats.ts` - new endpoints: `getHotFiles`, `getToolCallDetails`
- `src/components/stats/hot-files-table.tsx` - new component
- `src/components/stats/tool-usage-chart.tsx` - add expandable details
- `src/routes/stats.tsx` - integrate new sections/tabs
- `src/lib/agent/metadata-analyzer.ts` - check if more data needed

## Success Criteria
- [x] Can identify top 10 most-modified files at a glance
  - Verified: default sort by edit count desc and initial limit in `src/components/stats/hot-files-table.tsx:35` and `src/components/stats/hot-files-table.tsx:77`.
- [x] Can drill from file → list of sessions that modified it
  - Verified: expanded rows list sessions with links in `src/components/stats/hot-files-table.tsx:197`.
- [x] Can see per-tool usage breakdown with session context
  - Verified: tool detail data and session list expansion in `src/components/stats/tool-usage-chart.tsx:96` and `src/trpc/stats.ts:578`.
- [x] Tool details show more than just counts (timestamps, sessions)
  - Verified: first/last used timestamps and sessions shown in `src/components/stats/tool-usage-chart.tsx:140`.

## Implementation Notes
- Hot Files aggregation works by tracking all file edits across sessions via metadata.editedFiles
- Tool Call Details tracks sessions that used each tool with timestamps from session completion events
- Both components support expandable rows for drill-down (click to see session details)
- TypeScript interfaces added for HotFile and ToolCallDetails types in stats.ts
- Components follow existing patterns (sortable tables, expandable rows like FileChangesTable)

## Verification Results
- Tests: `npm run test:run` failed (518 failed, 1590 failed); failures include missing module `./cerebras` and assertion errors in `.agentz/worktrees/fa124acc375b/src/lib/agent/manager.test.ts`.
- Warning: route file `src/routes/tasks/_page.tsx` missing `Route` export reported during `vitest run`.
- Incomplete: tool arguments preview not implemented in API or UI (see unchecked item).