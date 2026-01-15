# add QA agent using mcporter https://github.com/steipete/mcporter

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

### Phase 1: Dependencies & Types
- [ ] Install `mcporter` package
- [ ] Add `"mcporter"` to `AgentType` union in `types.ts`
- [ ] Add `mcporterMessages` to `AgentSession` for resumption
- [ ] Update `agentTypeSchema` in `trpc/agent.ts`

### Phase 2: Model Registry
- [ ] Define `MCPORTER_MODELS` array in `model-registry.ts`
- [ ] Add to `MODEL_REGISTRY` record
- [ ] Set default model (Gemini 2.0 Flash or configurable)

### Phase 3: Agent Implementation
- [ ] Create `src/lib/agent/mcporter.ts`
- [ ] Implement `MCPorterAgent` class extending `EventEmitter`
- [ ] Use `createRuntime()` for MCP server connection pooling
    - [ ] Implement error handling for `createRuntime()`, including connection failures and invalid configuration.
        - [ ] If the MCP server is unavailable, the agent should display an error message: "Failed to connect to MCP server. Please check your configuration and network connection."
    - [ ] Implement retry mechanisms for transient connection errors.
- [ ] Implement tool discovery via `runtime.listTools()`
    - [ ] Implement caching of tool definitions with a TTL (Time To Live) and invalidating the cache when the MCPorter configuration file changes. Default TTL: 60 seconds.
    - [ ] Provide a mechanism to manually refresh the tool definitions cache.
    - [ ] Refresh the MCP tool list for each turn.
- [ ] Build dynamic tool definitions from discovered MCP tools
- [ ] QA-focused system prompt (test, validate, verify patterns)
- [ ] Implement `run()`, `abort()`, `getMessages()` methods
    - [ ] Implement strict, schema-based input validation and sanitization before passing any user-provided data to the MCP tools, using a library designed for input validation (e.g., `joi`, `yup`). Define a whitelist of allowed characters and data formats.
    - [ ] Implement comprehensive error handling for MCP tool invocations. Provide informative error messages to the user, and log errors for debugging. Consider implementing retry mechanisms for transient errors.
        - [ ] If a tool returns an error code, the agent should display the error message from the tool to the user. The agent will parse the `error` or `errorMessage` field from the JSON response (if present) or display the entire response as an error message if no specific error field is found. Example error message: `Tool X returned an error: [Error Message]`. If the response is not JSON the whole body will be displayed.
    - [ ] Implement validation checks on the responses received from MCP tools, ensuring that the data is in the expected format and does not contain any malicious content. Sanitize the data before displaying it to the user, using a library specifically designed for XSS prevention, such as DOMPurify. Use asynchronous operations (e.g., promises, async/await) for MCP tool invocations to avoid blocking the agent.
    - [ ] Implement output validation and sanitization to prevent XSS. Always sanitize user inputs before including them in error messages displayed to the user. Use a library specifically designed for XSS prevention, such as DOMPurify.

### Phase 4: Manager Integration
- [ ] Add `case "mcporter"` to `runAgent()` switch in `manager.ts`
- [ ] Export from `index.ts`
- [ ] Add availability check in `cli-runner.ts`
    - [ ] Check for `mcporter.json` existence, valid JSON format, and at least one valid server definition.
        - [ ] Add error handling to report specific errors like 'Invalid JSON format', 'Missing server configuration', or 'Invalid server address' to the user, guiding them to correct their mcporter.json file.
    - [ ] Implement validation of the MCP server configurations loaded from `~/.mcporter/mcporter.json`. This should include verifying the server's address and checking for known malicious patterns.
- [ ] Implement a robust authorization mechanism that verifies user permissions before invoking any MCP tool. Authorization will be based on user roles and permissions configured in the MCP server. The agent will query the MCP server to determine if the current user has permission to invoke the requested tool. Ensure that authorization checks are performed on the server-side to prevent bypassing on the client-side.

### Phase 5: UI Integration
- [ ] Add `mcporter` entry to `agentLabels` in `src/routes/index.tsx`
- [ ] Label: "QA Agent" / Description: "MCP-powered QA tools"
- [ ] Shows in agent type selector when MCPorter available

