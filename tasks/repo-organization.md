# Improve Repository Organization

## Problem Statement

The codebase has grown organically with some structural inconsistencies:
- Duplicate types file in two locations
- Mixed concerns in `lib/agent/` (implementations, services, stores, tools)
- Daemon code separated from related agent infrastructure

## Scope

**In scope:**
- Consolidate duplicate files
- Reorganize `lib/agent/` directory
- Move daemon code closer to agent infrastructure
- Update all imports

**Out of scope:**
- Changing API contracts
- Modifying component structure (already improved)
- Renaming tRPC procedures

## Current Issues

| Issue | Location |
|-------|----------|
| Duplicate types file | `src/agent/types.ts` vs `src/lib/agent/types.ts` |
| Mixed concerns in `lib/agent/` | Implementations, services, stores, tools together |
| Daemon code separated | `src/daemon/` is agent-related but isolated |

## Implementation Plan

### Phase 1: Quick Wins

- [ ] Delete `src/agent/types.ts` (consolidate into `lib/agent/types.ts`)
- [ ] Update any imports referencing the deleted file

### Phase 2: Group Agent Implementations

- [ ] Create `src/lib/agent/implementations/` directory
- [ ] Move `cerebras.ts` → `implementations/cerebras.ts`
- [ ] Move `opencode.ts` → `implementations/opencode.ts`
- [ ] Move `cli-runner.ts` → `implementations/cli-runner.ts`
- [ ] Create `implementations/index.ts` barrel export
- [ ] Update imports in `manager.ts` and elsewhere

### Phase 3: Consolidate Daemon

- [ ] Move `src/daemon/` → `src/lib/agent/daemon/`
- [ ] Update imports in `trpc/tasks.ts` and `trpc/agent.ts`
- [ ] Update any other references

### Phase 4: (Optional) Features-based Structure

Consider restructuring to:
```
src/features/
├── agents/
│   ├── implementations/
│   ├── daemon/
│   ├── manager.ts
│   └── types.ts
├── tasks/
│   └── task-service.ts
└── git/
    └── git-service.ts
```

## Key Files to Modify

- `src/lib/agent/manager.ts` - imports agent implementations
- `src/trpc/agent.ts` - imports daemon, manager
- `src/trpc/tasks.ts` - imports daemon, task-service
- `src/lib/agent/index.ts` - barrel exports

## Testing Approach

1. Run `npm run build` after each phase
2. Verify dev server starts: `npm run dev`
3. Test agent creation and task management in UI

## Success Criteria

- [ ] No duplicate type definitions
- [ ] Agent implementations grouped in dedicated folder
- [ ] Daemon code colocated with agent infrastructure
- [ ] All imports updated and build passes
- [ ] No runtime errors
