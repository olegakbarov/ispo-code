# remove mcporter everywhere

## Problem Statement
MCPorter agent removal across runtime and UI surface.
Drop dependency, schemas, tests to avoid dead paths.

## Scope
**In:**
- Remove MCPorter agent code and config validation
- Remove mcporter package and lockfile entries
- Remove mcporter from UI/CLI options and tRPC enums

**Out:**
- Replacement QA agent or feature parity work
- Edit archived task history under `tasks/archive/`

## Implementation Plan

### Phase: Core removal
- [x] Delete `src/lib/agent/mcporter.ts`
- [x] Delete `src/lib/agent/mcporter-config.ts`
- [x] Remove mcporter from agent types and session schema
- [x] Remove mcporter from model registry and limits
- [x] Remove mcporter paths in `src/lib/agent/manager.ts`
- [x] Remove mcporter availability checks in `src/lib/agent/cli-runner.ts`
- [x] Remove mcporter config validation in `src/lib/agent/mcp-server-validator.ts` (deleted file)
- [x] Remove mcporter CLI spawn options

### Phase: Surface + cleanup
- [x] Remove mcporter from UI agent selectors and defaults
- [x] Remove mcporter from tRPC schemas and task defaults
- [x] Delete mcporter tests and fixtures
- [x] Drop mcporter dependency from `package.json`
- [x] Clean mcporter from lockfiles and `README.md`

## Key Files
- `package.json` - removed mcporter dependency ✓
- `package-lock.json` - regenerated without mcporter ✓
- `src/lib/agent/mcporter.ts` - deleted ✓
- `src/lib/agent/mcporter-config.ts` - deleted ✓
- `src/lib/agent/mcp-server-validator.ts` - deleted (MCPorter-specific) ✓
- `src/lib/agent/index.ts` - removed exports ✓
- `src/lib/agent/types.ts` - removed mcporter type and MCPorterMessageData ✓
- `src/lib/agent/model-registry.ts` - removed mcporter models/limits ✓
- `src/lib/agent/manager.ts` - removed mcporter run path ✓
- `src/lib/agent/cli-runner.ts` - removed availability logic ✓
- `src/lib/agent/config.ts` - removed mcporter label ✓
- `src/lib/agent/metadata-analyzer.ts` - removed mcporter context limit ✓
- `src/trpc/agent.ts` - removed mcporter enum ✓
- `src/trpc/tasks.ts` - removed mcporter enums ✓
- `src/trpc/debate.ts` - removed mcporter enums ✓
- `src/components/settings/agent-defaults-section.tsx` - removed mcporter option ✓
- `src/components/tasks/create-task-form.tsx` - removed mcporter candidate ✓
- `src/components/tasks/implement-modal.tsx` - removed MCPorter config ✓
- `src/cli/commands/spawn.ts` - removed mcporter from valid agents ✓
- `src/cli/formatter.ts` - replaced mcporter color with openrouter ✓
- `src/lib/hooks/use-task-agent-type-sync.ts` - removed mcporter ✓
- `src/lib/hooks/use-task-data.ts` - removed mcporter ✓
- `README.md` - removed QA Agent mention ✓
- `src/lib/agent/__tests__/mcporter-agent.test.ts` - deleted ✓
- `src/lib/agent/__tests__/cli-runner.test.ts` - deleted ✓
- `src/lib/agent/__tests__/mcp-server-validator.test.ts` - deleted ✓
- `src/lib/agent/__tests__/test-utils.ts` - deleted ✓
- `src/lib/agent/__tests__/fixtures/mcporter.*.json` - deleted ✓

## Success Criteria
- [x] `rg -n mcporter src package*.json README.md` returns no matches
- [x] Build passes, no mcporter import or enum errors
- [x] Tests pass after mcporter suite removal

## Unresolved Questions
- Remove mcporter references in `tasks/archive/`? → Decided: Out of scope per plan

## Notes
- Also deleted `mcp-server-validator.ts` as it was MCPorter-specific infrastructure
- The linter helpfully refactored `types.ts` to use a const array pattern for AGENT_TYPES
