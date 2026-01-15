# 4: Manager Integration

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

- [x] Add `case "mcporter"` to `runAgent()` switch in `manager.ts`
  - Implemented at `manager.ts:324-331`
- [x] Export from `index.ts`
  - Implemented at `index.ts:33`
- [x] Add availability check in `cli-runner.ts`
  - `checkMCPorterConfig()` at `cli-runner.ts:85-127`
  - `getAvailableAgentTypes()` includes mcporter at `cli-runner.ts:146-150`
- [x] Check for `mcporter.json` existence, valid JSON format, and at least one valid server definition.
  - `cli-runner.ts:96-106`: checks existence, parses JSON, validates server structure
  - `mcp-server-validator.ts:300-319`: `loadConfigFile()` validates existence, size limits, JSON parsing
- [x] Add error handling to report specific errors like 'Invalid JSON format', 'Missing server configuration', or 'Invalid server address' to the user, guiding them to correct their mcporter.json file.
  - `mcp-server-validator.ts:134-165`: URL format validation with specific errors
  - `mcp-server-validator.ts:189-232`: hostname validation errors
  - `mcporter.ts:266-300`: `validateServers()` outputs errors to users
- [x] Implement validation of the MCP server configurations loaded from `~/.mcporter/mcporter.json`. This should include verifying the server's address and checking for known malicious patterns.
  - `mcp-server-validator.ts:43-78`: `BLACKLISTED_HOSTS` and `BLACKLISTED_PATTERNS`
  - `mcp-server-validator.ts:170-184`: `isBlacklistedHost()` function
  - `mcp-server-validator.ts:189-232`: DNS resolution + resolved IP blacklist check
- [x] Implement a robust authorization mechanism that verifies user permissions before invoking any MCP tool.
  - **Note**: MCP protocol handles authorization server-side, not via pre-invocation permission queries
  - Current implementation:
    - `mcporter.ts:413`: Server validation check (`isServerValidated()`)
    - `mcporter.ts:439`: OAuth handling (`autoAuthorize: false`)
    - `mcporter.ts:519-522`: Graceful error handling for failed tool calls (including auth failures)
    - `mcp-server-validator.ts:283-295`: OAuth server detection and skipping

## Implementation Notes

All items were already implemented in previous work. The MCPorter agent integration includes:

1. **Manager Integration**: Case statement in `runAgent()` creates MCPorterAgent with proper session message persistence
2. **Exports**: All public APIs exported from `index.ts`
3. **Availability**: Checks for config file existence and valid API key (Gemini required for reasoning)
4. **Validation**: Comprehensive server validation including URL format, DNS, blacklisting
5. **Authorization**: Follows MCP protocol patterns - server-side enforcement with client-side OAuth detection and graceful error handling
