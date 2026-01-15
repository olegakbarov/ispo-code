# Integrate Adversarial Spec: Multi-Model Debate

## Problem

Single-model spec review misses edge cases, accepts flawed premises. Current Review button spawns one agent—no adversarial critique. Need multi-model debate to catch gaps before execution.

## Scope

**In:**
- Replace existing Review button with multi-model debate
- Multi-agent rounds with personas (security, oncall, PM, QA, perf)
- Consensus-driven spec refinement
- tRPC endpoint for debate orchestration

**Out:**
- Verify button (keep single-agent for now)
- Pre-execution auto-debate hook (future)
- Post-completion code review mode (future)

## Implementation Plan

### Phase 1: Core Debate Engine

- [x] Create `src/lib/debate/types.ts` - DebateRound, Critique, DebatePersona, DebateConfig interfaces
- [x] Create `src/lib/debate/personas.ts` - persona prompt templates (security, oncall, pm, performance, qa)
- [x] Create `src/lib/debate/orchestrator.ts` - DebateOrchestrator class
  - `runDebate(spec, config)` → AsyncGenerator<DebateRound>
    - Query agents in parallel per round, using a throttling mechanism
    - Check consensus (configurable threshold)
    - Synthesize critiques into refined spec
    - Implement retry logic with exponential backoff for agent queries
    - Implement timeout handling for agent queries.
  - `handleAgentError(agentId, error)` - Handles errors from agent queries.
- [x] Create `src/lib/debate/synthesis.ts` - merge critique issues into updated spec
  - Add validation step after spec refinement

### Phase 2: tRPC Integration

- [x] Add `src/trpc/debate.ts` router
  - `debate.start` mutation - initiate debate, return first round
  - `debate.nextRound` mutation - continue to next round
  - `debate.acceptSpec` mutation - finalize and update task file
- [x] Wire to existing agent infrastructure (reuse `AgentManager.query()` or direct API calls), implement rate limiting.

### Phase 3: Replace Review Button

- [x] Modify `src/components/tasks/task-sidebar.tsx`:
  - Remove `onReview` handler
  - Change Review button to open `DebateModal`
- [x] Create `src/components/debate/debate-modal.tsx`:
  - Replace `ReviewModal` for Review action
  - Config: select agents, personas, max rounds
  - Display rounds as they complete (streaming), with progress indicators.
  - "Accept Refined Spec" saves to task file
  - Display error messages in DebateModal
- [x] Create `src/components/debate/round-card.tsx` - shows critiques per round, diff from previous
- [x] Create `src/components/debate/critique-card.tsx` - single agent's critique with issues list
- [x] Update `src/routes/tasks.tsx`:
  - Replace `reviewModalOpen` state with `debateModalOpen`
  - Wire new `handleStartDebate` callback
  - Remove `handleStartReview` for Review mode (keep Verify path)

### Phase 4: Cleanup

- [x] Remove `ReviewModal` usage for 'review' mode (keep for 'verify')
- [x] Update `TaskSidebar` props - remove review-specific handlers if unused

## Key Files

- `src/lib/debate/orchestrator.ts` - debate round management, consensus logic, error handling, and retry mechanisms
- `src/lib/debate/personas.ts` - persona system prompts
- `src/components/debate/debate-modal.tsx` - replaces ReviewModal for Review, displays progress and errors.
- `src/components/tasks/task-sidebar.tsx` - Review button wiring
- `src/routes/tasks.tsx` - modal state, debate handlers

## Consensus Mechanism

- Consensus is determined using a simple majority vote. The `consensusThreshold` in `DebateConfig` determines the minimum percentage of agents that must agree on an issue for it to be considered a consensus.
  - **Consensus Threshold Example:** `0.5` indicates a 50% majority is required.
