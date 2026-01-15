# Dedupe Agent Session Polling

**Priority**: High
**Category**: Performance
**Status**: Implemented

## Implementation Notes (2026-01-15)

### Completed

- [x] Fetch `getSessionWithMetadata` once at page level in `$sessionId.tsx`
  - ✓ Verified: `trpc.agent.getSessionWithMetadata.useQuery` is defined at the page level in `src/routes/agents/$sessionId.tsx:59`
- [x] Pass session data as props to `ThreadSidebar` and `GitSection`
  - ✓ Verified: `ThreadSidebar` receives `session` prop in `src/routes/agents/$sessionId.tsx:671` and passes it to `GitSection` in `src/components/agents/thread-sidebar.tsx:139`
- [x] Remove independent polling from `ThreadSidebar`
  - ✓ Verified: `ThreadSidebar` is driven by props and has no `getSessionWithMetadata` query in `src/components/agents/thread-sidebar.tsx:39`
- [x] Remove `trpc.agent.get` call from `GitSection`
  - ✓ Verified: `GitSection` uses `session` prop and only calls git/status/diff and `agent.getChangedFiles` in `src/components/agents/thread-sidebar.tsx:171`
- [x] Implement adaptive polling with exponential backoff (2s base, 30s max)
  - ✓ Verified: `refetchInterval` implements 2s base and 30s max backoff in `src/routes/agents/$sessionId.tsx:65`
- [x] Add error handling for fetch failures with retry button
  - ✓ Verified: `fetchError` branch shows error UI with Retry button in `src/routes/agents/$sessionId.tsx:388`
- [x] Update mutation invalidations to use `getSessionWithMetadata`
  - ✓ Verified: mutations invalidate `getSessionWithMetadata` in `src/routes/agents/$sessionId.tsx:266`

### Architecture Changes

**Before (duplicate polling):**
- `$sessionId.tsx`: `trpc.agent.get` every 1s
- `ThreadSidebar`: `trpc.agent.getSessionWithMetadata` every 2s
- `GitSection`: `trpc.agent.get` (no interval, but called on every render)

**After (single source of truth):**
- `$sessionId.tsx`: `trpc.agent.getSessionWithMetadata` with adaptive polling
- `ThreadSidebar`: Receives session data via props
- `GitSection`: Receives session data via props

**Polling Strategy:**
- Active sessions (pending/running/working/waiting): 2s fixed interval
- Idle sessions: Exponential backoff (2s → 3s → 4.5s → ... → 30s max)
- Terminal sessions (completed/failed/cancelled): Polling disabled

### Files Modified

- `src/routes/agents/$sessionId.tsx` - Single fetch, adaptive polling, error handling
- `src/components/agents/thread-sidebar.tsx` - Props-based session data
- `src/lib/hooks/use-adaptive-polling.ts` - New hook (not used inline, but utility exported)

### Deferred Items

- [ ] ETags for `getSessionWithMetadata` endpoint (requires server-side changes)
- [ ] Distributed cache (Redis) for scalability
- [ ] Pub/Sub for background update notifications
- [ ] Session data size monitoring/pagination

## Problem

`src/routes/agents/$sessionId.tsx` polls `trpc.agent.get` every 1s (lines 41-49). `src/components/agents/thread-sidebar.tsx` independently polls `trpc.agent.getSessionWithMetadata` every 2s (lines 46-51) and also calls `trpc.agent.get` inside `GitSection` (line 178). This duplicates fetches and cache updates for the same session data.

## Impact

- Extra network traffic and CPU from duplicate polling
- More cache writes and re-renders than necessary
- Harder to reason about data freshness across the page
- Potential N+1 query problem in `GitSection`

## Fix

We will pursue the following solution, prioritizing option 1 initially, with a fallback to option 2 if option 1 proves infeasible after initial investigation:

**Option 1: Fetch session data once at the page level and pass it into `ThreadSidebar`/`GitSection`**

