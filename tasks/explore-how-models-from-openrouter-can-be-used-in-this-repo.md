# explore how models from openrouter can be used in this repo

## Problem Statement
Need OpenRouter model path in current agent stack. Decide integration route (OpenCode provider vs AI SDK), auth and model wiring.

## Scope
**In:**
- OpenCode model parsing in `src/lib/agent/opencode.ts` and `src/lib/agent/cli-runner.ts`
- Model registry and defaults in `src/lib/agent/model-registry.ts` and `src/lib/agent/config.ts`
- Model pass-through in `src/lib/agent/manager.ts`, `src/daemon/agent-daemon.ts`, `src/trpc/tasks.ts`
- Model selection UI in `src/components/tasks/implement-modal.tsx` and `src/routes/settings/index.tsx`
- Env/docs/deps in `.env`, `src/lib/server/env.ts`, `README.md`, `package.json`
- AI SDK provider usage in `src/lib/agent/gemini.ts` and `src/lib/debate/orchestrator.ts`
**Out:**
- No changes to `src/lib/agent/cerebras.ts`
- No changes to `src/lib/agent/git-worktree.ts`

## Implementation Plan

### Phase: Model Flow Audit
- [x] Trace model defaults in `src/lib/agent/model-registry.ts`
- [x] Trace UI selection and state in `src/components/tasks/implement-modal.tsx` and `src/lib/stores/tasks-reducer.ts`
- [x] Trace model propagation in `src/lib/hooks/use-task-agent-actions.ts` and `src/trpc/tasks.ts`
- [x] Trace daemon/agent usage in `src/daemon/agent-daemon.ts` and `src/lib/agent/opencode.ts`

### Phase: Provider Feasibility
- [x] Check OpenRouter provider docs in `node_modules/ai/docs/02-foundations/02-providers-and-models.mdx`
- [x] Review AI SDK usage pattern in `src/lib/agent/gemini.ts`
- [x] Review OpenCode model flag handling in `src/lib/agent/cli-runner.ts`
- [x] Decide model ID format and provider naming in `src/lib/agent/model-registry.ts`

### Phase: Proposed Changes
- [x] Draft OpenRouter model entries in `src/lib/agent/model-registry.ts`
- [x] Draft model list updates in `src/lib/agent/config.ts` and `src/routes/settings/index.tsx`
- [x] Draft env key wiring in `src/lib/server/env.ts` and `.env`
- [x] Draft dependency changes in `package.json`
- [x] Draft doc updates in `README.md`

## Key Files
- `src/lib/agent/model-registry.ts` - add OpenRouter model entries, provider label
- `src/lib/agent/opencode.ts` - confirm model format pass-through
- `src/lib/agent/cli-runner.ts` - confirm `--model` wiring for OpenCode CLI
- `src/lib/agent/config.ts` - expose OpenRouter models to UI
- `src/routes/settings/index.tsx` - default model selection UI
- `src/components/tasks/implement-modal.tsx` - model selection UI
- `src/lib/server/env.ts` - OpenRouter env key loading
- `README.md` - env/docs update
- `package.json` - OpenRouter provider dependency, if needed

## Success Criteria
- [x] OpenRouter integration path chosen and recorded
- [x] Model ID format and provider naming defined for OpenRouter
- [x] File list for implementation ready with exact touch points

## Findings

### Model Flow (Phase 1)
**Model Registry** (`src/lib/agent/model-registry.ts`):
- Central registry maps AgentType → ModelDefinition[]
- Each model has: id, name, description, contextLimit, agentType, provider
- OpenCode models use `provider/model` format (e.g., `anthropic/claude-opus-4-5-20251101`)
- Default models marked with `isDefault: true` flag

**UI Selection** (`src/components/tasks/implement-modal.tsx`, `src/lib/stores/tasks-reducer.ts`):
- Users select agent type (claude, codex, opencode, cerebras, gemini, mcporter)
- Users then select model from dropdown (per-agent models via `getModelsForAgentType()`)
- State propagates: UI → reducer → mutation → daemon
- Auto-resets model to default when agent type changes

**Model Propagation**:
- UI: `implement-modal.tsx` → `use-task-agent-actions.ts` → tRPC mutation
- tRPC: `tasks.ts` endpoints (assignToAgent, createWithAgent, verifyWithAgent) accept `model?: string`
- Daemon: `agent-daemon.ts` passes model to agent constructors
- Agent: `opencode.ts` parses `model` as `provider/model`, passes to SDK

**OpenCode Agent** (`src/lib/agent/opencode.ts:76-81`):
- Accepts model in `provider/model` format
- Parses into `{ providerID, modelID }` on lines 76-81
- Passes to `@opencode-ai/sdk` client.session.prompt() body

