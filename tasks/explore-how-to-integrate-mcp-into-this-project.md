# Explore: MCP Integration into ispo-code

<!-- autoRun: false -->

## Summary

MCP (Model Context Protocol) is an open standard by Anthropic for connecting AI models to external tools, resources, and prompts. This document explores integration approaches for ispo-code.

---

## Key Findings

### 1. MCP Overview

- **What it is**: Open protocol for standardized AI-tool communication
- **Core primitives**: Tools (actions), Resources (read-only data), Prompts (reusable templates)
- **Transport options**: HTTP/Streamable HTTP (production), Stdio (local dev)
- **Industry adoption**: OpenAI, Google DeepMind, Microsoft all adopted MCP in 2025

### 2. SDK Options

| Option | Package | Notes |
|--------|---------|-------|
| Official MCP SDK | `@modelcontextprotocol/sdk` | Full client/server implementation |
| Vercel AI SDK MCP | `@ai-sdk/mcp` | `createMCPClient()` for tool integration |

**Recommended**: Use `@ai-sdk/mcp` since ispo-code already uses Vercel AI SDK for Gemini/OpenRouter agents.

### 3. Previous Implementation (Removed)

The codebase previously had MCP via "MCPorter" agent:
- Files removed: `mcporter.ts`, `mcporter-config.ts`, `mcp-server-validator.ts`
- Commits: `ca2eb9e` (added) → `c0e314c` (removed)
- Features included: connection pooling, server validation, tool caching

---

## Integration Approaches

### Option A: MCP Tools for Existing Agents (Recommended)

Extend Gemini/OpenRouter agents to optionally load MCP tools alongside built-in tools.

**Pros**:
- Minimal new code
- Leverages existing agent infrastructure
- Users can enable MCP per-session

**Implementation**:
```typescript
// In gemini.ts or openrouter.ts
import { createMCPClient } from '@ai-sdk/mcp'

private async createTools() {
  const builtInTools = { read_file, write_file, exec_command }

  if (this.mcpConfig?.servers) {
    const mcpClient = await createMCPClient({
      transport: { type: 'http', url: this.mcpConfig.serverUrl }
    })
    const mcpTools = await mcpClient.tools()
    return { ...builtInTools, ...mcpTools }
  }

  return builtInTools
}
```

### Option B: Dedicated MCP Agent Type

Add new `mcp` agent type that exclusively uses MCP servers.

**Pros**:
- Clean separation of concerns
- MCP-native experience

**Cons**:
- Duplicates agent infrastructure
- Requires new model registry entries

### Option C: MCP as Global Tool Provider

Central MCP manager that provides tools to all agents.

**Pros**:
- Single configuration point
- Shared connection pool

**Cons**:
- More complex architecture
- All-or-nothing enablement

---

## Implementation Plan (Option A)

### Phase 1: Dependencies & Configuration

- [ ] Install `@ai-sdk/mcp` package
- [ ] Add MCP config types to `types.ts`
- [ ] Add settings for MCP servers in UI

### Phase 2: Tool Integration

- [ ] Create `mcp-tools.ts` helper for tool discovery
- [ ] Modify `GeminiAgent.createTools()` to merge MCP tools
- [ ] Modify `OpenRouterAgent.createTools()` similarly
- [ ] Ensure tool output wraps to `ToolResult` format

### Phase 3: Session Support

- [ ] Add `mcpConfig` field to `AgentSession`
- [ ] Pass MCP config through spawn/resume flow
- [ ] Handle MCP client lifecycle (close on session end)

### Phase 4: UI Integration

- [ ] Add MCP server config in settings
- [ ] Show MCP tool usage in session output
- [ ] Display MCP connection status

---

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@ai-sdk/mcp` dependency |
| `src/lib/agent/types.ts` | Add `MCPConfig` type, extend `AgentSession` |
| `src/lib/agent/gemini.ts` | Add MCP tool loading in `createTools()` |
| `src/lib/agent/openrouter.ts` | Same as gemini |
| `src/lib/agent/mcp-tools.ts` | New helper for MCP client management |
| `src/trpc/agent.ts` | Pass MCP config in spawn |

---

## Example MCP Configuration

```typescript
interface MCPConfig {
  servers: MCPServerConfig[]
}

interface MCPServerConfig {
  name: string
  transport: 'http' | 'stdio'
  url?: string           // For HTTP transport
  command?: string       // For stdio transport
  args?: string[]
  env?: Record<string, string>
}
```

---

## Security Considerations

1. **Path validation**: MCP tools that access files must respect worktree boundaries
2. **Command execution**: MCP tools running commands need same safeguards as `exec_command`
3. **Server trust**: Only allow configured/approved MCP servers
4. **Rate limiting**: MCP tool calls should count toward session rate limits

---

## Open Questions

1. Should MCP tools override built-in tools with same name, or error?
2. How to handle MCP server authentication (API keys, OAuth)?
3. Should MCP config be per-session or global setting?
4. How to handle MCP server unavailability mid-session?

---

## Resources

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vercel AI SDK MCP Docs](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [MCP Specification](https://modelcontextprotocol.io/docs/sdk)
- [MCP npm package](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

---

## Status: Exploration Complete

This task documents the MCP integration landscape. Implementation would follow Phase 1-4 above.