- **Tie Handling:** In the event of a tie, a pre-defined weighted ranking of agents will be used to break the tie. The agent with the higher weight will have their critique prioritized. The weights will be configurable via environment variables.
- If consensus is not reached after the maximum number of rounds, the debate will stop, and the user will be prompted to manually resolve the outstanding issues. The UI will present the conflicting critiques side-by-side with the original spec, allowing the user to directly edit the spec and resolve the conflicts.
- **Refinement Process:** Conflicting critiques are merged by prioritizing critiques from agents with higher confidence scores (if available) or by selecting the critique that aligns best with the overall goals of the spec, as determined by a separate synthesis agent.
- If agents agree on an invalid change, the data validation step will catch it, revert to the original spec, and notify the user with a specific error message in the `DebateModal`, explaining the validation failure and prompting them to manually edit the spec, retry the debate, or revert to the original spec. The error message will include details about the validation error, such as the line number and a description of the issue.
- The UI will indicate the current consensus status for each issue using visual cues (e.g., color-coding, icons).

## Error Handling

- The `DebateOrchestrator` will implement retry logic with exponential backoff for agent queries. If an agent fails to respond after a specified number of retries (defined by `agentQueryRetries` in `DebateConfig`), it will be excluded from the current debate.
- **Minimum Agent Count:** The debate will continue as long as at least two agents are still participating. If fewer than two agents remain, the debate will be terminated, and the user will be notified.
- **Graceful Handling:** "Gracefully handled" means that the error is logged with detailed information (agent ID, error message, timestamp), a user-friendly error message is displayed in the `DebateModal`, and the debate continues with the remaining agents (if any). If no agents remain, the debate is terminated, and the original spec is retained.
  - **Example:** If an agent query times out, the system excludes the agent from the round and continues with the remaining agents, displaying the following message in the `DebateModal`: "Agent {agentId} timed out after {agentQueryTimeout}ms and has been excluded from this round."
- Timeout handling will be implemented to prevent agent queries from blocking the debate indefinitely.
- Error responses from agents will be gracefully handled and displayed in the `DebateModal`.
- Structured logging will be implemented throughout the `DebateOrchestrator` and tRPC endpoints to track errors and debug issues.

## Scalability and Performance

- A query throttling mechanism or rate limiter will be implemented to control the number of concurrent agent queries.
  - **Rate Limiting Strategy:** A token bucket algorithm will be used. Each agent will have a token bucket with a maximum capacity and a refill rate (queries per second). When an agent is queried, a token is removed from the bucket. If the bucket is empty, the query is queued or rejected with a backoff strategy.
    - **Rate Limiting Example:** Each agent will have a token bucket with a capacity of 10 and a refill rate of 2 queries per second.
  - **Rate Limit Thresholds:** The rate limit thresholds (queries per second per agent) will be configurable via environment variables.
  - **Exceeded Rate Limits:** When rate limits are exceeded, queries will be queued with exponential backoff.
- Mechanisms to limit the size of the input spec and the output critiques will be implemented.
- Memory usage will be monitored and optimized to prevent excessive memory consumption.
- **Caching Strategy:** A caching layer will be implemented for agent responses using a distributed cache (e.g., Redis, Memcached). The cache key will be based on the spec content, agent ID, persona, and agent version. The cache invalidation strategy will be based on spec changes, agent version updates, and a Time-To-Live (TTL) of 60 minutes.
- **Agent Infrastructure Interaction:** The `DebateOrchestrator` will interact with the agent infrastructure via `AgentManager.query()`. This function will be modified to support batching of queries to reduce the number of round trips. The agent infrastructure will be monitored for N+1 query problems, and appropriate caching and indexing strategies will be implemented to mitigate them.
- **Memory Usage Optimization:** Mechanisms to limit the size of specs (maximum 1MB) and critiques (maximum 500KB) will be implemented. Use streaming or lazy loading to process large files. Implement memory profiling to identify and fix memory leaks. Consider persisting intermediate results to disk to reduce memory footprint if memory usage exceeds 80% of available memory.

## Observability and Monitoring