## Key Files
- `src/lib/agent/types.ts` - add AgentType
- `src/lib/agent/model-registry.ts` - add models
- `src/lib/agent/mcporter.ts` - new agent implementation
- `src/lib/agent/manager.ts` - register in runAgent switch
- `src/lib/agent/index.ts` - exports
- `src/lib/agent/cli-runner.ts` - availability check
- `src/trpc/agent.ts` - schema update
- `src/routes/index.tsx` - add to agent selector UI

## Technical Notes
- MCPorter auto-discovers servers from `~/.mcporter/mcporter.json`, Cursor, Claude configs
    - [ ] Implement robust validation of the MCP server configurations loaded from `~/.mcporter/mcporter.json`. This should include verifying the server's address and checking for known malicious patterns.
        - [ ] Server address validation: The server address must be a valid URL, starting with `http://` or `https://`, and the hostname must be reachable via DNS lookup.
        - [ ] Malicious pattern detection: Implement a blacklist of known malicious domains and IP addresses. Check the server address against this blacklist. Example: `127.0.0.1` will always be rejected.
    - [ ] Default to skipping servers requiring OAuth.
- Use `createServerProxy()` for ergonomic tool calls
- Runtime supports connection pooling - reuse across agent turns
    - [ ] Implement a maximum number of connections per MCP server and a maximum number of total connections.
    - [ ] Implement a mechanism to close idle connections after a certain period of inactivity.
        - [ ] Define a maximum number of connections per MCP server and a maximum number of total connections.
        - [ ] Implement a mechanism to close idle connections after a certain period of inactivity.
    - [ ] Use a connection pool library that provides these features.

