# Explore: MCP Integration via Vercel AI SDK

<!-- taskId: Wbruvr_5Dv -->

<!-- autoRun: false -->

## Problem Statement
MCP tool integration aligned with Vercel AI SDK stack used by Gemini/OpenRouter. Drop official MCP SDK assumptions; use `@ai-sdk/mcp` client. Per-session config + settings UI.

## Scope
**In:**
- `@ai-sdk/mcp` client for tool discovery and lifecycle
- MCP config types + session persistence
- MCP tool merge for Gemini/OpenRouter agents
- Settings UI + storage for MCP servers
- Tool safety checks using existing validators

**Out:**
- MCP server implementation
- `@modelcontextprotocol/sdk` usage
- Dedicated MCP agent type
- Non-stdio/HTTP transports

## Implementation Plan

### Phase: Dependencies & Types
- [x] Add `@ai-sdk/mcp` to `package.json`
- [x] Add MCP config types to `src/lib/agent/types.ts`
- [x] Extend `AgentSessionSchema` with MCP config in `src/lib/agent/session-schema.ts`

### Phase: MCP Tools Helper
- [x] Create `src/lib/agent/mcp-tools.ts` using `createMCPClient`
- [x] Map MCP tools to `ToolDefinition` in `src/lib/agent/mcp-tools.ts`
- [x] Normalize MCP tool results to `ToolResult` in `src/lib/agent/mcp-tools.ts`
- [x] Apply path/command safeguards in `src/lib/agent/mcp-tools.ts`
- [x] Close MCP clients on session end in `src/lib/agent/mcp-tools.ts`

### Phase: Agent Wiring
- [x] Merge MCP tools into `createTools()` in `src/lib/agent/gemini.ts`
- [x] Merge MCP tools into `createTools()` in `src/lib/agent/openrouter.ts`
- [x] Define tool name collision policy in `src/lib/agent/mcp-tools.ts`

### Phase: Session + UI
- [x] Pass MCP config through spawn/resume in `src/trpc/agent.ts`
- [x] Persist MCP settings in `src/lib/stores/settings.ts`
- [x] Add MCP settings UI in `src/components/settings/mcp-servers-section.tsx`
- [x] Wire MCP settings page in `src/routes/settings/agent-defaults.tsx`

## Key Files
- `package.json` - add `@ai-sdk/mcp`
- `src/lib/agent/types.ts` - MCP config types
- `src/lib/agent/session-schema.ts` - MCP config schema
- `src/lib/agent/mcp-tools.ts` - MCP client wrapper
- `src/lib/agent/gemini.ts` - tool merge
- `src/lib/agent/openrouter.ts` - tool merge
- `src/trpc/agent.ts` - config threading
- `src/lib/stores/settings.ts` - MCP settings persistence
- `src/components/settings/mcp-servers-section.tsx` - settings UI (new file)
- `src/routes/settings/agent-defaults.tsx` - settings page wiring
- `src/daemon/agent-daemon.ts` - daemon config with MCP

## Success Criteria
- [x] Agents load MCP tools via `@ai-sdk/mcp` when config present
- [x] MCP tools work alongside built-ins with `ToolResult` formatting
- [x] Session data persists MCP config and reloads cleanly
- [x] Settings UI saves MCP server configs and survives refresh

## Implementation Notes

### Tool Name Collision Policy
MCP tools are prefixed with `mcp_{serverId}_{toolName}` to avoid collisions with built-in tools (read_file, write_file, exec_command).

### Security Safeguards
MCP tools inherit the existing security framework:
- Path validation via `validatePath()` for file operations
- Dangerous command blocking via `SecurityConfig.DANGEROUS_COMMANDS`
- Working directory isolation via worktree paths

### Before Running
Run `npm install` to install `@ai-sdk/mcp` dependency.

### Testing
1. Add an MCP server in Settings > Agent Defaults (scroll down to "MCP Servers")
2. Example: Name="filesystem", Command="npx", Args="-y @modelcontextprotocol/server-filesystem /tmp"
3. Spawn a Gemini or OpenRouter agent - should see "Connected to MCP servers: ..." message
4. MCP tools will appear with prefix like `mcp_filesystem_read_file`
