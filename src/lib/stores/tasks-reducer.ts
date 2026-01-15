/**
 * Tasks Page State Reducer
 *
 * Consolidates 17+ useState calls into a single useReducer for:
 * - Clear state shape documentation
 * - Atomic state group resets
 * - Easier state tracking and debugging
 */

import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'
import { getDefaultModelId } from '@/lib/agent/config'
import type { TaskType } from '@/components/tasks/create-task-modal'

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorState {
  draft: string
  dirty: boolean
}

export interface CreateModalState {
  open: boolean
  title: string
  taskType: TaskType
  useAgent: boolean
  agentType: PlannerAgentType
  model: string
}

export interface RunAgentState {
  agentType: AgentType
  model: string
}

export interface VerifyAgentState {
  agentType: AgentType
  model: string
}

export interface RewriteState {
  comment: string
  agentType: AgentType
  model: string
}

export interface SaveState {
  saving: boolean
  error: string | null
}

export interface ModalsState {
  verifyOpen: boolean
  splitOpen: boolean
  commitArchiveOpen: boolean
}

export interface PendingCommitState {
  message: string | null
  isGenerating: boolean
}

export interface ConfirmDialogState {
  open: boolean
  title: string
  message: string
  confirmText?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
}

export interface TasksState {
  editor: EditorState
  create: CreateModalState
  run: RunAgentState
  verify: VerifyAgentState
  rewrite: RewriteState
  save: SaveState
  modals: ModalsState
  pendingCommit: PendingCommitState
  confirmDialog: ConfirmDialogState
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

export type TasksAction =
  // Editor actions
  | { type: 'SET_DRAFT'; payload: string }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'RESET_EDITOR' }

  // Create modal actions
  | { type: 'OPEN_CREATE_MODAL' }
  | { type: 'CLOSE_CREATE_MODAL' }
  | { type: 'SET_CREATE_TITLE'; payload: string }
  | { type: 'SET_CREATE_TASK_TYPE'; payload: TaskType }
  | { type: 'SET_CREATE_USE_AGENT'; payload: boolean }
  | { type: 'SET_CREATE_AGENT_TYPE'; payload: PlannerAgentType }
  | { type: 'SET_CREATE_MODEL'; payload: string }
  | { type: 'RESET_CREATE_MODAL' }

  // Run agent actions
  | { type: 'SET_RUN_AGENT_TYPE'; payload: AgentType }
  | { type: 'SET_RUN_MODEL'; payload: string }

  // Verify agent actions
  | { type: 'SET_VERIFY_AGENT_TYPE'; payload: AgentType }
  | { type: 'SET_VERIFY_MODEL'; payload: string }

  // Rewrite actions
  | { type: 'SET_REWRITE_COMMENT'; payload: string }
  | { type: 'SET_REWRITE_AGENT_TYPE'; payload: AgentType }
  | { type: 'SET_REWRITE_MODEL'; payload: string }
  | { type: 'RESET_REWRITE' }

  // Save actions
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_SAVE_ERROR'; payload: string | null }

  // Modal actions
  | { type: 'SET_VERIFY_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_SPLIT_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_COMMIT_ARCHIVE_OPEN'; payload: boolean }

  // Pending commit actions
  | { type: 'SET_PENDING_COMMIT_MESSAGE'; payload: string | null }
  | { type: 'SET_PENDING_COMMIT_GENERATING'; payload: boolean }
  | { type: 'RESET_PENDING_COMMIT' }

  // Confirm dialog actions
  | { type: 'SET_CONFIRM_DIALOG'; payload: ConfirmDialogState }
  | { type: 'CLOSE_CONFIRM_DIALOG' }

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

