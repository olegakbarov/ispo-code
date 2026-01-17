/**
 * Tasks Page State Reducer
 *
 * Consolidates 17+ useState calls into a single useReducer for:
 * - Clear state shape documentation
 * - Atomic state group resets
 * - Easier state tracking and debugging
 */

import { match } from 'ts-pattern'
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

/** Agent selection for multi-agent debug */
export interface DebugAgentSelection {
  agentType: PlannerAgentType
  model: string
  selected: boolean
}

export interface CreateModalState {
  open: boolean
  title: string
  taskType: TaskType
  useAgent: boolean
  agentType: PlannerAgentType
  model: string
  /** Multi-agent debug selections (bug type only) */
  debugAgents: DebugAgentSelection[]
  /** Auto-run phases: planning→impl→verify */
  autoRun: boolean
  /** Include clarifying questions in AI planning */
  includeQuestions: boolean
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
  implementOpen: boolean
  orchestratorOpen: boolean
  unarchiveOpen: boolean
}

export interface UnarchiveState {
  agentType: AgentType
  model: string
}

export interface OrchestratorState {
  /** Run ID being orchestrated (debug or plan) */
  debugRunId: string | null
  /** Plan run ID for multi-agent planning */
  planRunId: string | null
  /** Session ID of the orchestrator (codex) */
  sessionId: string | null
  /** Whether the orchestrator has been triggered for this run */
  triggered: boolean
  /** Type of orchestration run */
  type: 'debug' | 'plan' | null
  /** Plan file paths for plan runs (needed for orchestration) */
  planPaths?: [string, string]
  /** Parent task path for plan runs */
  parentTaskPath?: string
}

export interface PendingCommitEntry {
  message: string | null
  isGenerating: boolean
}

