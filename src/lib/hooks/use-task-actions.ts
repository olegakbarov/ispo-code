/**
 * Task Actions Hook (Composition)
 *
 * Thin composition layer that assembles specialized hooks:
 * - use-task-create-actions: task creation with optimistic updates
 * - use-task-crud-actions: delete, archive, restore, split
 * - use-task-agent-actions: agent operations and auto-run
 * - use-task-commit-effects: commit message pregeneration
 * - use-task-qa-actions: QA workflow (merge/revert)
 * - use-task-orchestrator: debug run orchestration
 * - Debounced autosave
 *
 * This hook has NO domain logic - only composition.
 */

import { trpc } from '@/lib/trpc-client'
import { useDebouncedCallback } from '@/lib/utils/debounce'
import type { PlannerAgentType } from '@/lib/agent/config'
import type { AgentSession } from '@/components/tasks/agent-types'
import type { MergeHistoryEntry } from '@/lib/agent/task-service'
import type {
  TasksAction,
  EditorState,
  CreateModalState,
  RunAgentState,
  VerifyAgentState,
  RewriteState,
  OrchestratorState,
  PendingCommitState,
} from '@/lib/stores/tasks-reducer'

// Import specialized hooks
import { useTaskCreateActions } from './use-task-create-actions'
import { useTaskCRUDActions } from './use-task-crud-actions'
import { useTaskAgentActions } from './use-task-agent-actions'
import { useTaskCommitEffects } from './use-task-commit-effects'
import { useTaskQAActions } from './use-task-qa-actions'
import { useTaskOrchestrator } from './use-task-orchestrator'

interface TaskSummary {
  path: string
  title: string
  archived: boolean
}

interface TaskSessionInfo {
  sessionId: string
  sessionType?: 'planning' | 'review' | 'verify' | 'execution' | 'debug' | 'rewrite' | 'comment' | 'orchestrator'
  status?: string
}

interface TaskSessionsData {
  all: Array<TaskSessionInfo>
  grouped?: {
    planning: Array<TaskSessionInfo>
    review: Array<TaskSessionInfo>
    verify: Array<TaskSessionInfo>
    execution: Array<TaskSessionInfo>
    rewrite: Array<TaskSessionInfo>
    comment: Array<TaskSessionInfo>
    orchestrator: Array<TaskSessionInfo>
  }
}

interface UseTaskActionsParams {
  selectedPath: string | null
  workingDir: string | null
  activeSessionId: string | null | undefined
  latestActiveMerge: MergeHistoryEntry | null | undefined
  mode?: 'edit' | 'review' | 'debate'
  dispatch: React.Dispatch<TasksAction>
  editor: EditorState
  create: CreateModalState
  run: RunAgentState
  verify: VerifyAgentState
  rewrite: RewriteState
  orchestrator: OrchestratorState
  pendingCommit: PendingCommitState
  tasks: TaskSummary[]
  taskSessions: TaskSessionsData | undefined
  selectedSummary: TaskSummary | null
  agentSession: AgentSession | null
  availablePlannerTypes: PlannerAgentType[]
  buildSearchParams: (overrideReviewFile?: string | null) => {
    archiveFilter: 'all' | 'active' | 'archived'
    sortBy?: 'updated' | 'title' | 'progress'
    sortDir?: 'asc' | 'desc'
    reviewFile?: string
  }
  // Mutations
  saveMutation: ReturnType<typeof trpc.tasks.save.useMutation>
  createMutation: ReturnType<typeof trpc.tasks.create.useMutation>
  createWithAgentMutation: ReturnType<typeof trpc.tasks.createWithAgent.useMutation>
  debugWithAgentsMutation: ReturnType<typeof trpc.tasks.debugWithAgents.useMutation>
  deleteMutation: ReturnType<typeof trpc.tasks.delete.useMutation>
  archiveMutation: ReturnType<typeof trpc.tasks.archive.useMutation>
  restoreMutation: ReturnType<typeof trpc.tasks.restore.useMutation>
  assignToAgentMutation: ReturnType<typeof trpc.tasks.assignToAgent.useMutation>
  cancelAgentMutation: ReturnType<typeof trpc.agent.cancel.useMutation>
  verifyWithAgentMutation: ReturnType<typeof trpc.tasks.verifyWithAgent.useMutation>
  rewriteWithAgentMutation: ReturnType<typeof trpc.tasks.rewriteWithAgent.useMutation>
  splitTaskMutation: ReturnType<typeof trpc.tasks.splitTask.useMutation>
  orchestrateMutation: ReturnType<typeof trpc.tasks.orchestrateDebugRun.useMutation>
  mergeBranchMutation: ReturnType<typeof trpc.git.mergeBranch.useMutation>
  recordMergeMutation: ReturnType<typeof trpc.tasks.recordMerge.useMutation>
  setQAStatusMutation: ReturnType<typeof trpc.tasks.setQAStatus.useMutation>
  revertMergeMutation: ReturnType<typeof trpc.git.revertMerge.useMutation>
  recordRevertMutation: ReturnType<typeof trpc.tasks.recordRevert.useMutation>
  // Draft management
  clearRewriteDraft: () => void
  clearCreateTitleDraft: () => void
}

