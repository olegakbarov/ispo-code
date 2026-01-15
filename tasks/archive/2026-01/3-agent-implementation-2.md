# 3: Agent Implementation

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

- [x] Create `src/lib/agent/mcporter.ts`
  - ✓ Verified: File exists at `src/lib/agent/mcporter.ts`.
- [x] Implement `MCPorterAgent` class extending `EventEmitter`
  - ✓ Verified: `export class MCPorterAgent extends EventEmitter` at `src/lib/agent/mcporter.ts:148`.
- [x] Use `createRuntime()` for MCP server connection pooling
  - ✓ Verified: `createRuntime` invoked in `src/lib/agent/mcporter.ts:350`.
- [x] Implement error handling for `createRuntime()`, including connection failures and invalid configuration.
  - ✓ Verified: config validation and runtime init error handling in `src/lib/agent/mcporter.ts:264` and `src/lib/agent/mcporter.ts:334`.
- [x] If the MCP server is unavailable, the agent should display an error message: "Failed to connect to MCP server. Please check your configuration and network connection."
  - ✓ Verified: emits exact message in `src/lib/agent/mcporter.ts:369`.
- [x] Implement retry mechanisms for transient connection errors.
  - ✓ Verified: retry loop with backoff in `src/lib/agent/mcporter.ts:345`.
- [x] Implement tool discovery via `runtime.listTools()`
  - ✓ Verified: `runtime.listTools` used in `src/lib/agent/mcporter.ts:437`.
- [ ] Implement caching of tool definitions with a TTL (Time To Live) and invalidating the cache when the MCPorter configuration file changes. Default TTL: 60 seconds.
  - ✗ Not found: TTL cache exists but no config-change invalidation or watcher; only TTL in `src/lib/agent/mcporter.ts:41` and cache usage in `src/lib/agent/mcporter.ts:428`.
- [x] Provide a mechanism to manually refresh the tool definitions cache.
  - ✓ Verified: `refreshToolCache()` clears cache in `src/lib/agent/mcporter.ts:470`.
- [x] Refresh the MCP tool list for each turn.
  - ✓ Verified: `executeLoop()` calls `discoverTools()` each run in `src/lib/agent/mcporter.ts:622`.
- [x] Build dynamic tool definitions from discovered MCP tools
  - ✓ Verified: `buildTools()` constructs `tool()` definitions in `src/lib/agent/mcporter.ts:475`.
- [x] QA-focused system prompt (test, validate, verify patterns)
  - ✓ Verified: `DEFAULT_SYSTEM_PROMPT` in `src/lib/agent/mcporter.ts:128`.
- [x] Implement `run()`, `abort()`, `getMessages()` methods
  - ✓ Verified: `run` `src/lib/agent/mcporter.ts:568`, `abort` `src/lib/agent/mcporter.ts:705`, `getMessages` `src/lib/agent/mcporter.ts:554`.
- [ ] Implement strict, schema-based input validation and sanitization before passing any user-provided data to the MCP tools, using a library designed for input validation (e.g., `joi`, `yup`). Define a whitelist of allowed characters and data formats.
  - ✗ Not found: tool input schema is permissive `z.record(z.unknown())` and no whitelist/sanitization before `callTool` (`src/lib/agent/mcporter.ts:491`, `src/lib/agent/mcporter.ts:506`).
- [ ] Implement comprehensive error handling for MCP tool invocations. Provide informative error messages to the user, and log errors for debugging. Consider implementing retry mechanisms for transient errors.
  - ✗ Not found: tool call errors are surfaced, but no logging or retry for tool invocations in `src/lib/agent/mcporter.ts:501`.
- [ ] If a tool returns an error code, the agent should display the error message from the tool to the user. The agent will parse the `error` or `errorMessage` field from the JSON response (if present) or display the entire response as an error message if no specific error field is found. Example error message: `Tool X returned an error: [Error Message]`. If the response is not JSON the whole body will be displayed.
  - ✗ Not found: tool responses are not inspected for `error`/`errorMessage`; only thrown errors are parsed (`src/lib/agent/mcporter.ts:506`).
- [ ] Implement validation checks on the responses received from MCP tools, ensuring that the data is in the expected format and does not contain any malicious content. Sanitize the data before displaying it to the user, using a library specifically designed for XSS prevention, such as DOMPurify. Use asynchronous operations (e.g., promises, async/await) for MCP tool invocations to avoid blocking the agent.
  - ✗ Partial: sanitization/async exist, but no response shape validation or malicious content checks beyond DOMPurify (`src/lib/agent/mcporter.ts:506`).
- [x] Implement output validation and sanitization to prevent XSS. Always sanitize user inputs before including them in error messages displayed to the user. Use a library specifically designed for XSS prevention, such as DOMPurify.
  - ✓ Verified: DOMPurify used in `sanitizeOutput` and applied in `emitOutput`/error output (`src/lib/agent/mcporter.ts:96`, `src/lib/agent/mcporter.ts:200`, `src/lib/agent/mcporter.ts:691`).

## Implementation Notes

**File locations:**
- Agent implementation: `src/lib/agent/mcporter.ts`
- MCP server validation: `src/lib/agent/mcp-server-validator.ts`
- Model registry: `src/lib/agent/model-registry.ts` (defines `MCPORTER_MODELS`)
- Types: `src/lib/agent/types.ts` (includes `MCPorterMessageData`)
- Manager integration: `src/lib/agent/manager.ts` (line 324-331)
- Exports: `src/lib/agent/index.ts` (exports MCPorter agent and validator)

**Key implementation details:**
- Uses **Vercel AI SDK** (`ai` package) with `generateText()` for LLM orchestration
- Uses **Google Gemini** as the reasoning LLM (gemini-2.0-flash default)
- Uses **Zod** for schema-based input validation within tool definitions
- Uses **isomorphic-dompurify** for XSS sanitization (Node + browser compatible)
- Implements connection pooling with `mcp-server-validator.ts` utilities
- Has comprehensive test coverage in `__tests__/mcp-server-validator.test.ts`

## Verification Results
- Tests: `npx vitest run src/lib/agent/__tests__/mcp-server-validator.test.ts` failed due to network error (ENOTFOUND registry.npmjs.org); vitest not available locally.
- Incomplete items: cache invalidation on config change, strict input validation/whitelisting, comprehensive tool invocation error handling with logging/retry, tool error response parsing, response validation beyond sanitization.