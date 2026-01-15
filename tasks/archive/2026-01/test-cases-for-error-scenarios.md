# Test Cases for Error Scenarios

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

- [x] User provides an invalid parameter to Tool X -> Agent displays an error message indicating the parameter is invalid.
- [x] MCP Server is unavailable -> Agent displays "Failed to connect to MCP server" error.
- [x] User attempts to invoke a tool without proper authorization -> Agent displays an "Unauthorized" error message.
- [x] MCP tool returns an unexpected error code -> Agent displays the error message from the tool to the user.

## Test Implementation Notes

All error scenario tests have been added to `src/lib/agent/__tests__/mcporter-agent.test.ts`. The test suite includes:

### Invalid Parameter Tests
- `should display error when tool receives invalid parameter type` - Tests parameter type validation errors
- `should sanitize error messages containing invalid parameters` - Tests XSS prevention in error messages
- `should handle missing required parameters` - Tests required parameter validation

### Server Unavailable Tests
- `should emit 'Failed to connect to MCP server' when server is unreachable` - Tests connection failure handling
- `should report retry behavior on connection failure` - Tests retry mechanism error reporting
- `should handle DNS resolution failure` - Tests DNS lookup error handling via mcp-server-validator

### Authorization Tests
- `should display Unauthorized error when tool requires auth` - Tests 401 Unauthorized responses
- `should display Forbidden error for insufficient permissions` - Tests 403 Forbidden responses
- `should skip OAuth servers by default` - Tests OAuth server handling in validation

### Unexpected Error Code Tests
- `should display error message for 500 Internal Server Error` - Tests server error handling
- `should display error message for 502 Bad Gateway` - Tests gateway error handling
- `should display error message for 503 Service Unavailable` - Tests service unavailability
- `should handle error response in various formats` - Tests different error response formats
- `should handle timeout errors` - Tests operation timeout handling
- `should handle rate limit errors with retry info` - Tests 429 rate limit handling

### Error Extraction Tests
- Unit tests for `extractErrorMessage` helper covering string, object, and fallback scenarios

Run tests with: `npx vitest run src/lib/agent/__tests__/mcporter-agent.test.ts`
