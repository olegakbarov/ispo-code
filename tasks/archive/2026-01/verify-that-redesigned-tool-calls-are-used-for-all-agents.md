# verify that redesigned tool calls are used for all agents

## Problem Statement
Confirm redesigned tool-call UI path used for all agent outputs.
Normalize tool_use payloads so tool name/input render and stats track correctly.

## Scope
**In:**
- tool_use rendering in `src/components/agents/output-renderer.tsx`, `src/components/agents/tool-call.tsx`, `src/components/agents/tool-call-v2.tsx`
- tool_use emission in `src/lib/agent/cli-runner.ts`, `src/lib/agent/cerebras.ts`, `src/lib/agent/gemini.ts`, `src/lib/agent/opencode.ts`, `src/lib/agent/mcporter.ts`
- tool_use parsing for stats in `src/lib/agent/metadata-analyzer.ts`

**Out:**
- new tool-call visuals or CSS work
- agent protocol changes beyond tool_use payload shape
- persistence/schema migrations

## Implementation Plan

### Phase: Audit
- [x] Trace tool_use render path in `src/components/agents/output-renderer.tsx`
- [x] Inventory tool_use payload format per agent in `src/lib/agent/cli-runner.ts`, `src/lib/agent/cerebras.ts`, `src/lib/agent/gemini.ts`, `src/lib/agent/opencode.ts`, `src/lib/agent/mcporter.ts`
- [x] Check tool_use parsing assumptions in `src/lib/agent/metadata-analyzer.ts`

### Phase: Align Payloads
- [x] Emit JSON `{ name, input }` for tool_use in `src/lib/agent/gemini.ts`
- [x] Emit JSON `{ name, input }` for tool_use in `src/lib/agent/mcporter.ts`
- [x] Add metadata fallback in `src/components/agents/output-renderer.tsx`
- [x] Add metadata fallback in `src/lib/agent/metadata-analyzer.ts`

### Phase: Verify UI
- [x] Confirm ToolCallV2 render in `src/components/agents/tool-call.tsx`
- [x] Spot-check gallery in `src/routes/tool-calls.tsx`

## Key Files
- `src/components/agents/output-renderer.tsx` - tool_use parse and fallback
- `src/lib/agent/gemini.ts` - tool_use payload format
- `src/lib/agent/mcporter.ts` - tool_use payload format
- `src/lib/agent/metadata-analyzer.ts` - tool_use parse fallback

## Success Criteria
- [x] tool_use from all agents renders ToolCallV2 with correct tool name
- [x] tool_use payloads parse as JSON for all agents
- [x] tool stats include tool_use for gemini and mcporter

## Open Questions
- Include MCPorter in "all agents" scope? **YES - MCPorter is included and fixed**
- Need to handle legacy sessions with non-JSON tool_use? **Handled via metadata fallbacks**

## Changes Made

### gemini.ts
- Changed `read_file` tool_use emission from plain text to JSON format
- Changed `write_file` tool_use emission from plain text to JSON format
- Changed `exec_command` tool_use emission from plain text to JSON format
- Added `toolName` to metadata alongside `tool`

### mcporter.ts
- Changed MCP tool_use emission from plain text to JSON format
- Added `toolName` to metadata alongside `tool`

### output-renderer.tsx
- Added `metadata?.toolName` fallback before `metadata?.tool` for consistency with metadata-analyzer.ts

## Audit Summary

| Agent | tool_use Format | Status |
|-------|-----------------|--------|
| Claude | `JSON.stringify({ name, input })` | Already correct |
| Codex | `JSON.stringify({ name, input })` | Already correct |
| OpenCode | `JSON.stringify({ name, input })` | Already correct |
| Cerebras | `JSON.stringify({ name, input })` | Already correct |
| Gemini | `JSON.stringify({ name, input })` | **Fixed** |
| MCPorter | `JSON.stringify({ name, input })` | **Fixed** |
