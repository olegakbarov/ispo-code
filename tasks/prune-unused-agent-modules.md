# Prune or Wire Unused Agent Modules

## Problem Statement
Several agent modules are unused in the current architecture (legacy or duplicate types and tools), increasing maintenance cost and confusion.

## Scope
- In scope: either remove unused modules or wire them into current flows with tests.
- Out of scope: large refactors of agent APIs.

## Implementation Plan
- [ ] Audit usage of `src/agent/types.ts`, `src/lib/agent/tools.ts`, `src/lib/agent/path-validator.ts`, and `src/lib/skills/*`.
- [ ] Decide per module: delete, or integrate into the current durable-streams or agent pipeline.
- [ ] Update imports and exports and remove dead code paths.

## Key Files
- `src/agent/types.ts`
- `src/lib/agent/tools.ts`
- `src/lib/agent/path-validator.ts`
- `src/lib/skills/registry.ts`
- `src/lib/skills/types.ts`

## Testing
- [ ] Run TypeScript build and ensure no dead imports remain.
- [ ] Smoke test agent spawn paths.

## Success Criteria
- [ ] No unused agent modules remain without a clear owner.
