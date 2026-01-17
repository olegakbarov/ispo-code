# planning, implementation and verification should only have one session attached or allow re-create session with different model

<!-- taskId: zMQkk0r_ex -->

## Problem Statement
Multiple plan/run/verify sessions per task; reruns clutter, source of truth unclear.
Single session per phase, allow re-create on model change.

## Scope
**In:**
- Server guardrail for planning/implementation/verification session creation
- Replace or block behavior based on existing session model
- UI handling for conflicts or replace flows, including informative error messages
- Tests for session replacement/deny behavior
- Optimized session lookup to prevent N+1 query problems
- Caching strategy for session data
- Single-agent Debug sessions for Plan/Run/Verify phases.
**Out:**
- Debug multi-agent runs and orchestrator behavior (see "Open Questions" for potential inclusion)
- Session history export or migration
- UI redesign beyond minimal messaging

## Implementation Plan

### Phase: Session Rules
- [ ] Add helper to find latest non-deleted session per task+phase with model/agent info (optimize for performance, see below)
- [ ] Enforce single session in `createWithAgent`, `assignToAgent`, `verifyWithAgent`
- [ ] On model change, cancel/delete prior session before spawning new one (use soft-delete initially)
- [ ] Exclude deleted sessions from `getSessionsForTask` grouping
- [ ] Implement locking to prevent race conditions during session replacement. Initially, pessimistic locking will be used with database transactions and `SELECT ... FOR UPDATE`. A feature flag will be used to allow for quicker rollback and A/B testing of different locking strategies. Set a short TTL (e.g. 5 seconds) for the lock and retry if the lock cannot be acquired. If pessimistic locking proves to be a bottleneck, we will explore alternative locking mechanisms, such as optimistic locking with versioning or distributed locks (e.g., using Redis or ZooKeeper).
- [ ] Add error handling for session creation failures and backend unavailability. Return specific error codes and messages to the client.
- [ ] Implement bulk operations for session replacement and deletion to reduce database round trips and improve overall performance.

### Phase: Client Guardrails
- [ ] Detect existing session conflicts in task UI and surface concise error/confirm with specific user-facing messages (see below)
- [ ] Pass replace intent when user selects different model
- [ ] Refresh session lists and active session cache after replace/block

### Phase: Verification
- [ ] Add router or hook tests for same-model block and model-change replace
- [ ] Cover deletion filtering in sessions list tests

### Performance Optimizations
- **Session Lookup:**
    - Implement a caching layer (e.g., Redis) to store the latest session information for each task/phase/model.
    - Use a cache-aside pattern.
    - Define a cache invalidation strategy based on session creation, updates, and deletions.  Use Redis Pub/Sub with retry logic to propagate invalidations. The message format will be a JSON object containing the `task_id`, `phase`, and `model` of the session being invalidated. Messages will be re-attempted up to 3 times with exponential backoff if delivery fails. Use a distributed lock or message queue to ensure consistent cache invalidation across multiple servers.
    - Ensure the database query for session lookup has indexes on `task_id`, `phase`, `model`, and `deleted_at`.
- **Session Deletion:**
    - Initially use a soft-delete approach (marking sessions as deleted instead of physically removing them). The `deleted_at` field must be indexed.
    - Implement a background job to periodically archive or purge old, soft-deleted sessions in batches. Implement exponential backoff with jitter for the background deletion jobs. Define a clear strategy for batch size, frequency, and resource consumption of the background job. Implement monitoring to track the job's performance and identify potential bottlenecks.
- **Caching Strategy:**
    - Cache session data and the results of session lookups in Redis.
    - Invalidate the cache on session creation, updates, and deletions.
    - Use optimistic locking on sessions to prevent lost updates during invalidation. The `version` column will be used for optimistic locking. Update statements will include a `WHERE version = :old_version` clause to ensure that the update only succeeds if the session has not been modified since it was last read.

### Error Handling and User Communication
- **Session Creation Failure:** If session creation fails (e.g., due to database errors, network issues), display an error message to the user: "Failed to create session. Please try again later." Include a retry mechanism.
- **Backend Unavailability:** If the backend is temporarily unavailable, display a message: "The server is currently unavailable. Please try again in a few minutes."
- **Same-Model Block:** When a user attempts to re-run a task with the same model, return the existing session and display a message indicating the session is already running, allowing the user to monitor its progress. UI Text: "A session with the same model is already active. View the active session."
- **Model-Change Replace:** When a user attempts to re-run a task with a different model, display a confirmation dialog: "This will replace the existing session and any unsaved progress will be lost. Are you sure you want to continue?". Provide a mechanism to export data from the old session before replacement, such as downloading logs. If the user confirms, auto-cancel the running session and proceed with the session replacement.
- **Concurrent Modification During Session Replacement:** If a user attempts to replace a session while another user is actively modifying it, display an error message informing the user that the session is currently being modified and to try again later. UI Text: "This session is currently being modified. Please try again later."
- **General Errors:** For any unexpected errors, display a generic error message: "An unexpected error occurred. Please contact support." Log the error details for debugging.