1.  Modify `src/routes/agents/$sessionId.tsx` to fetch `trpc.agent.getSessionWithMetadata` once at the page level. This will become the single source of truth for session data.
2.  Pass the fetched session data as props to both `ThreadSidebar` and `GitSection`.
3.  Remove the independent polling of `trpc.agent.getSessionWithMetadata` from `ThreadSidebar`.
4.  Remove the direct call to `trpc.agent.get` from `GitSection`.
5. Implement ETags for the `getSessionWithMetadata` endpoint. Include the ETag in the response headers and configure the client to send the ETag in subsequent requests to avoid transferring the entire payload when the data hasn't changed.
6.  Implement proper error handling to gracefully handle initial fetch failures (see Error/Edge Case Considerations).

*Implementation Details:*

*   The session data will be passed as a plain JavaScript object.
*   React Context will *not* be used due to potential performance issues associated with unnecessary re-renders of consumers.
*   Consider using `useMemo` in the parent component to memoize the session data being passed as props, preventing unnecessary re-renders of child components.

*Effort Estimate*: 3 days

**Option 2: Expand `getSessionWithMetadata` to include worktree fields so `GitSection` doesn't need `trpc.agent.get`**

1.  Modify the `getSessionWithMetadata` trpc endpoint to include the necessary worktree data currently fetched by `trpc.agent.get` within `GitSection`.  Specifically, investigate the query pattern in `GitSection` to identify all required data. If it is an N+1, refactor the query to fetch data in a single call, or consider using a dataloader pattern.
2.  Update the TRPC schema and implementation to include the new fields.
3.  Remove the direct call to `trpc.agent.get` from `GitSection`.

*Implementation Details:*

*   Ensure backwards compatibility when expanding `getSessionWithMetadata` by adding new fields instead of modifying existing ones.
*   Optimize the database query for `getSessionWithMetadata` to avoid performance regressions due to the increased data being fetched. Before implementation, conduct a thorough query analysis using database profiling tools. Analyze the existing query execution plan and the potential impact of adding worktree fields. Consider alternative data modeling strategies or caching mechanisms to mitigate performance risks if complex joins are required. Ensure proper indexing on worktree-related tables to optimize performance.

*Effort Estimate*: 5 days

**Shared Steps (Regardless of Option Chosen):**

1.  Align polling intervals in `src/routes/agents/$sessionId.tsx` and any remaining polling in child components to a single, consistent interval (recommend 5 seconds initially, subject to adaptive polling implementation below).
2.  Reuse the same TRPC query key across the page to ensure proper cache sharing.
3.  Implement adaptive polling or throttling. Reduce polling frequency when the session data is unchanged for a period of time.  Start with a simple exponential backoff strategy, increasing the polling interval up to a maximum (e.g., from 5 seconds to a configurable maximum, default 30 seconds).
4. Implement a mechanism to prevent cache stampedes, such as probabilistic early expiry (staggering the TTL expiry) or a locking mechanism to ensure only one client fetches the data when the cache expires. Consider using stale-while-revalidate to serve stale data while refreshing in the background.
5.  Evaluate session data size.  If the size becomes a bottleneck (exceeds 1MB), implement pagination, filtering, or transferring delta changes.
6.  Implement a caching strategy with appropriate TTLs. Initially, use a TTL of 10 seconds. Monitor cache churn and adjust the TTL accordingly. Consider using a distributed cache (e.g., Redis) for scalability in the future.

## Files

- `src/routes/agents/$sessionId.tsx`
- `src/components/agents/thread-sidebar.tsx`

## Acceptance Criteria

The deduplication will be considered successful when the following criteria are met:

1.  **Reduced Network Traffic:** A reduction of at least 50% in the number of calls to `trpc.agent.get` and `trpc.agent.getSessionWithMetadata` from the client, as measured using browser developer tools (Network tab) and server-side request logging.
2.  **Reduced CPU Usage:** A measurable reduction in CPU usage on the client-side, particularly during the polling intervals, as measured using browser developer tools (Performance tab). Aim for a 10% reduction initially.
3.  **Reduced Re-renders:** A reduction in the number of re-renders of `ThreadSidebar` and `GitSection`, as measured using the React Profiler or similar tools.  Target a reduction of at least 30%.
4.  **Data Consistency:** No regressions in data freshness or consistency. The UI must reflect the latest session data within an acceptable delay (no more than 2x the polling interval). See Data Consistency Validation Plan below. If stale data is detected beyond the acceptable delay, the UI should display a "refresh" button and log the incident.
5.  **No Functional Regressions**: All existing functionality related to agent sessions remains working as expected, including agent actions, git operations, and UI updates.

