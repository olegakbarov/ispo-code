/**
 * Tasks Page - Shared component for tasks routes
 *
 * This is the actual tasks UI, used by:
 * - /tasks (no task selected)
 * - /tasks/$ (task selected via splat param)
 * - /tasks/new (create modal open)
 */

import { useEffect, useReducer } from 'react'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { TaskEditor } from '@/components/tasks/task-editor'
import { TaskFooter } from '@/components/tasks/task-footer'
import { TaskSidebar } from '@/components/tasks/task-sidebar'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { CreateTaskForm, CreateTaskActions } from '@/components/tasks/create-task-form'
import { ReviewModal } from '@/components/tasks/review-modal'
import { ImplementModal } from '@/components/tasks/implement-modal'
import { SplitTaskModal } from '@/components/tasks/split-task-modal'
import { CommitArchiveModal } from '@/components/tasks/commit-archive-modal'
import { DebatePanel } from '@/components/debate'
import { OrchestratorModal } from '@/components/tasks/orchestrator-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { tasksReducer, createInitialState } from '@/lib/stores/tasks-reducer'
import { trpc } from '@/lib/trpc-client'

// Custom hooks
import { useTaskData } from '@/lib/hooks/use-task-data'
import { useTaskMutations } from '@/lib/hooks/use-task-mutations'
import { useAgentSessionTracking } from '@/lib/hooks/use-agent-session-tracking'
import { useTaskAgentTypeSync } from '@/lib/hooks/use-task-agent-type-sync'
import { useTaskRefresh } from '@/lib/hooks/use-task-refresh'
import { useTaskNavigation } from '@/lib/hooks/use-task-navigation'
import { useTaskActions } from '@/lib/hooks/use-task-actions'
import { getCreateTaskRenderMode } from '@/lib/tasks/create-task-visibility'

type Mode = 'edit' | 'review' | 'debate'

interface TasksPageProps {
  /** Selected task path (decoded from URL) */
  selectedPath: string | null
  /** Current mode (edit or review) from URL */
  mode?: Mode
  /** Whether the create modal should be open */
  createModalOpen: boolean
  /** Archive filter from search params */
  archiveFilter: 'all' | 'active' | 'archived'
  /** Sort option from search params */
  sortBy?: 'updated' | 'title' | 'progress'
  /** Sort direction from search params */
  sortDir?: 'asc' | 'desc'
  /** Selected file in review mode (git-relative path) */
  reviewFile?: string
}

