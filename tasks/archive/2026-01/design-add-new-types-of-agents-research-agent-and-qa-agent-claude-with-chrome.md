# design add new types of agents: research agent and QA agent (claude with --chrome)

## Problem Statement
Add Research + QA agent types. Claude CLI with `--chrome` for both. Consistent availability, labels, models across backend + UI workflows.

## Scope
**In:**
- Add `research` + `qa` agent types and labels
- Claude CLI mapping with `--chrome` for `research` + `qa`
- UI pickers, defaults, and availability lists across workflows

**Out:**
- New prompt templates or personas
- Browser automation beyond Claude CLI `--chrome`
- QA workflow or task state changes

## Implementation Plan

### Phase: Types + Registry
- [x] Add `research` + `qa` to `AGENT_TYPES` and `agentTypeSchema`
- [x] Add `research` + `qa` labels in `src/lib/agent/config.ts`
- [x] Add model registry entries + context defaults for `research` + `qa`

### Phase: CLI Wiring
- [x] Map `research` + `qa` to Claude CLI with `--chrome` in `src/lib/agent/cli-runner.ts`
- [x] Include new types in CLI availability checks in `src/lib/agent/cli-runner.ts` and `src/trpc/tasks.ts`
- [x] Treat `research` + `qa` as CLI agents in `src/lib/agent/manager.ts` and `src/daemon/agent-daemon.ts`

### Phase: UI Exposure
- [x] Add new types to planner/agent candidate lists in `src/components/tasks/create-task-form.tsx` and `src/lib/hooks/use-task-data.ts`
- [x] Update preferred-order lists in `src/lib/hooks/use-task-agent-type-sync.ts`
- [x] Update agent pickers in `src/components/git/diff-panel.tsx`, `src/components/tasks/implement-modal.tsx`, `src/components/settings/agent-defaults-section.tsx`

## Key Files
- `src/lib/agent/types.ts` - AgentType enum + schema
- `src/lib/agent/config.ts` - agent labels
- `src/lib/agent/model-registry.ts` - models + context defaults
- `src/lib/agent/cli-runner.ts` - CLI mapping + `--chrome` args
- `src/lib/agent/manager.ts` - CLI agent routing
- `src/daemon/agent-daemon.ts` - CLI agent routing
- `src/trpc/tasks.ts` - CLI availability validation
- `src/components/tasks/create-task-form.tsx` - planner candidates
- `src/components/tasks/implement-modal.tsx` - agent config list
- `src/components/git/diff-panel.tsx` - send-to-agent picker
- `src/components/settings/agent-defaults-section.tsx` - defaults lists
- `src/lib/hooks/use-task-agent-type-sync.ts` - preferred order defaults

## Success Criteria
- [x] Research + QA appear in agent selectors across workflows when Claude CLI available
- [x] Research + QA spawn Claude CLI with `--chrome`
- [x] Model selection + context limits work for new types without errors
