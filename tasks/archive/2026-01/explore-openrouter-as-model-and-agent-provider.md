# explore openrouter as model and agent provider

## Problem Statement
OpenRouter path chosen; integration missing.
Need agent type, model registry, UI lists, env/docs wiring.

## Scope
**In:**
- `src/lib/agent/types.ts`
- `src/lib/agent/cli-runner.ts`
- `src/lib/agent/openrouter.ts`
- `src/lib/agent/model-registry.ts`
- `src/lib/agent/config.ts`
- `src/lib/agent/manager.ts`
- `src/daemon/agent-daemon.ts`
- `src/trpc/tasks.ts`
- `src/components/tasks/implement-modal.tsx`
- `src/components/tasks/create-task-form.tsx`
- `src/components/settings/agent-defaults-section.tsx`
- `.env.example`
- `package.json`
- `README.md`

**Out:**
- `src/lib/agent/cerebras.ts`
- `src/lib/agent/git-worktree.ts`
- `.env`
- `src/lib/agent/__tests__/`
- `src/trpc/__tests__/`

## Implementation Plan

### Phase: Core Agent
- [x] Add `openrouter` to AgentType in `src/lib/agent/types.ts`
- [x] Gate availability on `OPENROUTER_API_KEY` in `src/lib/agent/cli-runner.ts`
- [x] Implement OpenRouter agent in `src/lib/agent/openrouter.ts`
- [x] Register OpenRouter models + defaults in `src/lib/agent/model-registry.ts`
- [x] Add OpenRouter label + model exports in `src/lib/agent/config.ts`
- [x] Wire OpenRouter in `src/lib/agent/manager.ts` and `src/daemon/agent-daemon.ts`

### Phase: API + UI
- [x] Add `openrouter` to agent type enums in `src/trpc/tasks.ts`
- [x] Add OpenRouter entry in `src/components/tasks/implement-modal.tsx`
- [x] Add OpenRouter to planner list in `src/components/tasks/create-task-form.tsx`
- [x] Add OpenRouter to defaults list in `src/components/settings/agent-defaults-section.tsx`

### Phase: Dependencies + Docs
- [x] Add `@ai-sdk/openai` dependency in `package.json` (already present)
- [x] Add `OPENROUTER_API_KEY` to `.env.example`
- [x] Document OpenRouter setup in `README.md`

## Key Files
- `src/lib/agent/types.ts` - agent type union
- `src/lib/agent/cli-runner.ts` - availability gating
- `src/lib/agent/openrouter.ts` - new agent implementation
- `src/lib/agent/model-registry.ts` - model list + defaults
- `src/lib/agent/config.ts` - labels + model exports
- `src/lib/agent/manager.ts` - agent factory wiring
- `src/daemon/agent-daemon.ts` - daemon spawn wiring
- `src/trpc/tasks.ts` - zod enums
- `src/components/tasks/implement-modal.tsx` - agent config map
- `src/components/tasks/create-task-form.tsx` - planner candidates
- `src/components/settings/agent-defaults-section.tsx` - defaults lists
- `.env.example` - env doc
- `package.json` - OpenAI provider dependency
- `README.md` - setup docs

## Success Criteria
- [x] `openrouter` appears in agent type UI when `OPENROUTER_API_KEY` set
- [x] OpenRouter models show in model picker with correct IDs
- [x] OpenRouter agent runs via manager/daemon without errors
- [x] Docs list `OPENROUTER_API_KEY` setup

## Unresolved Questions
- None