## Success Metrics

The success of this deduplication effort will be measured using the following metrics:

1.  **Network Call Reduction:** Percentage reduction in the number of calls to `trpc.agent.get` and `trpc.agent.getSessionWithMetadata` after the change, measured over a 24-hour period.
    *   Tool: Browser developer tools (Network tab) - Filter by `trpc.agent.get` and `trpc.agent.getSessionWithMetadata` to count requests., Server-side request logging.
2.  **CPU Usage Reduction:** Percentage reduction in CPU usage during agent session interactions, measured using browser developer tools (Performance tab) and server-side monitoring tools (e.g., New Relic, Datadog).
    *   Tool: Browser developer tools (Performance tab), Server-side monitoring tools.
3.  **Re-render Reduction:** Percentage reduction in the number of re-renders of `ThreadSidebar` and `GitSection` components, measured using the React Profiler.
    *   Tool: React Profiler.
4.  **Average Session Data Size:** Measure the average size of the session data being transferred to identify potential bottlenecks.
    *   Tool: Browser developer tools (Network tab), Server-side request logging.
5.  **Polling Interval Distribution:** Track the distribution of polling intervals when adaptive polling is implemented.
    *   Tool: Client-side logging.
6.  **Cache Hit Rate:** Percentage of requests served from the client-side cache.
    *   Tool: Client-side logging, Server-side monitoring (if applicable).

Target: Achieve at least 50% reduction in network calls and 10% reduction in CPU usage without introducing data staleness or functional regressions.

## Caching Strategy

1.  **Client-Side Cache:** Utilize the TRPC client-side cache to store session data. Minimum supported TRPC version: v10.43.6. Be aware of potential compatibility issues with future TRPC upgrades.
2.  **TTL:** Set an initial TTL of 10 seconds for cached session data. Monitor cache hit rates and adjust the TTL accordingly.
3.  **Invalidation:** Rely on TRPC's automatic cache invalidation when mutations related to agent sessions occur. The following TRPC mutations invalidate the cache for agent sessions: `agent.updateSession`, `agent.createSession`, `agent.deleteSession`.
    For session data modified outside TRPC mutations (e.g., background processes), implement a pub/sub system (e.g., Redis Pub/Sub) to broadcast invalidation events to clients, or implement a periodic cache refresh mechanism in conjunction with a 'last updated' timestamp on the session data.

    *   **Pub/Sub Implementation:** Use Redis Pub/Sub. The message format will be JSON, containing the session ID and a timestamp of the update. Example: `{"sessionId": "123e4567-e89b-12d3-a456-426614174000", "updatedAt": "2024-10-27T10:00:00Z"}`. If the Pub/Sub system fails, log the error and attempt to refresh the cache using the periodic refresh mechanism. The event will be 'session.updated' and the granularity of invalidation will be specific to the session ID included in the message.
    *   **Periodic Refresh Mechanism:** If the pub/sub mechanism fails or is not implemented, a periodic cache refresh will be performed every 60 seconds. This refresh will compare the 'lastUpdated' timestamp on the client with the server-side timestamp. If the server-side timestamp is newer, the cache will be refreshed.
4.  **Cache Stampede Mitigation:** Implement probabilistic early expiry to prevent cache stampedes. When setting the TTL, introduce a small random jitter (e.g., +/- 10%) to stagger the cache expiry times across clients.
5.  **Future Consideration:** Explore using a distributed cache (e.g., Redis) for scalability and improved cache consistency across multiple clients.

## Data Consistency Validation Plan

The following test scenarios will be used to validate data consistency:

