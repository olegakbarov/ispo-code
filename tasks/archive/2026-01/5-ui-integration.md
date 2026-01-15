# 5: UI Integration

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

- [x] Add `mcporter` entry to `agentLabels` in `src/routes/index.tsx`
  - ✓ Verified: `mcporter` entry present in `src/routes/index.tsx:38`
- [x] Label: "QA Agent" / Description: "MCP-powered QA tools"
  - ✓ Verified: label/description strings set in `src/routes/index.tsx:39`
- [x] Shows in agent type selector when MCPorter available
  - ✓ Verified: selector maps `Object.keys(agentLabels)` and availability comes from `trpc.agent.availableTypes.useQuery()` in `src/routes/index.tsx:52` and `src/routes/index.tsx:104`

## Notes

All items were already implemented in `src/routes/index.tsx`:
- Lines 38-41: `mcporter` entry in `agentLabels` with correct label/description
- Line 104: Agent selector iterates all `agentLabels` keys
- Line 52: Availability check via `trpc.agent.availableTypes.useQuery()`
- Agent appears when backend reports `mcporter` as available

## Verification Results
- All completed items verified in `src/routes/index.tsx`
- Tests not run (no test-related checklist items)