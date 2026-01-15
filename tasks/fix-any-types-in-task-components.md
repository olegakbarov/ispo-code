# Fix 'any' Types in Task Components

**Priority**: High
**Category**: Type Safety
**Status**: Completed

## Problem

`task-sidebar.tsx` and `task-footer.tsx` use `any` types extensively, losing type safety:

```tsx
// src/components/tasks/task-sidebar.tsx (lines 23-34)
interface TaskSidebarProps {
  agentSession: any | null           // No type safety
  taskSessions?: {
    grouped: {
      planning: any[]
      review: any[]
      verify: any[]
      execution: any[]
      rewrite: any[]
      comment: any[]
    }
  }
}
```

## Impact

- No IDE autocomplete
- No compile-time error checking
- Refactoring hazards
- Runtime bugs from incorrect assumptions

## Fix

- [x] Export `TaskSession` interface from `task-sessions.tsx`
  - ✓ Verified: `TaskSession` interface exported at `src/components/tasks/task-sessions.tsx:11-25`
- [x] Define `TaskSessionsGrouped` interface with proper session types
  - ✓ Verified: `TaskSessionsGrouped` interface defined at `src/components/tasks/task-sessions.tsx:30-37`
- [x] Import `AgentSession` from `agent-types.ts` (UI-specific minimal type)
  - ✓ Verified: `AgentSession` type exists at `src/components/tasks/agent-types.ts:5-11`
- [x] Update `task-sidebar.tsx` props to use `AgentSession | null` and `TaskSessionsGrouped`
  - ✓ Verified: Imports at lines 7, 10; Props use `AgentSession | null` (line 26) and `TaskSessionsGrouped` (line 30)
- [x] Update `task-footer.tsx` props to use `AgentSession | null`
  - ✓ Verified: Import at line 9; Props use `AgentSession | null` (line 19)

## Files Modified

- `src/components/tasks/task-sessions.tsx` - Exported `TaskSession` and added `TaskSessionsGrouped` interface
- `src/components/tasks/task-sidebar.tsx` - Updated props to use proper types
- `src/components/tasks/task-footer.tsx` - Updated props to use proper types

## Notes

The codebase has two `AgentSession` types:
1. `src/lib/agent/types.ts` - Full session type with all fields (startedAt, workingDir, etc.)
2. `src/components/tasks/agent-types.ts` - Minimal UI type for task components

The task components use the minimal type from `agent-types.ts` since that's what `_page.tsx` constructs and passes down.

## Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| Export `TaskSession` | ✅ Pass | Interface exported at `task-sessions.tsx:11-25` |
| Define `TaskSessionsGrouped` | ✅ Pass | Interface defined at `task-sessions.tsx:30-37` |
| Create `AgentSession` in `agent-types.ts` | ✅ Pass | Type exists at `agent-types.ts:5-11` |
| Update `task-sidebar.tsx` | ✅ Pass | No `any` types remain; uses proper typed imports |
| Update `task-footer.tsx` | ✅ Pass | No `any` types remain; uses proper typed imports |
| No remaining `any` types | ✅ Pass | Grep search found zero `any` type annotations in task components |
| TypeScript compiles | ✅ Pass | No type errors in modified files (unrelated vitest errors in test files) |

**Verification Date**: 2026-01-15
**Verified By**: Automated verification review