export const initialTasksState: TasksState = {
  editor: {
    draft: '',
    dirty: false,
  },
  create: {
    open: false,
    title: '',
    taskType: 'feature',
    useAgent: true,
    agentType: 'claude',
    model: getDefaultModelId('claude'),
  },
  run: {
    agentType: 'claude',
    model: getDefaultModelId('claude'),
  },
  verify: {
    agentType: 'codex',
    model: getDefaultModelId('codex'),
  },
  rewrite: {
    comment: '',
    agentType: 'claude',
    model: getDefaultModelId('claude'),
  },
  save: {
    saving: false,
    error: null,
  },
  modals: {
    verifyOpen: false,
    splitOpen: false,
    commitArchiveOpen: false,
  },
  pendingCommit: {
    message: null,
    isGenerating: false,
  },
  confirmDialog: {
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

export function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  switch (action.type) {
    // Editor actions
    case 'SET_DRAFT':
      return { ...state, editor: { ...state.editor, draft: action.payload } }

    case 'SET_DIRTY':
      return { ...state, editor: { ...state.editor, dirty: action.payload } }

    case 'RESET_EDITOR':
      return { ...state, editor: { draft: '', dirty: false } }

    // Create modal actions
    case 'OPEN_CREATE_MODAL':
      return { ...state, create: { ...state.create, open: true, title: '' } }

    case 'CLOSE_CREATE_MODAL':
      return { ...state, create: { ...state.create, open: false } }

    case 'SET_CREATE_TITLE':
      return { ...state, create: { ...state.create, title: action.payload } }

    case 'SET_CREATE_TASK_TYPE':
      return { ...state, create: { ...state.create, taskType: action.payload } }

    case 'SET_CREATE_USE_AGENT':
      return { ...state, create: { ...state.create, useAgent: action.payload } }

    case 'SET_CREATE_AGENT_TYPE':
      return {
        ...state,
        create: {
          ...state.create,
          agentType: action.payload,
          model: getDefaultModelId(action.payload),
        },
      }

    case 'SET_CREATE_MODEL':
      return { ...state, create: { ...state.create, model: action.payload } }

    case 'RESET_CREATE_MODAL':
      return {
        ...state,
        create: {
          ...initialTasksState.create,
          agentType: state.create.agentType, // Preserve current agent selection
          model: state.create.model,
        },
      }

    // Run agent actions
    case 'SET_RUN_AGENT_TYPE':
      return {
        ...state,
        run: {
          agentType: action.payload,
          model: getDefaultModelId(action.payload),
        },
      }

    case 'SET_RUN_MODEL':
      return { ...state, run: { ...state.run, model: action.payload } }

    // Verify agent actions
    case 'SET_VERIFY_AGENT_TYPE':
      return {
        ...state,
        verify: {
          agentType: action.payload,
          model: getDefaultModelId(action.payload),
        },
      }

    case 'SET_VERIFY_MODEL':
      return { ...state, verify: { ...state.verify, model: action.payload } }

    // Rewrite actions
    case 'SET_REWRITE_COMMENT':
      return { ...state, rewrite: { ...state.rewrite, comment: action.payload } }

    case 'SET_REWRITE_AGENT_TYPE':
      return {
        ...state,
        rewrite: {
          ...state.rewrite,
          agentType: action.payload,
          model: getDefaultModelId(action.payload),
        },
      }

    case 'SET_REWRITE_MODEL':
      return { ...state, rewrite: { ...state.rewrite, model: action.payload } }

    case 'RESET_REWRITE':
      return {
        ...state,
        rewrite: {
          ...initialTasksState.rewrite,
          agentType: state.rewrite.agentType, // Preserve current agent selection
          model: state.rewrite.model,
        },
      }

    // Save actions
    case 'SET_SAVING':
      return { ...state, save: { ...state.save, saving: action.payload } }

    case 'SET_SAVE_ERROR':
      return { ...state, save: { ...state.save, error: action.payload } }

    // Modal actions
    case 'SET_VERIFY_MODAL_OPEN':
      return { ...state, modals: { ...state.modals, verifyOpen: action.payload } }

    case 'SET_SPLIT_MODAL_OPEN':
      return { ...state, modals: { ...state.modals, splitOpen: action.payload } }

    case 'SET_COMMIT_ARCHIVE_OPEN':
      return { ...state, modals: { ...state.modals, commitArchiveOpen: action.payload } }

    // Pending commit actions
    case 'SET_PENDING_COMMIT_MESSAGE':
      return { ...state, pendingCommit: { ...state.pendingCommit, message: action.payload } }

    case 'SET_PENDING_COMMIT_GENERATING':
      return { ...state, pendingCommit: { ...state.pendingCommit, isGenerating: action.payload } }

    case 'RESET_PENDING_COMMIT':
      return { ...state, pendingCommit: { message: null, isGenerating: false } }

    // Confirm dialog actions
    case 'SET_CONFIRM_DIALOG':
      return { ...state, confirmDialog: action.payload }

    case 'CLOSE_CONFIRM_DIALOG':
      return { ...state, confirmDialog: { ...state.confirmDialog, open: false } }

    default:
      return state
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create initial state with props
// ─────────────────────────────────────────────────────────────────────────────

export function createInitialState(createModalOpen: boolean): TasksState {
  return {
    ...initialTasksState,
    create: {
      ...initialTasksState.create,
      open: createModalOpen,
    },
  }
}
