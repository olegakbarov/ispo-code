# Deduplicate Agent Config in Tasks UI

## Problem Statement
Agent config constants are duplicated in `src/lib/agent/config.ts` and `src/components/tasks/agent-config.ts`, risking drift.

## Scope
- In scope: single source of truth for agent labels, model lists, and task review markers.
- Out of scope: changing model lists.

## Implementation Plan
- [ ] Move task UI to import config from `src/lib/agent/config.ts` (or consolidate to a shared module).
- [ ] Remove the duplicate file and update imports.

## Key Files
- `src/lib/agent/config.ts`
- `src/components/tasks/agent-config.ts`
- `src/components/tasks/task-editor.tsx`
- `src/components/tasks/create-task-modal.tsx`

## Testing
- [ ] Verify tasks UI renders model list and labels correctly.

## Success Criteria
- [ ] Single source of truth for agent config values.