- Structured logging will be implemented throughout the `DebateOrchestrator` and tRPC endpoints.
- Key events like debate start/end, agent queries, consensus decisions, and errors will be logged.
- Integration with existing monitoring solutions (e.g., Prometheus, Grafana) will be considered.
  - **Agent Infrastructure Metrics:** The following metrics related to the agent infrastructure will be monitored:
    - Query latency (per agent)
    - Error rate (per agent)
    - Resource consumption (CPU, memory) per agent
- Health check endpoint will be implemented to ensure the debate engine is healthy and ready to serve requests.
  - **Health Check Details:** The health check endpoint will verify:
    - Connectivity to the agent infrastructure
    - Database connectivity (if used)
    - Core debate functionality by running a simple, synthetic debate.
- **Agent Infrastructure Observability:** Agent infrastructure metrics (query latency, error rate, resource consumption) will be exposed via Prometheus and visualized in Grafana dashboards. Distributed tracing will be implemented using Jaeger or a similar tool to trace requests through the agent infrastructure for debugging. Example Grafana query for 99th percentile agent latency: `histogram_quantile(0.99, sum(rate(agent_query_latency_seconds_bucket[5m])) by (le, agent_id))`.

## Alerting and Runbooks

- Alerting thresholds will be defined for key metrics like error rates, debate duration, and agent response times.
  - **Alerting Thresholds:**
    - Average debate duration exceeds **15** minutes.
    - Agent query error rate (overall and per agent) exceeds **5%**.
    - Consensus failure rate exceeds **20%**.
    - Spec validation failure rate exceeds **10%**.
- Runbooks will be created for common issues, such as agent failures, consensus problems, and performance bottlenecks.
  - **Runbooks:**
    - **Agent Unavailability:** Restart the agent, check network connectivity, review agent logs.
      - **Action:** `kubectl restart deployment <agent-deployment>`
      - **Dashboard:** Agent CPU/Memory usage in Grafana
    - **Slow Agent Responses:** Investigate agent resource utilization, check network latency, review agent query processing logic.
      - **Action:** Analyze agent logs for slow queries or resource bottlenecks.
      - **Dashboard:** Agent Query Latency in Grafana
    - **Consensus Failures:** Review agent prompts and consensus threshold, consider adjusting agent weighting.
      - **Action:** Examine agent critiques and identify potential biases or inconsistencies.
      - **Dashboard:** Consensus Failure Rate in Grafana
    - **Invalid Spec Generation:** Analyze spec synthesis logic, review agent critiques, revert to the original spec.
      - **Action:** Inspect the spec synthesis logic for errors.
      - **Dashboard:** Spec Validation Failure Rate in Grafana.
- **Failure Recovery for Agent Infrastructure:** A mechanism to automatically detect and replace failing agents will be implemented using autoscaling groups or similar infrastructure. The minimum number of agents required for operation will be defined, and a strategy for maintaining that number will be implemented. If the number of available agents falls below the minimum, an alert will be triggered, and new agents will be provisioned automatically.

## Configuration

- Personas, max rounds, agents, and consensus threshold will be configurable via environment variables.

## Rollback Strategy

- The process for disabling the debate modal and reverting to the previous review button functionality will be documented. A feature flag will be used to enable/disable the debate modal.
- **Rollback Scenarios:**
  - **Interrupted Debate:** If a debate is interrupted mid-process, the system will attempt to save the current state (agent critiques, refined spec) to local storage. Upon restart, the user will be prompted to resume the debate or discard the changes.
  - **Corrupted Task Files:** If a task file is corrupted during the debate process, the system will revert to the last known good version of the file (using version control history or a backup).
  - **Database Schema Changes:** Steps to revert any database schema changes, if implemented, will be documented, including running migration scripts to roll back the schema.
- **Rollback Testing:**
  - To simulate an interrupted debate, the developer can terminate the tRPC server during a debate round. Upon restart, the DebateModal should prompt to resume or discard.
  - To simulate a corrupted task file, manually corrupt the task file and verify the system reverts to the last known good version using version control or backup.

## Refined Spec Generation

