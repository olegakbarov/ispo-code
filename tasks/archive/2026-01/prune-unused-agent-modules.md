# Prune or Wire Unused Agent Modules

## Problem Statement
Several agent modules are unused in the current architecture (legacy or duplicate types and tools), increasing maintenance cost and confusion.

## Scope
- In scope: either remove unused modules or wire them into current flows with tests.
- Out of scope: large refactors of agent APIs.

## Implementation Plan
- [x] Audit usage of `src/agent/types.ts`, `src/lib/agent/tools.ts`, `src/lib/agent/path-validator.ts`, and `src/lib/skills/*`.
  - Verified: `src/agent` and `src/lib/skills` directories are absent; `src/lib/agent/path-validator.ts` is referenced by `src/lib/agent/cerebras.ts:18`, `src/lib/agent/gemini.ts:17`, `src/lib/agent/tools.ts:8`; no code imports of `src/lib/agent/tools.ts`, `src/agent/types.ts`, or `src/lib/skills` found in `src/`.
- [x] Decide per module: delete, or integrate into the current durable-streams or agent pipeline.
  - Verified: deletions confirmed for `src/agent` and `src/lib/skills`; retained modules exist at `src/lib/agent/tools.ts` and `src/lib/agent/path-validator.ts`.
- [x] Update imports and exports and remove dead code paths.
  - Verified: `src/lib/agent/index.ts` does not export `runTool` or `TOOL_DEFINITIONS`; no imports of deleted modules found in `src/`.

## Audit Findings

### Deleted Modules ❌
1. **`src/agent/types.ts`** (150 lines) - Legacy duplicate of `src/lib/agent/types.ts`
   - Current version at `src/lib/agent/types.ts` is 296 lines and much more comprehensive
   - No imports found from the old version
   - **Action: DELETED**

2. **`src/lib/skills/*`** - Completely unused skills framework
   - `registry.ts` and `types.ts` had no actual usage anywhere
   - No skill implementations found in codebase
   - No imports or usage detected
   - **Action: DELETED entire directory**

### Kept Modules ✅
1. **`src/lib/agent/tools.ts`** (377 lines)
   - Implements file operations (read, write, edit, glob, grep, bash, ls) with security
   - Exported through `src/lib/agent/index.ts` but **no external consumers found**
   - **Action: KEPT (may be used for future agent implementations)**
   - Removed unused exports from barrel export

2. **`src/lib/agent/path-validator.ts`** (119 lines)
   - Actively used by: `cerebras.ts`, `gemini.ts`, `tools.ts`
   - Critical security component preventing path traversal attacks
   - **Action: KEPT (actively used)**

## Changes Made
- Deleted `src/agent/` directory (legacy types)
- Deleted `src/lib/skills/` directory (unused framework)
- Removed `runTool` and `TOOL_DEFINITIONS` exports from `src/lib/agent/index.ts`
- Preserved `tools.ts` and `path-validator.ts` as they provide value

## Key Files
- ~~`src/agent/types.ts`~~ DELETED
- `src/lib/agent/tools.ts` KEPT (no external usage, but functional)
- `src/lib/agent/path-validator.ts` KEPT (actively used)
- ~~`src/lib/skills/registry.ts`~~ DELETED
- ~~`src/lib/skills/types.ts`~~ DELETED

## Testing
- [x] Run TypeScript build and ensure no dead imports remain.
  - Verified: `npm run build` completed successfully (Vite build) with warnings only.
- [ ] Smoke test agent spawn paths (verified no references to deleted modules).
  - Not verified: no scripted smoke test or log found; only static inspection of `src/daemon/spawn-daemon.ts:12` and `src/daemon/agent-daemon.ts:26` shows imports from `src/lib/agent/types.ts`.

## Success Criteria
- [ ] No unused agent modules remain without a clear owner.
  - Not verified: `src/lib/agent/tools.ts` has no code consumers (only docs/tasks references), so an unused module remains.

## Verification Results
- Build succeeded via `npm run build` (warnings only).
- Smoke test for agent spawn paths not executed or recorded.
- `src/lib/agent/tools.ts` remains unused in code.