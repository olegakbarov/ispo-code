# Deduplicate Agent Config in Tasks UI

## Problem Statement
Agent config constants are duplicated in `src/lib/agent/config.ts` and `src/components/tasks/agent-config.ts`, risking drift.

## Scope
- In scope: single source of truth for agent labels, model lists, and task review markers.
- Out of scope: changing model lists.

## Implementation Plan
- [x] Move task UI to import config from `src/lib/agent/config.ts` (or consolidate to a shared module).
  - ✓ Verified: 5 files now import from `@/lib/agent/config`: `task-footer.tsx`, `index.ts`, `review-modal.tsx`, `create-task-modal.tsx`, `task-sidebar.tsx`
- [x] Remove the duplicate file and update imports.
  - ✓ Verified: `src/components/tasks/agent-config.ts` no longer exists (glob returned no files)
  - ✓ Verified: No imports reference `agent-config` in task components

## Key Files
- `src/lib/agent/config.ts` - Central config, now exports `PlannerAgentType` for task UI
- ~~`src/components/tasks/agent-config.ts`~~ - Deleted
- `src/components/tasks/task-editor.tsx`
- `src/components/tasks/create-task-modal.tsx`

## Testing
- [x] Verify tasks UI renders model list and labels correctly (build passes).
  - ✓ Verified: `npm run build` completes successfully with no errors

## Success Criteria
- [x] Single source of truth for agent config values.
  - ✓ Verified: `src/lib/agent/config.ts` exports all required items:
    - `PlannerAgentType`, `CorePlannerAgentType` types
    - `agentTypeLabel` constant
    - `TASK_REVIEW_OUTPUT_START`, `TASK_REVIEW_OUTPUT_END` markers
    - Model lists: `CLAUDE_MODELS`, `CODEX_MODELS`, `OPENCODE_MODELS`, `GEMINI_MODELS`, `CEREBRAS_MODELS`
    - Helper functions: `getModelsForAgentType`, `supportsModelSelection`, `extractTaskReviewOutput`

## Implementation Notes
- Consolidated `PlannerAgentType` into central config as `AgentType` (all agents can plan tasks)
- Added `CorePlannerAgentType` alias for the restricted type (excludes cerebras/gemini) if needed elsewhere
- Updated 6 files to import from `@/lib/agent/config` instead of local `agent-config.ts`
- Deleted `src/components/tasks/agent-config.ts`

## Verification Results
| Item | Status | Evidence |
|------|--------|----------|
| Task UI imports from central config | ✓ Pass | 5 task component files import from `@/lib/agent/config` |
| Duplicate file removed | ✓ Pass | `src/components/tasks/agent-config.ts` not found |
| No stale imports | ✓ Pass | grep for `agent-config` returned no matches |
| Build passes | ✓ Pass | `npm run build` completed in ~4s with no errors |
| All exports present | ✓ Pass | Central config exports types, labels, model lists, and helpers |

**Overall: All items verified complete ✓**