### Data Loss Prevention
- Before replacing a session, display a warning message indicating potential data loss: "Replacing this session will result in the loss of any unsaved progress."
- Provide a mechanism to export the data from the old session before replacement (e.g., download logs or intermediate results).
- Soft-delete the old session, archiving the data for potential future review (beyond just a soft delete), based on data retention policies.

### Dependencies and Rollout Plan
- **Dependencies:** None identified at this time.
- **Rollout Plan:**
    - Implement the changes behind a feature flag.
    - Deploy the changes to a staging environment for thorough testing.
    - Define specific success metrics for each rollout stage:
        - Stage 1 (5% of users): Monitor session replacement success rate > 99%, error rate < 1%.
        - Stage 2 (25% of users): Monitor session lookup time < 100ms, CPU utilization < 50%.
        - Stage 3 (50% of users): Monitor database connection pool metrics (active connections, idle connections, wait time, connection failures). Ensure wait time < 50ms.
        - Stage 4 (100% of users): Monitor end-to-end session replacement time < 500ms.
    - Gradually roll out the changes to a small percentage of users.
    - Monitor performance and error rates closely.
    - Increase the rollout percentage incrementally until all users are migrated.
    - Proactively inform users about the changes and any potential impact on their workflow via in-app announcements or targeted emails, highlighting the benefits and any potential impact on their workflow.

### Connection Pool Configuration
- Explicitly configure the database connection pool (e.g., maximum pool size, connection timeout, idle timeout).
- Monitor these settings and adjust them based on load characteristics. Monitor active connections, idle connections, wait time, and connection failures. If the wait time exceeds 100ms, increase the maximum pool size. If connection failures exceed 1%, investigate network connectivity or database server issues.

## Key Files
- `src/trpc/tasks.ts` - enforce single-session rules, replace flow, session list filtering, error handling
- `src/lib/agent/task-session.ts` - helper for latest session lookup (optimized), deleted filtering
- `src/lib/utils/session-phase.ts` - map titles to phases for server checks
- `src/lib/hooks/use-task-agent-actions.ts` - client conflict handling, replace intent
- `src/components/tasks/implement-modal.tsx` - model-change replace UX, error display
- `src/components/tasks/review-modal.tsx` - verify replace UX, error display
- `src/components/tasks/task-sessions.tsx` - ensure deleted sessions not shown
- `src/lib/hooks/__tests__/use-task-actions.test.ts` - client guard tests
- `src/trpc/__tests__/` - server session rule tests, error handling tests

## Success Criteria
- [ ] Re-running plan/run/verify with same model does not create a new session. Verified by checking that the number of sessions for the task/phase/model remains unchanged in the database after the attempt.
- [ ] Re-running with different model replaces prior session and shows only one. Verified by:
    - Checking that the old session is marked as `deleted_at` is set in the database.
    - Confirming that the new session is created.
    - Ensuring that only the new session is visible in the session list API.
    - Only one session is visible in the UI.
- [ ] Session lists omit deleted sessions for those phases. Verified by checking the session list API response and UI to ensure that sessions with `deleted_at` set are not included.
- [ ] Tests cover block/replace flows, including error handling scenarios.
- [ ] Performance tests show:
    - Session lookup time is less than 100ms under normal load (100 concurrent users).
    - Session replacement completes in less than 500ms.
    - CPU utilization should not exceed 80% and memory utilization should not exceed 5GB under high load (500 concurrent users).
    - Peak load, sustained load, and failure recovery scenarios are tested.

## Open Questions
- Scope: include single-agent Debug sessions or only Plan/Run/Verify? (Answered in Scope)

## Model Deletion Handling
If a model is deleted after a session has been created with it, the following should occur:

- The session should still be visible in the session list with an indication that the model is no longer available (e.g., "Model Not Found").
- Attempts to re-run or interact with the session should result in an error message indicating that the model is missing.
- The `latest session lookup` helper should still return the session, even if the model is deleted, to maintain a record of past activity.

## Monitoring and Metrics
- **Product Metrics:**
    - Number of session replacements
    - Reasons for session replacement (e.g., model change, user request)
    - Impact of locking mechanism on user experience (e.g., number of retries, delays)
    - User satisfaction/feedback related to session management
- **Performance Metrics:**
    - Session lookup time
    - Session replacement time
    - CPU and memory utilization
    - Database connection pool statistics
    - Background job performance (batch size, frequency, completion time)

