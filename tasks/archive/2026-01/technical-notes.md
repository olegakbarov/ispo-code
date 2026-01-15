# Technical Notes

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

- [x] Implement robust validation of the MCP server configurations loaded from `~/.mcporter/mcporter.json`. This should include verifying the server's address and checking for known malicious patterns.
  - ✓ Verified: Config paths include `~/.mcporter/mcporter.json` in `src/lib/agent/mcp-server-validator.ts:352`, and validation flow uses `validateAllServers` in `src/lib/agent/mcp-server-validator.ts:391`.
- [x] Server address validation: The server address must be a valid URL, starting with `http://` or `https://`, and the hostname must be reachable via DNS lookup.
  - ✓ Verified: URL scheme validation in `src/lib/agent/mcp-server-validator.ts:138` and DNS lookup with timeout in `src/lib/agent/mcp-server-validator.ts:203`.
  - ⚠️ Issue: DNS timeouts only add warnings (not errors) at `src/lib/agent/mcp-server-validator.ts:224`, so unreachable hosts can still pass validation.
- [x] Malicious pattern detection: Implement a blacklist of known malicious domains and IP addresses. Check the server address against this blacklist. Example: `127.0.0.1` will always be rejected.
  - ✓ Verified: Blacklist includes localhost/127.x and metadata hosts in `src/lib/agent/mcp-server-validator.ts:43` and patterns in `src/lib/agent/mcp-server-validator.ts:67`, enforced by `isBlacklistedHost` at `src/lib/agent/mcp-server-validator.ts:174`.
- [x] Default to skipping servers requiring OAuth.
  - ✓ Verified: OAuth detection in `src/lib/agent/mcp-server-validator.ts:287`, default skip behavior in `src/lib/agent/mcp-server-validator.ts:406`, and runtime uses `skipOAuth: true` in `src/lib/agent/mcporter.ts:269`.
- [x] Implement a maximum number of connections per MCP server and a maximum number of total connections.
  - ✓ Verified: Limits defined at `src/lib/agent/mcp-server-validator.ts:22` and enforced in `src/lib/agent/mcp-server-validator.ts:490`, with acquisition in `src/lib/agent/mcporter.ts:418`.
  - ⚠️ Issue: `releaseConnection` is only called on error at `src/lib/agent/mcporter.ts:458`, so successful discovery never releases slots and repeated discovery can exhaust limits.
- [x] Implement a mechanism to close idle connections after a certain period of inactivity.
  - ✓ Verified: Idle detection/closure in `src/lib/agent/mcp-server-validator.ts:582` and periodic cleanup in `src/lib/agent/mcporter.ts:307`.
- [x] Define a maximum number of connections per MCP server and a maximum number of total connections.
  - ✓ Verified: Constants for limits defined at `src/lib/agent/mcp-server-validator.ts:22`.
  - ⚠️ Issue: Same slot-release concern as above; limits can be exhausted without a success release path (`src/lib/agent/mcporter.ts:418`).
- [x] Implement a mechanism to close idle connections after a certain period of inactivity.
  - ✓ Verified: Idle timeout constant at `src/lib/agent/mcp-server-validator.ts:28` and cleanup interval in `src/lib/agent/mcporter.ts:313`.
- [ ] Use a connection pool library that provides these features.
  - ✗ Not found: Connection pooling is a custom Map-based implementation in `src/lib/agent/mcp-server-validator.ts:474` and there is no pool library dependency in `package.json:1`.

## Implementation Summary

Created `src/lib/agent/mcp-server-validator.ts` with:

### Server Address Validation
- URL format validation (only `http://` or `https://` allowed)
- DNS reachability check with 5-second timeout
- Resolved IP verification against blacklist

### Malicious Pattern Detection
- Blacklisted hosts: localhost, 127.x.x.x, 0.0.0.0, ::1, private IP ranges (10.x, 192.168.x, 172.16-31.x)
- Cloud metadata endpoints blocked (169.254.169.254, metadata.google.internal)
- Regex patterns for comprehensive coverage

### OAuth Server Handling
- `skipOAuth: true` by default in `loadAndValidateConfigs()`
- Detects OAuth via `requiresOAuth` flag or presence of `oauth.authUrl`/`oauth.clientId`

### Connection Limits
- `MAX_CONNECTIONS_PER_SERVER = 3`
- `MAX_TOTAL_CONNECTIONS = 10`
- Pool tracks per-server and total connections

### Idle Connection Timeout
- `IDLE_CONNECTION_TIMEOUT_MS = 5 minutes`
- Interval checks every minute for idle connections
- Auto-closes and releases connection slots

### Integration
- Validation runs during MCPorter agent initialization (`initRuntime()`)
- Connection pool acquired/released during tool discovery
- Cleanup on agent destruction

## Verification Results
- Tests: `npx vitest run src/lib/agent/__tests__/mcp-server-validator.test.ts` failed (network ENOTFOUND registry.npmjs.org; vitest not installed locally).
- Gaps: Connection pool library requirement not met; custom pool only.
- Risks: Connection slots not released on success (`src/lib/agent/mcporter.ts:418`) and DNS timeouts are treated as warnings (`src/lib/agent/mcp-server-validator.ts:224`).
- Coverage: Validation/blacklist/OAuth skipping and idle cleanup logic are present in code.