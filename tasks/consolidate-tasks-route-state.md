# Consolidate tasks.tsx State with useReducer

**Priority**: High
**Category**: State Management

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

- `src/routes/tasks.tsx`
- New: `src/lib/stores/tasks-reducer.ts` (optional)
