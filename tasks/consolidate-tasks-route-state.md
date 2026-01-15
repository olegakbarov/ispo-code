# Consolidate tasks.tsx State with useReducer

**Priority**: High
**Category**: State Management
**Status**: Completed

## Problem

`src/routes/tasks.tsx` has 17+ individual useState calls (lines 72-115):

```tsx
const [mode, setMode] = useState<Mode>('edit')
const [draft, setDraft] = useState('')
const [dirty, setDirty] = useState(false)
const [createOpen, setCreateOpen] = useState(false)
const [newTitle, setNewTitle] = useState('')
const [taskType, setTaskType] = useState<TaskType>('feature')
const [useAgent, setUseAgent] = useState(true)
const [isSaving, setIsSaving] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)
const [createAgentType, setCreateAgentType] = useState(...)
const [createModel, setCreateModel] = useState(...)
const [runAgentType, setRunAgentType] = useState(...)
const [runModel, setRunModel] = useState(...)
const [verifyModalOpen, setVerifyModalOpen] = useState(false)
const [debateModalOpen, setDebateModalOpen] = useState(false)
const [rewriteComment, setRewriteComment] = useState('')
const [rewriteAgentType, setRewriteAgentType] = useState(...)
const [rewriteModel, setRewriteModel] = useState(...)
```

## Impact

- Hard to track related state
- Difficult to reset state groups atomically
- No clear state shape documentation
- Maintenance burden

## Fix

Consolidate with useReducer:

```tsx
interface TasksState {
  editor: { mode: Mode; draft: string; dirty: boolean }
  create: { open: boolean; title: string; taskType: TaskType; useAgent: boolean; agentType: PlannerAgentType; model: string }
  run: { agentType: AgentType; model: string }
  rewrite: { comment: string; agentType: AgentType; model: string }
  modals: { verifyOpen: boolean; debateOpen: boolean }
  save: { saving: boolean; error: string | null }
}

type TasksAction =
  | { type: 'SET_MODE'; payload: Mode }
  | { type: 'SET_DRAFT'; payload: string }
  | { type: 'RESET_EDITOR' }
  | { type: 'OPEN_CREATE_MODAL' }
  // etc.

const [state, dispatch] = useReducer(tasksReducer, initialState)
```

## Also Extract

Custom hook `useSynchronizeAgentType()` to dedupe the 3 similar useEffect blocks (lines 159-177) that sync agent types when availability changes.

## Files

- [x] `src/routes/tasks/_page.tsx` - Main component refactored
  - ✓ Verified: File exists, no useState calls remain, uses useReducer at line 115
- [x] `src/lib/stores/tasks-reducer.ts` - New reducer with state types
  - ✓ Verified: File exists (297 lines) with TasksState, TasksAction, tasksReducer, createInitialState
- [x] `src/lib/hooks/use-synchronize-agent-type.ts` - New hook for agent type sync
  - ✓ Verified: File exists (59 lines) with generic useSynchronizeAgentType hook

## Implementation Summary

### Changes Made

- [x] **Created `src/lib/stores/tasks-reducer.ts`**
  - ✓ Verified: `TasksState` interface at line 64-72 with all grouped state
  - ✓ Verified: `TasksAction` union type at lines 78-115
  - ✓ Verified: `tasksReducer` at lines 164-281
  - ✓ Verified: `createInitialState()` at lines 288-296
   - Defined `TasksState` interface with grouped state:
     - `editor`: draft, dirty
     - `create`: modal state, title, taskType, useAgent, agentType, model
     - `run`: agentType, model
     - `rewrite`: comment, agentType, model
     - `save`: saving, error
     - `modals`: verifyOpen, splitOpen, commitArchiveOpen
     - `confirmDialog`: dialog state
   - Defined `TasksAction` union type for all actions
   - Implemented `tasksReducer` with all action handlers
   - Helper `createInitialState()` for initial state with props

- [x] **Created `src/lib/hooks/use-synchronize-agent-type.ts`**
  - ✓ Verified: Generic hook at lines 39-58 with correct type constraints
  - ✓ Verified: Works with both `AgentType` and `PlannerAgentType`
   - Generic hook that synchronizes agent type selection when availability changes
   - Replaces 3 similar useEffect blocks with a single reusable hook
   - Works with both `AgentType` and `PlannerAgentType`
   - Now also syncs `rewriteAgentType` (previously wasn't synced)

- [x] **Refactored `src/routes/tasks/_page.tsx`**
  - ✓ Verified: No useState calls found (grep returned no matches)
  - ✓ Verified: useReducer at line 115 with tasksReducer and createInitialState
  - ✓ Verified: 3 useSynchronizeAgentType calls at lines 187, 194, 201
  - ✓ Verified: dispatch calls used throughout (51 occurrences)
   - Replaced 17+ useState calls with single useReducer
   - Replaced 2 agent sync useEffects with 3 useSynchronizeAgentType calls
   - All setX calls replaced with dispatch({ type: 'X', payload })
   - Build verified successfully

## Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| Reducer file created | ✅ | `src/lib/stores/tasks-reducer.ts` exists (297 lines) |
| State types defined | ✅ | TasksState interface at lines 64-72 |
| Actions defined | ✅ | TasksAction union at lines 78-115 |
| Hook file created | ✅ | `src/lib/hooks/use-synchronize-agent-type.ts` exists (59 lines) |
| Hook is generic | ✅ | Type constraint `<T extends AgentType \| PlannerAgentType>` at line 39 |
| useState calls removed | ✅ | grep for "useState" in _page.tsx returned no matches |
| useReducer in use | ✅ | Line 115: `const [state, dispatch] = useReducer(tasksReducer, initialCreateOpen, createInitialState)` |
| 3 sync hooks used | ✅ | useSynchronizeAgentType called at lines 187, 194, 201 |
| Build passes | ✅ | `npm run build` completed successfully |
| Mode moved to URL | ✅ | `mode` is now a prop from URL routing (line 36, 49), not useState |

**All verification checks passed.** The refactoring is complete and working correctly.