export type PendingCommitState = Record<string, PendingCommitEntry>

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
  unarchive: UnarchiveState
  pendingCommit: PendingCommitState
  confirmDialog: ConfirmDialogState
  orchestrator: OrchestratorState
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
  | { type: 'SET_CREATE_AUTO_RUN'; payload: boolean }
  | { type: 'SET_CREATE_INCLUDE_QUESTIONS'; payload: boolean }
  | { type: 'RESET_CREATE_MODAL' }
  | { type: 'TOGGLE_DEBUG_AGENT'; payload: PlannerAgentType }
  | { type: 'SET_DEBUG_AGENT_MODEL'; payload: { agentType: PlannerAgentType; model: string } }
  | { type: 'INIT_DEBUG_AGENTS'; payload: PlannerAgentType[] }

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
  | { type: 'SET_IMPLEMENT_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_UNARCHIVE_MODAL_OPEN'; payload: boolean }

  // Unarchive agent actions
  | { type: 'SET_UNARCHIVE_AGENT_TYPE'; payload: AgentType }
  | { type: 'SET_UNARCHIVE_MODEL'; payload: string }

  // Pending commit actions
  | { type: 'SET_PENDING_COMMIT_MESSAGE'; payload: { path: string; message: string | null } }
  | { type: 'SET_PENDING_COMMIT_GENERATING'; payload: { path: string; isGenerating: boolean } }
  | { type: 'RESET_PENDING_COMMIT'; payload: { path: string } }

  // Confirm dialog actions
  | { type: 'SET_CONFIRM_DIALOG'; payload: ConfirmDialogState }
  | { type: 'CLOSE_CONFIRM_DIALOG' }

  // Orchestrator actions
  | { type: 'SET_ORCHESTRATOR_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_ORCHESTRATOR'; payload: { debugRunId: string; sessionId: string } }
  | { type: 'SET_ORCHESTRATOR_TRIGGERED'; payload: string }
  | { type: 'SET_PLAN_ORCHESTRATOR_TRIGGERED'; payload: { planRunId: string; planPaths: [string, string]; parentTaskPath: string } }
  | { type: 'SET_PLAN_ORCHESTRATOR'; payload: { planRunId: string; sessionId: string } }
  | { type: 'RESET_ORCHESTRATOR' }

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
    agentType: 'codex',
    model: getDefaultModelId('codex'),
    debugAgents: [], // Initialized dynamically based on available types
    autoRun: true, // Default checked
    includeQuestions: false, // Default unchecked
  },
  run: {
    agentType: 'codex',
    model: getDefaultModelId('codex'),
  },
  verify: {
    agentType: 'codex',
    model: getDefaultModelId('codex'),
  },
  rewrite: {
    comment: '',
    agentType: 'codex',
    model: getDefaultModelId('codex'),
  },
  save: {
    saving: false,
    error: null,
  },
  modals: {
    verifyOpen: false,
    splitOpen: false,
    commitArchiveOpen: false,
    implementOpen: false,
    orchestratorOpen: false,
    unarchiveOpen: false,
  },
  unarchive: {
    agentType: 'codex',
    model: getDefaultModelId('codex'),
  },
  pendingCommit: {},
  confirmDialog: {
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  },
  orchestrator: {
    debugRunId: null,
    planRunId: null,
    sessionId: null,
    triggered: false,
    type: null,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

export function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  return match(action)
    // Editor actions
    .with({ type: 'SET_DRAFT' }, ({ payload }) => ({
      ...state,
      editor: { ...state.editor, draft: payload },
    }))
    .with({ type: 'SET_DIRTY' }, ({ payload }) => ({
      ...state,
      editor: { ...state.editor, dirty: payload },
    }))
    .with({ type: 'RESET_EDITOR' }, () => ({
      ...state,
      editor: { draft: '', dirty: false },
    }))

    // Create modal actions
    .with({ type: 'OPEN_CREATE_MODAL' }, () => ({
      ...state,
      create: { ...state.create, open: true, title: '' },
    }))
    .with({ type: 'CLOSE_CREATE_MODAL' }, () => ({
      ...state,
      create: { ...state.create, open: false },
    }))
    .with({ type: 'SET_CREATE_TITLE' }, ({ payload }) => ({
      ...state,
      create: { ...state.create, title: payload },
    }))
    .with({ type: 'SET_CREATE_TASK_TYPE' }, ({ payload }) => ({
      ...state,
      create: { ...state.create, taskType: payload },
    }))
    .with({ type: 'SET_CREATE_USE_AGENT' }, ({ payload }) => ({
      ...state,
      create: { ...state.create, useAgent: payload },
    }))
    .with({ type: 'SET_CREATE_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      create: {
        ...state.create,
        agentType: payload,
        model: getDefaultModelId(payload),
      },
    }))
    .with({ type: 'SET_CREATE_MODEL' }, ({ payload }) => ({
      ...state,
      create: { ...state.create, model: payload },
    }))
    .with({ type: 'SET_CREATE_AUTO_RUN' }, ({ payload }) => ({
      ...state,
      create: { ...state.create, autoRun: payload },
    }))
    .with({ type: 'SET_CREATE_INCLUDE_QUESTIONS' }, ({ payload }) => ({
      ...state,
      create: { ...state.create, includeQuestions: payload },
    }))
    .with({ type: 'RESET_CREATE_MODAL' }, () => ({
      ...state,
      create: {
        ...initialTasksState.create,
        agentType: state.create.agentType,
        model: state.create.model,
        debugAgents: state.create.debugAgents.map((da) => ({ ...da, selected: false })),
      },
    }))
    .with({ type: 'TOGGLE_DEBUG_AGENT' }, ({ payload }) => ({
      ...state,
      create: {
        ...state.create,
        debugAgents: state.create.debugAgents.map((da) =>
          da.agentType === payload ? { ...da, selected: !da.selected } : da
        ),
      },
    }))
    .with({ type: 'SET_DEBUG_AGENT_MODEL' }, ({ payload }) => ({
      ...state,
      create: {
        ...state.create,
        debugAgents: state.create.debugAgents.map((da) =>
          da.agentType === payload.agentType ? { ...da, model: payload.model } : da
        ),
      },
    }))
    .with({ type: 'INIT_DEBUG_AGENTS' }, ({ payload }) => ({
      ...state,
      create: {
        ...state.create,
        debugAgents: payload.map((agentType) => ({
          agentType,
          model: getDefaultModelId(agentType),
          selected: false,
        })),
      },
    }))

    // Run agent actions
    .with({ type: 'SET_RUN_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      run: {
        agentType: payload,
        model: getDefaultModelId(payload),
      },
    }))
    .with({ type: 'SET_RUN_MODEL' }, ({ payload }) => ({
      ...state,
      run: { ...state.run, model: payload },
    }))

    // Verify agent actions
    .with({ type: 'SET_VERIFY_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      verify: {
        agentType: payload,
        model: getDefaultModelId(payload),
      },
    }))
    .with({ type: 'SET_VERIFY_MODEL' }, ({ payload }) => ({
      ...state,
      verify: { ...state.verify, model: payload },
    }))

    // Rewrite actions
    .with({ type: 'SET_REWRITE_COMMENT' }, ({ payload }) => ({
      ...state,
      rewrite: { ...state.rewrite, comment: payload },
    }))
    .with({ type: 'SET_REWRITE_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      rewrite: {
        ...state.rewrite,
        agentType: payload,
        model: getDefaultModelId(payload),
      },
    }))
    .with({ type: 'SET_REWRITE_MODEL' }, ({ payload }) => ({
      ...state,
      rewrite: { ...state.rewrite, model: payload },
    }))
    .with({ type: 'RESET_REWRITE' }, () => ({
      ...state,
      rewrite: {
        ...initialTasksState.rewrite,
        agentType: state.rewrite.agentType,
        model: state.rewrite.model,
      },
    }))

    // Save actions
    .with({ type: 'SET_SAVING' }, ({ payload }) => ({
      ...state,
      save: { ...state.save, saving: payload },
    }))
    .with({ type: 'SET_SAVE_ERROR' }, ({ payload }) => ({
      ...state,
      save: { ...state.save, error: payload },
    }))

    // Modal actions
    .with({ type: 'SET_VERIFY_MODAL_OPEN' }, ({ payload }) => ({
      ...state,
      modals: { ...state.modals, verifyOpen: payload },
    }))
    .with({ type: 'SET_SPLIT_MODAL_OPEN' }, ({ payload }) => ({
      ...state,
      modals: { ...state.modals, splitOpen: payload },
    }))
    .with({ type: 'SET_COMMIT_ARCHIVE_OPEN' }, ({ payload }) => ({
      ...state,
      modals: { ...state.modals, commitArchiveOpen: payload },
    }))
    .with({ type: 'SET_IMPLEMENT_MODAL_OPEN' }, ({ payload }) => ({
      ...state,
      modals: { ...state.modals, implementOpen: payload },
    }))
    .with({ type: 'SET_UNARCHIVE_MODAL_OPEN' }, ({ payload }) => ({
      ...state,
      modals: { ...state.modals, unarchiveOpen: payload },
    }))

    // Unarchive agent actions
    .with({ type: 'SET_UNARCHIVE_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      unarchive: {
        agentType: payload,
        model: getDefaultModelId(payload),
      },
    }))
    .with({ type: 'SET_UNARCHIVE_MODEL' }, ({ payload }) => ({
      ...state,
      unarchive: { ...state.unarchive, model: payload },
    }))

    // Pending commit actions
    .with({ type: 'SET_PENDING_COMMIT_MESSAGE' }, ({ payload }) => ({
      ...state,
      pendingCommit: {
        ...state.pendingCommit,
        [payload.path]: {
          ...(state.pendingCommit[payload.path] ?? { message: null, isGenerating: false }),
          message: payload.message,
        },
      },
    }))
    .with({ type: 'SET_PENDING_COMMIT_GENERATING' }, ({ payload }) => ({
      ...state,
      pendingCommit: {
        ...state.pendingCommit,
        [payload.path]: {
          ...(state.pendingCommit[payload.path] ?? { message: null, isGenerating: false }),
          isGenerating: payload.isGenerating,
        },
      },
    }))
    .with({ type: 'RESET_PENDING_COMMIT' }, ({ payload }) => {
      const { [payload.path]: _removed, ...rest } = state.pendingCommit
      return { ...state, pendingCommit: rest }
    })

    // Confirm dialog actions
    .with({ type: 'SET_CONFIRM_DIALOG' }, ({ payload }) => ({
      ...state,
      confirmDialog: payload,
    }))
    .with({ type: 'CLOSE_CONFIRM_DIALOG' }, () => ({
      ...state,
      confirmDialog: { ...state.confirmDialog, open: false },
    }))

    // Orchestrator actions
    .with({ type: 'SET_ORCHESTRATOR_MODAL_OPEN' }, ({ payload }) => ({
      ...state,
      modals: { ...state.modals, orchestratorOpen: payload },
    }))
    .with({ type: 'SET_ORCHESTRATOR' }, ({ payload }) => ({
      ...state,
      orchestrator: {
        debugRunId: payload.debugRunId,
        planRunId: null,
        sessionId: payload.sessionId,
        triggered: true,
        type: 'debug' as const,
      },
      modals: { ...state.modals, orchestratorOpen: true },
    }))
    .with({ type: 'SET_ORCHESTRATOR_TRIGGERED' }, ({ payload }) => ({
      ...state,
      orchestrator: {
        ...state.orchestrator,
        debugRunId: payload,
        triggered: true,
        type: 'debug' as const,
      },
    }))
    .with({ type: 'SET_PLAN_ORCHESTRATOR_TRIGGERED' }, ({ payload }) => ({
      ...state,
      orchestrator: {
        ...state.orchestrator,
        planRunId: payload.planRunId,
        planPaths: payload.planPaths,
        parentTaskPath: payload.parentTaskPath,
        triggered: true,
        type: 'plan' as const,
      },
    }))
    .with({ type: 'SET_PLAN_ORCHESTRATOR' }, ({ payload }) => ({
      ...state,
      orchestrator: {
        ...state.orchestrator,
        planRunId: payload.planRunId,
        sessionId: payload.sessionId,
        triggered: true,
        type: 'plan' as const,
      },
      modals: { ...state.modals, orchestratorOpen: true },
    }))
    .with({ type: 'RESET_ORCHESTRATOR' }, () => ({
      ...state,
      orchestrator: {
        debugRunId: null,
        planRunId: null,
        sessionId: null,
        triggered: false,
        type: null,
      },
      modals: { ...state.modals, orchestratorOpen: false },
    }))
    .exhaustive()
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create initial state with props
// ─────────────────────────────────────────────────────────────────────────────