## Input Validation and Sanitization
- Input validation will be implemented using `joi` library.
- Output sanitization will be implemented using `DOMPurify`.
- Allowed Characters/Data Formats:
    - Alphanumeric characters (a-z, A-Z, 0-9)
    - Common punctuation marks (. , ? ! - _ ')
    - Whitespace characters (space, tab, newline)
    - Specific data formats (e.g., email addresses, URLs) will be validated using regular expressions.
- Invalid input will be rejected with an error message indicating the specific validation failure. For example: "Invalid input: Parameter X must be a valid email address."

## Success Criteria
- [ ] QA agent appears in agent selector on `/` route
- [ ] Can spawn standalone session with user prompt
- [ ] Discovers available MCP tools on startup
    - [ ] Handle the case where no tools are discovered gracefully.
    - [ ] If no MCP tools are discovered, the agent displays a message: "No MCP tools found. Please check your MCPorter configuration." and disables tool-related functionality.
- [ ] Can invoke MCP tools via natural language
    - [ ] Implement strict input validation and sanitization on the user's input before it's passed to the MCP tools.
    - [ ] Examples of successful invocations:
        - User: "Run tool X with parameter Y" - Expected: Tool X is invoked with parameter Y, and the result is returned to the user.
    - [ ] Examples of failed invocations:
        - User: "Run tool Z" (tool Z does not exist) - Expected: An error message is returned to the user indicating that the tool does not exist.
        - User: "Run tool X with invalid parameter Y" - Expected: An error message is returned to the user indicating that the parameter is invalid.
- [ ] Standard lifecycle works (run/abort/resume)
    - [ ] Verify that the agent session, including `mcporterMessages`, can be persisted and resumed correctly.
    - [ ] Verify that on resume, the agent retains the previous conversation history and MCP tool list. If resume fails, the agent should start a new session and display an appropriate error message.

## Test Cases for Error Scenarios
- [ ] User provides an invalid parameter to Tool X -> Agent displays an error message indicating the parameter is invalid.
- [ ] MCP Server is unavailable -> Agent displays "Failed to connect to MCP server" error.
- [ ] User attempts to invoke a tool without proper authorization -> Agent displays an "Unauthorized" error message.
- [ ] MCP tool returns an unexpected error code -> Agent displays the error message from the tool to the user.

## Resource Limits

- [ ] Implement rate limiting and quotas for LLM usage (number of tokens, requests per user/session).
    - [ ] Define concrete rate limiting policies for LLM usage, including limits on the number of requests per user or session, the number of tokens per request, and the total token usage per time period. Implement monitoring and alerting for exceeding rate limits. Consider using a rate limiting library or service.
        - Rate Limiting Policies:
            - Maximum 10 requests per user per minute.
            - Maximum 1000 tokens per request.
            - Maximum 10,000 tokens per user per minute.
    - [ ] Monitor LLM usage patterns to identify potential abuse.
        - [ ] Metrics to be tracked: Number of requests per user, number of tokens per request, total token usage per user per minute.
        - [ ] Actions to be taken if abuse is detected: Temporary account suspension (e.g., 15 minutes) for exceeding rate limits. Permanent account suspension for repeated violations.

## Test Environment Configuration
- [ ] Specify how the `mcporter.json` configuration file will be managed in the test environment.
- [ ] Provide detailed instructions on how to create and manage a test `mcporter.json` file, including sample configurations. Also, specify how to start and stop mock MCP servers for testing purposes, and how to clean up any created resources after tests complete.
- [ ] Provide a default configuration file for testing purposes.
- [ ] Add tests to verify that the agent correctly parses and uses the configuration file, including handling of invalid or missing entries.

## Unresolved Questions
1. Which LLM backs reasoning? (Gemini 2.0 Flash default? Configurable?)
    - Default: Gemini 2.0 Flash. Configuration details (if configurable) will be documented in the configuration section.
    - If Gemini 2.0 Flash is unavailable, the agent will display an error message to the user: "Gemini 2.0 Flash is currently unavailable. Please try again later."
2. MCP tool discovery - once at spawn or refresh each turn?
    - Refresh the MCP tool list for each turn.
3. Should skip servers requiring OAuth or prompt user?
    - Default to skipping servers requiring OAuth.

## Configuration
- [ ] Define a configuration option for the default LLM.
- [ ] The default LLM can be configured via the `DEFAULT_LLM` environment variable and the agent uses the configured LLM.
- [ ] Test case: Setting an invalid LLM via the `DEFAULT_LLM` environment variable will cause the agent to fallback to Gemini 2.0 Flash and log an error.

## Security Considerations
- [ ] Implement a secure secrets management system for storing and accessing API keys or passwords from the MCP server configurations. Consider using a dedicated secrets manager like HashiCorp Vault or cloud-provider specific secrets services. Avoid storing secrets in plain text in configuration files. Encrypt the secrets at rest and in transit. Implement least privilege access controls for accessing the secrets.
    - Recommended Secrets Manager: HashiCorp Vault.
    - Store MCP server credentials securely in Vault, encrypting them at rest and in transit.
    - Implement least privilege access controls for accessing the secrets, granting only necessary permissions to the agent.

## Monitoring and Logging
- [ ] Implement comprehensive logging to track MCP tool invocations, errors, and performance metrics. Use a centralized logging system for analysis and alerting. Instrument the code with metrics to monitor resource usage and application health.
    - Metrics to be monitored:
        - Response times for MCP tool invocations.
        - Error rates for MCP tool invocations.
        - CPU and memory utilization of the agent.
    - Logging format: JSON.
    - Logs will be aggregated and analyzed using [Specify Logging tool, e.g. ELK stack, Splunk].

## Connection Pooling
- Connection pooling for MCP servers will be implemented using the `node-pool` library.
- Maximum number of connections per MCP server: 5.
- Maximum total number of connections: 20.
- Idle connection timeout: 30 seconds.

## Authorization Mechanism
- The authorization mechanism will use API keys for authentication.
- The agent will cache user permissions for 5 minutes to reduce round trips to the MCP server.
- If the MCP server is unavailable or authorization fails, the agent will display an "Unauthorized" error message to the user.

## Future Considerations
- Explore allowing users to select a different LLM within predefined limits (e.g., a list of allowed models).
- Consider validating MCP tool responses. These responses could potentially contain malicious content or unexpected data that could be harmful if not properly processed.
- Consider Asynchronous Operations for MCP Tool Invocations. MCP tool invocations can be long-running. Synchronous calls will block the agent and degrade performance.
- Add cleanup function that destroys the agent and removes any persisted data.