**CLI Runner** (`src/lib/agent/cli-runner.ts:678-680`):
- OpenCode CLI: `opencode run --format json --model <model>`
- Model passed directly to CLI via `--model` flag

### Provider Feasibility (Phase 2)

**OpenRouter AI SDK Provider EXISTS**:
- Package: `@openrouter/ai-sdk-provider` (v1.5.4, Dec 2025)
- 300+ models via OpenRouter gateway
- Compatible with Vercel AI SDK v5+ (same pattern as `@ai-sdk/google`)
- 162 projects using it in npm registry
- Docs: https://openrouter.ai/docs/guides/community/vercel-ai-sdk

**Two Integration Paths**:

1. **Path A: OpenCode Provider** (model string pass-through)
   - OpenCode SDK already supports provider/model format
   - OpenRouter models would use format: `openrouter/anthropic/claude-3.5-sonnet`
   - Requires OpenCode to have OpenRouter provider support (unclear from docs)
   - **Pro**: No code changes to agent/daemon
   - **Con**: Uncertain if OpenCode SDK supports OpenRouter provider

2. **Path B: AI SDK Provider** (new agent type)
   - Install `@openrouter/ai-sdk-provider`
   - Create `src/lib/agent/openrouter.ts` (clone of `gemini.ts`)
   - Add `openrouter` to AgentType union
   - Model format: standard model IDs (e.g., `anthropic/claude-3.5-sonnet`)
   - **Pro**: Direct control, proven pattern (Gemini uses AI SDK)
   - **Con**: ~450 lines of boilerplate (but copy-paste from gemini.ts)

**Recommendation**: **Path B (AI SDK Provider)** is safer and more maintainable.

**Environment**:
- Env var: `OPENROUTER_API_KEY`
- Get from: https://openrouter.ai/keys

**Popular OpenRouter Models** (suggested defaults):
- `anthropic/claude-3.5-sonnet` (balanced, default)
- `anthropic/claude-opus-4` (most capable)
- `openai/gpt-4-turbo` (fast)
- `meta-llama/llama-3.1-405b-instruct` (open source)
- `google/gemini-2.0-flash-exp` (fast multimodal)

### Proposed Changes (Phase 3)

**1. Install dependency**:
```bash
npm install @openrouter/ai-sdk-provider
```

**2. Add `openrouter` agent type**:
- `src/lib/agent/types.ts`: Add `"openrouter"` to AgentType union

**3. Create OpenRouter agent** (`src/lib/agent/openrouter.ts`):
- Clone `gemini.ts` (~450 lines)
- Import `openrouter` from `@openrouter/ai-sdk-provider`
- Replace `google(this.model)` with `openrouter(this.model, { apiKey: process.env.OPENROUTER_API_KEY })`
- Update system prompt, class name, session ID prefix

**4. Update model registry** (`src/lib/agent/model-registry.ts`):
```typescript
const OPENROUTER_MODELS: ModelDefinition[] = [
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet (OpenRouter)",
    description: "Balanced performance",
    contextLimit: 200_000,
    agentType: "openrouter",
    provider: "OpenRouter",
    isDefault: true,
  },
  // ... more models
]

const MODEL_REGISTRY: Record<AgentType, ModelDefinition[]> = {
  // ...
  openrouter: OPENROUTER_MODELS,
}
```

**5. Update daemon** (`src/daemon/agent-daemon.ts`):
- Add `"openrouter"` case in `createAgent()` matcher
- Instantiate `OpenRouterAgent` with options

**6. Update UI labels** (`src/lib/agent/config.ts`):
```typescript
export const agentTypeLabel: Record<AgentType, string> = {
  // ...
  openrouter: 'OpenRouter',
}
```

**7. Environment** (`src/lib/server/env.ts`, `.env`):
- Add `OPENROUTER_API_KEY` validation
- Document in `.env.example`

**8. Update CLI availability** (`src/lib/agent/cli-runner.ts`):
- Add OpenRouter check in `getAvailableAgentTypes()`:
```typescript
if (process.env.OPENROUTER_API_KEY?.trim()) {
  types.push("openrouter")
}
```

**9. Documentation** (`README.md`):
- Add OpenRouter to agent types table
- Document OPENROUTER_API_KEY requirement
- Link to https://openrouter.ai/keys

## Resolved Questions
- ✅ OpenRouter path: AI SDK provider (`@openrouter/ai-sdk-provider`) - new agent type
- ✅ OpenRouter auth: `OPENROUTER_API_KEY` env var
- ✅ Target models: Use OpenRouter model IDs directly (e.g., `anthropic/claude-3.5-sonnet`)
- ✅ Implementation: Clone Gemini agent pattern (~450 lines, well-tested)