export interface InitialStateDefaults {
  createModalOpen: boolean
  /** Default planning agent type from settings */
  defaultPlanningAgentType?: PlannerAgentType | null
  /** Default verify agent type from settings */
  defaultVerifyAgentType?: AgentType | null
  /** Default verify model from settings */
  defaultVerifyModelId?: string | null
  /** Default implementation agent type from settings */
  defaultImplementAgentType?: AgentType | null
  /** Default implementation model from settings */
  defaultImplementModelId?: string | null
}

export function createInitialState(defaults: InitialStateDefaults | boolean): TasksState {
  // Support legacy boolean argument for backward compatibility
  const opts: InitialStateDefaults = typeof defaults === 'boolean'
    ? { createModalOpen: defaults }
    : defaults

  const {
    createModalOpen,
    defaultPlanningAgentType,
    defaultVerifyAgentType,
    defaultVerifyModelId,
    defaultImplementAgentType,
    defaultImplementModelId,
  } = opts

  return {
    ...initialTasksState,
    create: {
      ...initialTasksState.create,
      open: createModalOpen,
      // Use settings default if provided, otherwise fall back to initial state default
      agentType: defaultPlanningAgentType ?? initialTasksState.create.agentType,
      model: defaultPlanningAgentType
        ? getDefaultModelId(defaultPlanningAgentType)
        : initialTasksState.create.model,
    },
    run: {
      ...initialTasksState.run,
      // Use settings default if provided, otherwise fall back to initial state default
      agentType: defaultImplementAgentType ?? initialTasksState.run.agentType,
      model: defaultImplementModelId ?? (defaultImplementAgentType
        ? getDefaultModelId(defaultImplementAgentType)
        : initialTasksState.run.model),
    },
    verify: {
      ...initialTasksState.verify,
      // Use settings default if provided, otherwise fall back to initial state default
      agentType: defaultVerifyAgentType ?? initialTasksState.verify.agentType,
      model: defaultVerifyModelId ?? (defaultVerifyAgentType
        ? getDefaultModelId(defaultVerifyAgentType)
        : initialTasksState.verify.model),
    },
  }
}