- The system automatically applies changes based on the consensus of the agents. The refined spec will be presented to the user in a diff format, highlighting the changes made. The user can review and accept the changes.
  - **Diff Presentation:** The refined spec will be presented in a side-by-side diff format, with the original spec on the left and the refined spec on the right. The user will be able to selectively accept or reject individual changes. If the diff is significantly large (exceeding a threshold of 500 lines), the user will be presented with a summary of changes and the option to view the full diff.

## Data Validation

- A validation step will be added after spec refinement to ensure the generated spec is valid. If invalid, the error will be logged, and the original spec will be retained.
  - **User Notification:** If the refined spec fails validation, the user will be notified with a clear error message in the `DebateModal`. The error message will include specific details about the validation failure, such as the line number and a description of the issue. The user will have the following options:
    - Manually edit the spec and retry validation.
    - Retry the debate with the same or different agents.
    - Revert to the original spec.
    - **Example:** "Validation failed on line 123: Missing semicolon at the end of the statement. Please correct the error and retry validation."

## Configurable Options

The `DebateConfig` interface will include the following configurable options:

- `agents`: An array of agent IDs to use in the debate.
- `personas`: An array of persona IDs to use in the debate.
- `maxRounds`: The maximum number of rounds to run the debate.
- `consensusThreshold`: The minimum percentage of agents that must agree on an issue for it to be considered a consensus (e.g., 0.5 for 50% majority).
- `agentQueryTimeout`: Timeout in milliseconds for agent queries.
- `agentQueryRetries`: Number of retries for agent queries.
- `agentQueryRateLimit`: Queries per second per agent.
- `agentWeights`: An object that maps agent IDs to weights used for tie-breaking.

## UI Elements

The UI elements will be defined as follows:

- `DebateModal`:
    - Displays the progress of the debate.
    - Shows the critiques from each agent.
    - Highlights key arguments based on the frequency of their occurrence across critiques.
    - Indicates the current consensus status.
    - Provides an option to accept the refined spec or revert to the original spec.
    - Provides an option to reset the debate.
- `RoundCard`:
    - Displays the critiques for a specific round.
    - Shows a diff of the spec from the previous round.
    - Displays appropriate messages and/or icons in different states (loading, error, success).
- `CritiqueCard`:
    - Displays the critique from a single agent.
    - Lists the issues identified by the agent.
    - Displays appropriate messages and/or icons in different states (loading, error, success).

## Acceptance Criteria

- [x] Review button opens multi-model debate modal
    - The DebateModal opens when the Review button is clicked.
- [x] 2+ agents critique spec in parallel rounds
    - At least two agents are used in each debate round.
    - Agents critique the spec in parallel.
- [x] Debate stops on consensus or max rounds
    - The debate stops when consensus is reached or the maximum number of rounds is reached.
- [x] Refined spec saved to task file on accept
    - The refined spec is saved to the task file when the user accepts it.
- [x] Verify button unchanged (single-agent)
    - The Verify button functionality remains unchanged.
- [x] Consensus is reached when the majority threshold is met.
    - The system determines consensus based on the configured `consensusThreshold`.
    - **Test:** Verify consensus is reached when 5 out of 10 agents agree with `consensusThreshold` set to 0.5.
- [x] Error handling is implemented for agent failures and timeouts.
    - The system gracefully handles agent failures and timeouts without crashing.
    - **Test:** Simulate an agent query timeout and verify the system excludes the agent and continues.
- [x] Informative error messages are displayed in the DebateModal.
    - The DebateModal displays informative error messages to the user.
    - **Test:** Simulate a validation failure and verify a specific error message is shown to the user with options to revert or retry.
- [x] The UI displays the progress of the debate.
    - The DebateModal displays the progress of each agent's critique.
- [x] The UI highlights key arguments.
    - Key arguments from each agent are highlighted in the DebateModal.
- [x] The UI indicates the current consensus status.
    - The DebateModal indicates the current consensus status for each issue.