1.  **Normal Operation:** Verify that the UI reflects the latest session data within 2x the polling interval under normal network conditions.
2.  **Slow Network Simulation:** Simulate a slow network connection (e.g., using Chrome DevTools network throttling) and verify that the UI eventually reflects the latest session data, even with delayed updates.
3.  **Concurrent Updates:** Simulate concurrent updates to the session data from different sources (e.g., two users modifying the same session simultaneously, or a background process updating the session). Verify that the UI converges to a consistent state and that no updates are lost.
4.  **Background Updates:** Update the session data via a background process. Verify that the UI reflects the changes within an acceptable timeframe.
5.  **Cache Invalidation Testing:** Verify that the client-side cache is properly invalidated when session data is modified outside the context of TRPC mutations (e.g., using the pub/sub system or periodic refresh mechanism). Simulate scenarios where the data is updated in the database directly and confirm that the UI updates accordingly.
6.  **Stale Data Detection:** Artificially introduce stale data in the client-side cache (e.g., by manually modifying the cached data in the browser's local storage). Verify that the application detects the stale data and triggers a cache refresh.

Expected Outcomes:

*   Under normal operation, the UI should reflect the latest data within the expected polling interval.
*   Under slow network conditions, the UI should eventually converge to the latest data, and the user should be informed of the delay.
*   Concurrent updates should be handled gracefully, and the UI should reflect the final state of the session data.
*   Cache invalidation should occur promptly when data is modified externally, ensuring data consistency.
*   If stale data is detected beyond the acceptable delay (2x polling interval), the UI should display a "refresh" button, log the incident with details including session ID and timestamps, and automatically attempt a cache refresh.

## Error/Edge Case Considerations

1.  **Initial Fetch Failure:** Implement error handling to gracefully handle the initial fetch failure of `getSessionWithMetadata` in `src/routes/agents/$sessionId.tsx`. Display an appropriate error message to the user (e.g., "Failed to load session data. Please try again.") and provide a retry mechanism with a maximum of 3 retries with exponential backoff (1s, 2s, 4s). After 3 failed attempts, display a persistent error message with a "Refresh" button and a "Contact Support" link. Log the error with relevant details (session ID, timestamp, error message) to the server-side logs.
2.  **Stale Data:** Implement a mechanism to detect and handle stale data. This involves comparing the `lastUpdated` timestamp in the cached data with the current time and forcing a refresh if the data is too old (older than 2x the polling interval).
3.  **Race Conditions:** Consider potential race conditions if the session data is updated from other sources (e.g., a background process). Ensure that updates are properly synchronized and that the UI always reflects the latest data. Use optimistic updates where appropriate, and handle potential conflicts gracefully.
4.  **Network Errors:** Implement retry logic with exponential backoff for network requests to handle intermittent network errors.
5.  **Background Updates:** Handle scenarios where session data is updated in the background. If the data displayed is out of sync with the server, display a "refresh" indicator or implement optimistic updates where appropriate.

## Rollout/Migration Considerations

1.  **Compatibility:** The changes should be backward compatible with existing versions of the application. Ensure that the existing API contracts are not broken.
2.  **Phased Rollout:** Consider a phased rollout of the changes to a subset of users to monitor for any unexpected issues.
3.  **Feature Flags:** Wrap the changes in a feature flag to allow for easy enabling/disabling of the new functionality.

## Dependencies

TRPC: Minimum supported version: v10.43.6

## Future Considerations

1.  **Push-Based Updates:** Explore alternatives to polling, such as WebSockets or Server-Sent Events, for more efficient and responsive updates of session data.
2.  **Session Data Size:** Continuously monitor the size of the session data being transferred and implement optimizations as needed (e.g., pagination, filtering, delta changes). Consider compression techniques for large payloads.
3.  **Data Partitioning and Read Replicas**: As the number of agents and sessions grows, consider strategies for data partitioning and utilizing read replicas to distribute the database load and ensure scalability.

## Verification Results

- Tests: `npm test` failed (missing script "test"; npm could not write logs to `/Users/venge/.npm/_logs`).
- Completed items verified: 7/7 matched code changes noted above.