export function useTaskActions({
  selectedPath,
  workingDir,
  activeSessionId,
  latestActiveMerge,
  mode,
  dispatch,
  editor,
  create,
  run,
  verify,
  rewrite,
  orchestrator,
  pendingCommit,
  tasks,
  taskSessions,
  selectedSummary,
  agentSession,
  availablePlannerTypes,
  buildSearchParams,
  saveMutation,
  createMutation,
  createWithAgentMutation,
  debugWithAgentsMutation,
  deleteMutation,
  archiveMutation,
  restoreMutation,
  assignToAgentMutation,
  cancelAgentMutation,
  verifyWithAgentMutation,
  rewriteWithAgentMutation,
  splitTaskMutation,
  orchestrateMutation,
  mergeBranchMutation,
  recordMergeMutation,
  setQAStatusMutation,
  revertMergeMutation,
  recordRevertMutation,
  clearRewriteDraft,
  clearCreateTitleDraft,
}: UseTaskActionsParams) {
  // Pending commit values for current task
  const pendingCommitForSelected = selectedPath ? pendingCommit[selectedPath] : undefined
  const pendingCommitMessage = pendingCommitForSelected?.message ?? null
  const pendingCommitGenerating = pendingCommitForSelected?.isGenerating ?? false

  // ─────────────────────────────────────────────────────────────────────────────
  // Debounced Autosave
  // ─────────────────────────────────────────────────────────────────────────────

  const debouncedSave = useDebouncedCallback(
    async (path: string, content: string) => {
      dispatch({ type: 'SET_SAVING', payload: true })
      try {
        await saveMutation.mutateAsync({ path, content })
      } catch {
        // Error handled in onError callback
      } finally {
        dispatch({ type: 'SET_SAVING', payload: false })
      }
    },
    500
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Compose Specialized Hooks
  // ─────────────────────────────────────────────────────────────────────────────

  // Task creation with optimistic updates
  const createActions = useTaskCreateActions({
    dispatch,
    create,
    run,
    tasks,
    buildSearchParams,
    createMutation,
    createWithAgentMutation,
    debugWithAgentsMutation,
    assignToAgentMutation,
    clearCreateTitleDraft,
  })

  // CRUD operations
  const crudActions = useTaskCRUDActions({
    selectedPath,
    dispatch,
    deleteMutation,
    archiveMutation,
    restoreMutation,
    splitTaskMutation,
  })

  // Agent operations and auto-run
  const agentActions = useTaskAgentActions({
    selectedPath,
    dispatch,
    editor,
    run,
    verify,
    rewrite,
    taskSessions,
    agentSession,
    buildSearchParams,
    saveMutation,
    assignToAgentMutation,
    cancelAgentMutation,
    verifyWithAgentMutation,
    rewriteWithAgentMutation,
    clearRewriteDraft,
  })

  // Commit message pregeneration effects
  const commitEffects = useTaskCommitEffects({
    selectedPath,
    mode,
    dispatch,
    editor,
    tasks,
    selectedSummary,
    agentSession,
    pendingCommitGenerating,
    pendingCommitMessage,
    buildSearchParams,
  })

  // QA workflow
  const qaActions = useTaskQAActions({
    selectedPath,
    workingDir,
    activeSessionId,
    latestActiveMerge,
    dispatch,
    mergeBranchMutation,
    recordMergeMutation,
    setQAStatusMutation,
    revertMergeMutation,
    recordRevertMutation,
  })

  // Orchestrator
  const orchestratorActions = useTaskOrchestrator({
    selectedPath,
    dispatch,
    orchestrator,
    taskSessions,
    orchestrateMutation,
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Return Composed API
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    // Autosave
    debouncedSave,

    // Create actions
    handleCreate: createActions.handleCreate,

    // CRUD actions
    handleDelete: crudActions.handleDelete,
    handleArchive: crudActions.handleArchive,
    handleRestore: crudActions.handleRestore,
    handleOpenSplitModal: crudActions.handleOpenSplitModal,
    handleCloseSplitModal: crudActions.handleCloseSplitModal,
    handleSplitTask: crudActions.handleSplitTask,

    // Agent actions
    handleAssignToAgent: agentActions.handleAssignToAgent,
    handleCloseImplementModal: agentActions.handleCloseImplementModal,
    handleStartImplement: agentActions.handleStartImplement,
    handleCancelAgent: agentActions.handleCancelAgent,
    handleReview: agentActions.handleReview,
    handleVerify: agentActions.handleVerify,
    handleCloseDebatePanel: agentActions.handleCloseDebatePanel,
    handleStartVerify: agentActions.handleStartVerify,
    handleCloseVerifyModal: agentActions.handleCloseVerifyModal,
    handleDebateAccept: agentActions.handleDebateAccept,
    handleRewritePlan: agentActions.handleRewritePlan,

    // Commit effects
    handleOpenCommitArchiveModal: commitEffects.handleOpenCommitArchiveModal,
    handleCloseCommitArchiveModal: commitEffects.handleCloseCommitArchiveModal,
    handleCommitSuccess: commitEffects.handleCommitSuccess,
    handleArchiveSuccess: commitEffects.handleArchiveSuccess,

    // QA actions
    handleMergeSuccess: qaActions.handleMergeSuccess,
    activeWorktreeBranch: qaActions.activeWorktreeBranch,
    handleMergeToMain: qaActions.handleMergeToMain,
    handleSetQAPass: qaActions.handleSetQAPass,
    handleSetQAFail: qaActions.handleSetQAFail,
    handleRevertMerge: qaActions.handleRevertMerge,

    // Orchestrator
    handleCloseOrchestratorModal: orchestratorActions.handleCloseOrchestratorModal,
    debugRunStatus: orchestratorActions.debugRunStatus,

    // Pending commit state (exposed for components)
    pendingCommitMessage,
    pendingCommitGenerating,
  }
}