## Performance Testing Scenarios
- **Concurrent User Simulation:** Simulate 100 and 500 concurrent users performing common tasks like session creation, modification, and replacement.
- **Peak Load Test:** Simulate a sudden spike in user activity (e.g., 1000 concurrent users) to assess the system's ability to handle unexpected load.
- **Sustained Load Test:** Simulate a sustained high load (e.g., 500 concurrent users) for an extended period (e.g., 1 hour) to identify potential performance degradation over time.
- **Failure Recovery Test:** Simulate a failure scenario (e.g., database outage) and verify that the system can recover gracefully without data loss or prolonged downtime.
- **Background Job Impact Test:** Evaluate the impact of the background session deletion job on overall system performance by running it concurrently with other performance tests.
- **Data Size and Distribution:** Test with realistic data sizes and distributions to simulate real-world scenarios.

## Data Archival and Purging Strategy

- **Archival Format:** Session data will be archived in JSON format, including all relevant session metadata (task ID, phase, model, timestamps, user ID) and session-specific data (e.g., logs, intermediate results).
- **Storage Location:** Archived session data will be stored in a dedicated cloud storage bucket (e.g., AWS S3, Google Cloud Storage) with versioning enabled.
- **Data Retention Policy:** Archived session data will be retained for one year.
- **Data Retrieval Process:** Archived session data can be retrieved via an internal API endpoint that requires appropriate authentication and authorization. The API will return the archived data in JSON format.
- **Disaster Recovery:** The cloud storage bucket will be configured with replication across multiple availability zones to ensure data durability and availability in the event of a disaster. Regular backups of the archived data will be performed and stored in a separate geographic location.

## Background Job Configuration

- **Maximum Batch Size:** 1000 sessions
- **Frequency of Execution:** Daily at 3:00 AM UTC
- **Resource Limits:**
    - CPU: 2 cores
    - Memory: 4 GB
- **Error Handling:**
    - Retry attempts: 3 with exponential backoff (1 minute, 5 minutes, 15 minutes)
    - Dead-letter queue: Sessions that fail to be archived after 3 retries will be moved to a dead-letter queue for manual investigation.
- **Concurrency:** 2 parallel workers
- **Monitoring:** Monitor the job's completion time, number of sessions processed, error rate, and resource consumption (CPU, memory, I/O). Alert if the job fails to complete within 6 hours or if the error rate exceeds 5%.

## Definition of 'Model Change'

A 'model change' is defined as any modification to the model that could potentially affect the outcome of the Plan, Run, or Verify phase. This includes:

- **Full Model Replacement:** Replacing the existing model with a completely different model.
- **Major Version Update:** Upgrading to a new major version of the same model (e.g., from version 1.x to 2.x).
- **Parameter Tuning:** Significant changes to the model's hyperparameters or configuration settings that could substantially alter its behavior.

Minor version updates or small adjustments to non-critical parameters may not be considered a model change, depending on the specific context. Users will be prompted to confirm whether a session replacement is desired when a model change is detected, offering them more control over the process.

## Monitoring Infrastructure

- **Metrics Collection:** Prometheus will be used to collect the performance and product metrics outlined in the specification.
- **Data Aggregation:** Metrics will be aggregated using Prometheus's built-in aggregation functions (e.g., `sum`, `avg`, `rate`).
- **Visualization:** Grafana will be used to visualize the collected metrics and create dashboards for monitoring system performance and user behavior.
- **Alerting:** Prometheus Alertmanager will be configured to trigger alerts based on predefined thresholds for critical performance indicators (e.g., session lookup time, CPU utilization, error rate). Alerts will be routed to the appropriate on-call engineers via PagerDuty.
- **Log Analysis:** The ELK stack (Elasticsearch, Logstash, Kibana) will be used to collect, index, and analyze application logs. This will enable us to identify and diagnose errors, performance bottlenecks, and security issues.

## Locking Mechanism

The pessimistic locking implementation will be wrapped with a feature flag named `pessimistic_locking_enabled`. This flag will allow us to quickly enable/disable pessimistic locking or switch to an alternative locking strategy if needed. Metrics will be tracked to assess the effectiveness and impact of the pessimistic locking mechanism, including:
- Number of lock acquisitions
- Lock acquisition time
- Number of lock contention events
- Number of lock timeouts
- Impact on session replacement time
These metrics will inform the decision on whether to fully enable pessimistic locking or explore alternative strategies.

## Session History Decision

The decision to exclude session history export/migration from the initial scope was based on the following factors:
- **Complexity:** Implementing session history export/migration would add significant complexity to the project.
- **Uncertain User Value:** The potential user value of session history is uncertain. We lack sufficient evidence to justify the added complexity at this stage.
- **Alternative Solutions:** Users can already access session logs and intermediate results, which may satisfy their needs for auditing and debugging.

We will consider performing user research to validate the assumption that session history is not important. If user demand for session history is high, we will add it to the backlog for future consideration.