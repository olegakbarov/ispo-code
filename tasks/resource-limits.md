# Resource Limits

<!-- splitFrom: tasks/add-qa-agent-using-mcporter-https-github-com-steipete-mcporter.md -->

## Problem Statement
New QA agent type using MCPorter for MCP tool discovery/invocation. Standalone agent spawned from `/` route with user prompt, not tied to task workflows.

## Scope
**In:**
- New `mcporter` agent type in agent system
- MCPorter runtime for MCP tool discovery
- Standalone spawn flow (prompt-based, like other agents)
- QA-focused system prompt
- UI integration in agent selector on index page

**Out:**
- Task-linked spawning (no `createWithAgent`, `assignToAgent` integration)
- MCPorter CLI generation features
- OAuth flow handling
- Custom MCP server configuration UI

## Implementation Plan

- [x] Implement rate limiting and quotas for LLM usage (number of tokens, requests per user/session).
- [x] Define concrete rate limiting policies for LLM usage, including limits on the number of requests per user or session, the number of tokens per request, and the total token usage per time period. Implement monitoring and alerting for exceeding rate limits. Consider using a rate limiting library or service.
- [x] Monitor LLM usage patterns to identify potential abuse.
- [x] Metrics to be tracked: Number of requests per user, number of tokens per request, total token usage per user per minute.
- [x] Actions to be taken if abuse is detected: Temporary account suspension (e.g., 15 minutes) for exceeding rate limits. Permanent account suspension for repeated violations.

## Implementation Summary

### Components Created

1. **Rate Limiter Service** (`src/lib/agent/rate-limiter.ts`)
   - In-memory token and request tracking with TTL-based cleanup
   - Enforces per-minute and per-hour limits
   - Automatic suspension system for violations
   - Supports multiple users/sessions simultaneously

2. **Security Configuration** (`src/lib/agent/security-config.ts`)
   - Rate limiting policies:
     - 60 requests per minute per user
     - 50,000 tokens per request max
     - 200,000 tokens per minute per user
     - 1,000,000 tokens per hour per user
     - 15-minute suspension for violations
     - 5 violations before permanent suspension

3. **Abuse Detector** (`src/lib/agent/abuse-detector.ts`)
   - Monitors usage patterns every 30 seconds
   - Calculates abuse scores (0-100) based on:
     - Request rate utilization
     - Token consumption patterns
     - Violation history
   - Generates alerts with severity levels (low/medium/high/critical)
   - Automatically suspends users based on abuse scores

4. **Agent Manager Integration** (`src/lib/agent/manager.ts`)
   - Rate limit checks before spawning agents
   - Token usage recording after completion
   - userId tracking throughout session lifecycle
   - Estimated token validation for prompts

5. **Monitoring API** (`src/trpc/rate-limit.ts`)
   - tRPC endpoints for:
     - Getting rate limit configuration
     - Viewing user statistics
     - Checking abuse metrics
     - Listing suspicious users
     - Manual user suspension
     - Clearing rate limit data

### Usage Metrics Tracked

- Requests per user per minute
- Tokens per request
- Total token usage per minute
- Total token usage per hour
- Violation count per user
- Suspension status and duration

### Actions on Abuse Detection

| Abuse Score | Severity | Action |
|-------------|----------|--------|
| 80-100      | Critical | Block (1 hour suspension) |
| 60-79       | High     | Suspend (15 minutes) |
| 40-59       | Medium   | Warn |
| 20-39       | Low      | Warn |

### Notes

- Rate limiting uses in-memory storage (consider Redis for multi-server deployments)
- All sessions default to userId "anonymous" if not provided
- Rate limits can be disabled via `RATE_LIMIT_ENABLED` config
- Abuse detector runs continuous monitoring with configurable thresholds