export function TasksPage({
  selectedPath,
  mode = 'edit',
  createModalOpen: initialCreateOpen,
  archiveFilter,
  sortBy,
  sortDir,
  reviewFile,
}: TasksPageProps) {
  // ═══════════════════════════════════════════════════════════════════════════════
  // State Management
  // ═══════════════════════════════════════════════════════════════════════════════

  const [state, dispatch] = useReducer(tasksReducer, initialCreateOpen, createInitialState)
  const { editor, create, run, verify, rewrite, save, modals, pendingCommit, confirmDialog, orchestrator } = state
  const createRenderMode = getCreateTaskRenderMode({
    selectedPath,
    isCreateModalOpen: create.open,
  })
  const showInlineCreateForm = createRenderMode === 'inline'

  // ═══════════════════════════════════════════════════════════════════════════════
  // Data Fetching (Phase 2: use-task-data)
  // ═══════════════════════════════════════════════════════════════════════════════

  const {
    workingDir,
    tasks,
    availableTypes,
    availablePlannerTypes,
    taskSessions,
    sectionsData,
    taskData,
    latestActiveMerge,
    activeDebate,
    selectedSummary,
    activeSessionId,
    activeSessionInfo,
  } = useTaskData({ selectedPath, mode })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Draft Persistence
  // ═══════════════════════════════════════════════════════════════════════════════

  const [createTitleDraft, setCreateTitleDraft, clearCreateTitleDraft] = useTextareaDraft(
    'create-task-title',
    ''
  )

  useEffect(() => {
    if (createTitleDraft !== create.title) {
      dispatch({ type: 'SET_CREATE_TITLE', payload: createTitleDraft })
    }
  }, [createTitleDraft, create.title])

  const [rewriteDraft, setRewriteDraft, clearRewriteDraft] = useTextareaDraft(
    selectedPath ? `task-rewrite:${selectedPath}` : '',
    '',
    { skipRestore: !selectedPath }
  )

  useEffect(() => {
    if (rewriteDraft !== rewrite.comment) {
      dispatch({ type: 'SET_REWRITE_COMMENT', payload: rewriteDraft })
    }
  }, [rewriteDraft, rewrite.comment])

  // ═══════════════════════════════════════════════════════════════════════════════
  // Pending Commit State
  // ═══════════════════════════════════════════════════════════════════════════════

  const pendingCommitForSelected = selectedPath ? pendingCommit[selectedPath] : undefined
  const pendingCommitMessage = pendingCommitForSelected?.message ?? null
  const pendingCommitGenerating = pendingCommitForSelected?.isGenerating ?? false

  // ═══════════════════════════════════════════════════════════════════════════════
  // Navigation (Phase 6: use-task-navigation)
  // ═══════════════════════════════════════════════════════════════════════════════

  const {
    navigate,
    buildSearchParams,
    handleModeChange,
    handleReviewFileChange,
    handleNavigateToSplitFrom,
  } = useTaskNavigation({
    selectedPath,
    mode,
    archiveFilter,
    sortBy,
    sortDir,
    reviewFile,
    splitFrom: taskData?.splitFrom,
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Mutations (Phase 1: use-task-mutations)
  // ═══════════════════════════════════════════════════════════════════════════════

  const {
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
    isLoading: mutationsLoading,
  } = useTaskMutations({ dispatch, editor, buildSearchParams })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Agent Session Tracking (Phase 3: use-agent-session-tracking)
  // ═══════════════════════════════════════════════════════════════════════════════

  const { agentSession, isActivePlanningSession } = useAgentSessionTracking({
    activeSessionId,
    activeSessionInfo,
    taskSessions,
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Agent Type Synchronization (Phase 4: use-task-agent-type-sync)
  // ═══════════════════════════════════════════════════════════════════════════════

  const {
    handleCreateAgentTypeChange,
    handleRunAgentTypeChange,
    handleRewriteAgentTypeChange,
    handleVerifyAgentTypeChange,
  } = useTaskAgentTypeSync({
    dispatch,
    create,
    run,
    verify,
    rewrite,
    availableTypes,
    availablePlannerTypes,
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Task Content Refresh (Phase 5: use-task-refresh)
  // ═══════════════════════════════════════════════════════════════════════════════

  useTaskRefresh({
    selectedPath,
    workingDir,
    activeSessionId,
    editor,
    dispatch,
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Task Action Handlers (Phase 7: use-task-actions)
  // ═══════════════════════════════════════════════════════════════════════════════

  const utils = trpc.useUtils()

  const {
    debouncedSave,
    debugRunStatus,
    openCreate,
    handleCloseCreate,
    handleCreate,
    handleDelete,
    handleArchive,
    handleRestore,
    handleAssignToAgent,
    handleCloseImplementModal,
    handleStartImplement,
    handleCancelAgent,
    handleReview,
    handleVerify,
    handleCloseDebatePanel,
    handleStartVerify,
    handleCloseVerifyModal,
    handleOpenSplitModal,
    handleOpenCommitArchiveModal,
    handleCloseCommitArchiveModal,
    handleCommitSuccess,
    handleArchiveSuccess,
    handleMergeSuccess,
    activeWorktreeBranch,
    handleMergeToMain,
    handleSetQAPass,
    handleSetQAFail,
    handleRevertMerge,
    handleCloseSplitModal,
    handleSplitTask,
    handleDebateAccept,
    handleRewritePlan,
    handleCloseOrchestratorModal,
  } = useTaskActions({
    selectedPath,
    workingDir,
    activeSessionId,
    latestActiveMerge,
    dispatch,
    editor,
    create,
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
  })

  // Sync create modal state with props
  useEffect(() => {
    if (initialCreateOpen && !create.open) {
      openCreate()
    }
  }, [initialCreateOpen, create.open, openCreate])

  // ═══════════════════════════════════════════════════════════════════════════════
  // UI Rendering
  // ═══════════════════════════════════════════════════════════════════════════════

  const editorTitle = selectedSummary?.title ?? (selectedPath ? selectedPath : 'Tasks')

  // Show message if no working directory set
  if (!workingDir) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 px-3 border-b border-border flex items-center justify-between">
          <h1 className="font-vcr text-sm text-accent">Tasks</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-2">No project selected</p>
            <p className="text-muted-foreground text-xs">
              Select a project directory using the folder selector in the sidebar.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Editor */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-background overflow-hidden">
          {!selectedPath ? (
            showInlineCreateForm ? (
              /* Inline create form centered in content area */
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-panel border border-border rounded shadow-lg">
                  <div className="p-3 border-b border-border">
                    <div className="font-vcr text-sm text-accent">New Task</div>
                  </div>
                  <div className="p-4">
                    <CreateTaskForm
                      isCreating={createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending}
                      newTitle={create.title}
                      taskType={create.taskType}
                      useAgent={create.useAgent}
                      createAgentType={create.agentType}
                      createModel={create.model}
                      availableTypes={availableTypes}
                      availablePlannerTypes={availablePlannerTypes}
                      debugAgents={create.debugAgents}
                      onCreate={handleCreate}
                      onTitleChange={(title) => setCreateTitleDraft(title)}
                      onTaskTypeChange={(taskType) => dispatch({ type: 'SET_CREATE_TASK_TYPE', payload: taskType })}
                      onUseAgentChange={(useAgent) => dispatch({ type: 'SET_CREATE_USE_AGENT', payload: useAgent })}
                      onAgentTypeChange={handleCreateAgentTypeChange}
                      onModelChange={(model) => dispatch({ type: 'SET_CREATE_MODEL', payload: model })}
                      onToggleDebugAgent={(agentType) => dispatch({ type: 'TOGGLE_DEBUG_AGENT', payload: agentType })}
                      onDebugAgentModelChange={(agentType, model) => dispatch({ type: 'SET_DEBUG_AGENT_MODEL', payload: { agentType, model } })}
                      autoFocus={true}
                    />
                  </div>
                  <div className="p-3 border-t border-border">
                    <CreateTaskActions
                      isCreating={createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending}
                      canCreate={
                        create.title.trim().length > 0 &&
                        (!create.useAgent || availablePlannerTypes.length > 0) &&
                        (!create.useAgent || create.taskType !== 'bug' || create.debugAgents.some((da) => da.selected))
                      }
                      onCreate={handleCreate}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )
          ) : mode === 'debate' ? (
            // Debate mode - show inline debate panel
            <DebatePanel
              taskPath={selectedPath}
              taskTitle={editorTitle}
              availableTypes={availableTypes}
              existingDebate={activeDebate}
              onBack={handleCloseDebatePanel}
              onClose={handleCloseDebatePanel}
              onAccept={handleDebateAccept}
            />
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <TaskEditor
                  title={editorTitle}
                  path={selectedPath}
                  mode={mode}
                  draft={editor.draft}
                  taskDescription={editor.draft}
                  createdAt={taskData?.createdAt ?? selectedSummary?.createdAt}
                  updatedAt={taskData?.updatedAt ?? selectedSummary?.updatedAt}
                  subtasks={taskData?.subtasks ?? []}
                  taskVersion={taskData?.version ?? 1}
                  onSubtasksChange={() => utils.tasks.get.invalidate({ path: selectedPath })}
                  isArchived={selectedSummary?.archived ?? false}
                  isArchiving={archiveMutation.isPending}
                  isRestoring={restoreMutation.isPending}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                  onCommitAndArchive={handleOpenCommitArchiveModal}
                  activePlanningOutput={isActivePlanningSession ? agentSession?.output : undefined}
                  isPlanningActive={isActivePlanningSession}
                  reviewFile={reviewFile}
                  onReviewFileChange={handleReviewFileChange}
                  onModeChange={handleModeChange}
                  onDraftChange={(newDraft) => {
                    dispatch({ type: 'SET_DRAFT', payload: newDraft })
                    dispatch({ type: 'SET_DIRTY', payload: true })
                    // Trigger autosave after 500ms of inactivity
                    if (selectedPath) {
                      debouncedSave(selectedPath, newDraft)
                    }
                  }}
                />
              </div>

              {/* Footer with rewrite controls - only show in edit mode */}
              {mode === 'edit' && (
                <TaskFooter
                  rewriteComment={rewrite.comment}
                  rewriteAgentType={rewrite.agentType}
                  rewriteModel={rewrite.model}
                  isRewriting={rewriteWithAgentMutation.isPending}
                  availableTypes={availableTypes}
                  agentSession={agentSession}
                  canSplit={sectionsData?.canSplit}
                  onSplit={handleOpenSplitModal}
                  onRewriteCommentChange={(comment) => {
                    setRewriteDraft(comment)
                    dispatch({ type: 'SET_REWRITE_COMMENT', payload: comment })
                  }}
                  onRewriteAgentTypeChange={handleRewriteAgentTypeChange}
                  onRewriteModelChange={(model) => dispatch({ type: 'SET_REWRITE_MODEL', payload: model })}
                  onRewritePlan={handleRewritePlan}
                />
              )}
            </>
          )}
        </div>

        {/* Right: Task Controls Panel - hidden in review/debate mode */}
        {selectedPath && mode === 'edit' && (
          <div className="w-80 shrink-0 border-l border-border overflow-hidden">
            <TaskSidebar
              mode={mode}
              isSaving={save.saving}
              isDeleting={deleteMutation.isPending}
              isAssigning={assignToAgentMutation.isPending}
              saveError={save.error}
              agentSession={agentSession}
              taskSessions={taskSessions}
              splitFrom={taskData?.splitFrom}
              onNavigateToSplitFrom={handleNavigateToSplitFrom}
              hasActiveDebate={!!activeDebate}
              // QA workflow props
              qaStatus={taskData?.qaStatus}
              latestActiveMerge={latestActiveMerge}
              mergeHistory={taskData?.mergeHistory}
              worktreeBranch={activeWorktreeBranch}
              isMerging={mergeBranchMutation.isPending}
              isReverting={revertMergeMutation.isPending}
              isSettingQA={setQAStatusMutation.isPending}
              onMergeToMain={handleMergeToMain}
              onSetQAPass={handleSetQAPass}
              onSetQAFail={handleSetQAFail}
              onRevertMerge={handleRevertMerge}
              // Action handlers
              onDelete={handleDelete}
              onReview={handleReview}
              onVerify={handleVerify}
              onAssignToAgent={handleAssignToAgent}
              onCancelAgent={handleCancelAgent}
            />
          </div>
        )}
      </div>

      <CreateTaskModal
        isOpen={create.open}
        isCreating={createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending}
        newTitle={create.title}
        taskType={create.taskType}
        useAgent={create.useAgent}
        createAgentType={create.agentType}
        createModel={create.model}
        availableTypes={availableTypes}
        availablePlannerTypes={availablePlannerTypes}
        debugAgents={create.debugAgents}
        onClose={handleCloseCreate}
        onCreate={handleCreate}
        onTitleChange={(title) => setCreateTitleDraft(title)}
        onTaskTypeChange={(taskType) => dispatch({ type: 'SET_CREATE_TASK_TYPE', payload: taskType })}
        onUseAgentChange={(useAgent) => dispatch({ type: 'SET_CREATE_USE_AGENT', payload: useAgent })}
        onAgentTypeChange={handleCreateAgentTypeChange}
        onModelChange={(model) => dispatch({ type: 'SET_CREATE_MODEL', payload: model })}
        onToggleDebugAgent={(agentType) => dispatch({ type: 'TOGGLE_DEBUG_AGENT', payload: agentType })}
        onDebugAgentModelChange={(agentType, model) => dispatch({ type: 'SET_DEBUG_AGENT_MODEL', payload: { agentType, model } })}
      />

      {/* Verify uses ReviewModal (single agent) - defaults to codex */}
      <ReviewModal
        isOpen={modals.verifyOpen}
        mode="verify"
        taskTitle={editorTitle}
        agentType={verify.agentType}
        model={verify.model}
        availableTypes={availableTypes}
        onClose={handleCloseVerifyModal}
        onStart={handleStartVerify}
      />

      {/* Implement Modal - agent/model selection before implementation */}
      <ImplementModal
        isOpen={modals.implementOpen}
        taskTitle={editorTitle}
        agentType={run.agentType}
        model={run.model}
        availableTypes={availableTypes}
        onClose={handleCloseImplementModal}
        onStart={handleStartImplement}
      />

      {/* Split Task Modal */}
      <SplitTaskModal
        isOpen={modals.splitOpen}
        isSplitting={splitTaskMutation.isPending}
        taskTitle={editorTitle}
        sections={sectionsData?.sections ?? []}
        currentSubtaskCount={taskData?.subtaskCount ?? 0}
        maxSubtasks={20}
        onClose={handleCloseSplitModal}
        onSplit={handleSplitTask}
      />

      {/* Commit and Archive Modal */}
      {selectedPath && (
        <CommitArchiveModal
          isOpen={modals.commitArchiveOpen}
          taskPath={selectedPath}
          taskTitle={editorTitle}
          taskContent={editor.draft}
          initialMessage={pendingCommitMessage}
          isGeneratingInitial={pendingCommitGenerating}
          sessionId={activeSessionId}
          worktreeBranch={activeWorktreeBranch}
          onClose={handleCloseCommitArchiveModal}
          onCommitSuccess={handleCommitSuccess}
          onArchiveSuccess={handleArchiveSuccess}
          onMergeSuccess={handleMergeSuccess}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'CLOSE_CONFIRM_DIALOG' })
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />

      {/* Orchestrator Modal - Shows live codex synthesis of debug outputs */}
      <OrchestratorModal
        isOpen={modals.orchestratorOpen}
        sessionId={orchestrator.sessionId}
        taskPath={selectedPath}
        onClose={handleCloseOrchestratorModal}
      />
    </div>
  )
}
