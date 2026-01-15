# 2: Model Registry

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

- [x] Define `MCPORTER_MODELS` array in `model-registry.ts`
- [x] Add to `MODEL_REGISTRY` record
- [x] Set default model (Gemini 2.0 Flash or configurable)

## Notes

All items already implemented in `src/lib/agent/model-registry.ts`:
- `MCPORTER_MODELS` array (lines 233-259) with 3 Gemini models
- Added to `MODEL_REGISTRY` at line 274
- Default: Gemini 2.0 Flash (1M context, `isDefault: true`)
- Context limit fallback added at line 336
- `AgentType` in `types.ts` includes `"mcporter"`
