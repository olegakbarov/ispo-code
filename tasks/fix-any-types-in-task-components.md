# Fix 'any' Types in Task Components

**Priority**: High
**Category**: Type Safety

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

1. Import `AgentSession` type from `src/lib/agent/types.ts`
2. Define `TaskSessionsGrouped` interface with proper session types
3. Create discriminated union for session types based on `taskType`

## Files

- `src/components/tasks/task-sidebar.tsx`
- `src/components/tasks/task-footer.tsx`
