# 1: Dependencies & Types

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

- [x] Install `mcporter` package
  - ✓ Verified: `package.json:39` contains `"mcporter": "^0.7.3"`
- [x] Add `"mcporter"` to `AgentType` union in `types.ts`
  - ✓ Verified: `src/lib/agent/types.ts:4` - AgentType includes `"mcporter"`
- [x] Add `mcporterMessages` to `AgentSession` for resumption
  - ✓ Verified: `src/lib/agent/types.ts:234-237` - `MCPorterMessageData` interface defined
  - ✓ Verified: `src/lib/agent/types.ts:284` - `mcporterMessages?: MCPorterMessageData[]` in `AgentSession`
- [x] Update `agentTypeSchema` in `trpc/agent.ts`
  - ✓ Verified: `src/trpc/agent.ts:24` - schema includes `"mcporter"`

## Notes

All items were already implemented in the codebase:
- `mcporter` package: `package.json` line 39 (v0.7.3)
- `AgentType` union: `src/lib/agent/types.ts` line 4
- `MCPorterMessageData` interface: `src/lib/agent/types.ts` lines 234-237
- `mcporterMessages` in `AgentSession`: `src/lib/agent/types.ts` line 284
- `agentTypeSchema`: `src/trpc/agent.ts` line 24

## Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| Install `mcporter` package | ✅ PASS | `package.json:39` - `"mcporter": "^0.7.3"` |
| Add `"mcporter"` to `AgentType` | ✅ PASS | `types.ts:4` - type includes `"mcporter"` |
| Add `mcporterMessages` to `AgentSession` | ✅ PASS | `types.ts:284` - field exists with correct type |
| Update `agentTypeSchema` | ✅ PASS | `agent.ts:24` - zod enum includes `"mcporter"` |

**All 4 items verified complete.** No issues found.