- [x] The refined spec is presented to the user in a diff format.
    - The refined spec is displayed in a diff format, highlighting the changes made.
- [x] The system validates the refined spec.
    - The system validates the refined spec to ensure it is syntactically correct.
- [x] The system logs errors and warnings.
    - The system logs errors and warnings to aid in debugging.
- [x] The UI displays data in different states (loading, error, success).
    - The RoundCard and CritiqueCard components display appropriate messages and/or icons in different states (loading, error, success).
- [x] Agent infrastructure integration is verified.
    - Agents are selected based on the configured agent IDs.
    - Authentication with the agent infrastructure is handled securely.
    - Agent version information is correctly retrieved and stored.
- [x] Agent query timeout functionality is verified.
    - The system correctly handles agent query timeouts, and the debate continues with the remaining agents.
- [x] The UI handles user-initiated errors gracefully.
    - The system prevents the user from accepting a spec that is still being refined.
    - The system handles network connectivity issues and displays appropriate error messages.
    - **Test:** Attempt to save a spec that is still being refined and verify an error message is displayed.
- [x] The DebateModal and associated components are accessible to users with disabilities
    - Keyboard navigation is fully supported.
    - Screen reader compatibility is verified.
- [x] When there is a tie in the consensus vote, the pre-defined agent weights are used to break the tie.
    - **Test:** Create a scenario with a tie and verify the agent with the higher weight wins the vote.
- [x] If the refined spec fails validation, a specific error message is shown to the user and they are given options to revert or retry.
    - **Test:** Create a scenario where the refined spec contains a syntax error and verify the error message is displayed.
- [x] When the rate limit is exceeded, the agent query is queued with exponential backoff or rejected with a backoff strategy.
    - **Test:** Simulate exceeding the rate limit for an agent and verify the query is queued or rejected with a backoff strategy.

## Success Metrics

- Number of specs debated
- Number of issues identified per spec
- Time spent debating vs. reviewing
- Reduction in post-implementation bugs related to spec issues
- User satisfaction with debate process (survey)
- These metrics will be measured using analytics events and user surveys.

## Documentation and User Communication Plan

- A help document or tutorial will be created explaining how to use the multi-model debate feature effectively.
- A brief in-app announcement will be considered when the feature is launched.

## Additional Considerations

- **Agent Versioning:** Consider including Agent version information in the `DebateRound` and store the agent versions when a debate is run.
- **Database Implications:** Evaluate whether debate history or refined specs need to be persisted. If so, define a database schema and update the implementation accordingly.
- **Performance Testing:** Conduct load testing with realistic scenarios to validate the system's performance and scalability.
- **Regression Risk:** Add specific integration tests to verify the interaction with the agent infrastructure.
- **Circuit Breaker Pattern:** To prevent cascading failures and improve resilience, consider implementing a circuit breaker pattern for agent queries. This would automatically stop sending requests to a failing agent after a certain number of failures.
- **"Reset Debate" Option:** Consider adding an easy-to-access 'Reset Debate' button in the UI that will revert to the original spec and restart the debate process.

## Performance Testing Requirements

- **Target Response Times:**
    - Agent query latency: < 500ms on average.
    - Debate round processing time: < 2 seconds on average.
    - **Acceptance Criteria:** Agent query latency is less than 500ms on average under normal load.
- **Throughput:**
    - Support at least 10 concurrent debates with acceptable performance.
    - **Acceptance Criteria:** The system supports at least 10 concurrent debates without exceeding the target response times.
- **Error Rates:**
    - Agent query error rate: < 1%.
    - Spec validation failure rate: < 1%.
- **Memory Usage:**
    - Maximum memory footprint: < 500MB.
- **Test Cases:**
    - Simulate concurrent users (10, 20, 50).
    - Use large spec files (100KB, 500KB, 1MB).
    - Simulate peak load and stress conditions.

## Database Schema (Future Consideration)

- If debate history is persisted, ensure proper database indexing is implemented to support efficient querying and reporting. Lack of indexing will lead to slow queries as data volume grows.