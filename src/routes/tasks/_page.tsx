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
import { CreateTaskForm, CreateTaskActions } from '@/components/tasks/create-task-form'
import { Plus as PlusIcon } from 'lucide-react'
import { ReviewModal } from '@/components/tasks/review-modal'
import { ImplementModal } from '@/components/tasks/implement-modal'
import { SplitTaskModal } from '@/components/tasks/split-task-modal'
import { CommitArchiveModal } from '@/components/tasks/commit-archive-modal'
import { UnarchiveModal } from '@/components/tasks/unarchive-modal'
import { DebatePanel } from '@/components/debate'
import { OrchestratorModal } from '@/components/tasks/orchestrator-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorBoundary } from '@/components/ui/error-boundary'
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
import { useHotkey } from '@/lib/hooks/use-hotkeys'
import { KEYMAP, isHotkeyActive } from '@/lib/hotkeys/keymap'
import { useRouterState } from '@tanstack/react-router'

type Mode = 'edit' | 'review' | 'debate'

interface TasksPageProps {
  /** Selected task path (decoded from URL) */
  selectedPath: string | null
  /** Current mode (edit or review) from URL */
  mode?: Mode
  /** Selected file in review mode (git-relative path) */
  reviewFile?: string
}

export function TasksPage({
  selectedPath,
  mode = 'edit',
  reviewFile,
}: TasksPageProps) {
  // ═══════════════════════════════════════════════════════════════════════════════
  // State Management
  // ═══════════════════════════════════════════════════════════════════════════════

  const [state, dispatch] = useReducer(tasksReducer, false, createInitialState)
  const { editor, create, run, verify, rewrite, save, modals, unarchive, pendingCommit, confirmDialog, orchestrator } = state
  const createRenderMode = getCreateTaskRenderMode({
    selectedPath,
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
    unarchiveWithContextMutation,
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
  } = useTaskMutations({ dispatch, editor, buildSearchParams })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Agent Session Tracking (Phase 3: use-agent-session-tracking)
  // ═══════════════════════════════════════════════════════════════════════════════

  const { agentSession, isActivePlanningSession } = useAgentSessionTracking({
    activeSessionId,
    activeSessionInfo,
    taskSessions,
    taskTitle: selectedSummary?.title,
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
    handleCreate,
    handleDelete,
    handleArchive,
    handleRestore,
    handleOpenUnarchiveModal,
    handleCloseUnarchiveModal,
    handleUnarchiveWithContext,
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
    unarchiveWithContextMutation,
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
  })

  // ═══════════════════════════════════════════════════════════════════════════════
  // Task Hotkeys (Phase 8: task-specific hotkeys)
  // ═══════════════════════════════════════════════════════════════════════════════

  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  // Implement task (i) - only when task is selected
  useHotkey({
    keys: KEYMAP.RUN_IMPLEMENT.keys,
    handler: () => {
      if (selectedPath && !agentSession) {
        handleAssignToAgent()
      }
    },
    enabled: !!selectedPath && isHotkeyActive(KEYMAP.RUN_IMPLEMENT, pathname),
    preventDefault: true,
  })

  // Verify task (v) - only when task is selected
  useHotkey({
    keys: KEYMAP.RUN_VERIFY.keys,
    handler: () => {
      if (selectedPath && !agentSession) {
        handleVerify()
      }
    },
    enabled: !!selectedPath && isHotkeyActive(KEYMAP.RUN_VERIFY, pathname),
    preventDefault: true,
  })

  // Review task (r) - only when task is selected
  useHotkey({
    keys: KEYMAP.REVIEW_TASK.keys,
    handler: () => {
      if (selectedPath && !agentSession) {
        handleReview()
      }
    },
    enabled: !!selectedPath && isHotkeyActive(KEYMAP.REVIEW_TASK, pathname),
    preventDefault: true,
  })

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
              /* Inline create form centered in content area - cmdk style */
              <div className="flex-1 flex items-start justify-center pt-[12%] p-4">
                <div className="w-full max-w-lg bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                    <PlusIcon className="w-4 h-4 text-accent shrink-0" />
                    <span className="flex-1 text-sm font-vcr text-foreground">New Task</span>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
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
                      autoRun={create.autoRun}
                      runAgentType={run.agentType}
                      runModel={run.model}
                      onCreate={handleCreate}
                      onTitleChange={(title) => {
                        setCreateTitleDraft(title)
                        dispatch({ type: 'SET_CREATE_TITLE', payload: title })
                      }}
                      onTaskTypeChange={(taskType) => dispatch({ type: 'SET_CREATE_TASK_TYPE', payload: taskType })}
                      onUseAgentChange={(useAgent) => dispatch({ type: 'SET_CREATE_USE_AGENT', payload: useAgent })}
                      onAgentTypeChange={handleCreateAgentTypeChange}
                      onModelChange={(model) => dispatch({ type: 'SET_CREATE_MODEL', payload: model })}
                      onAutoRunChange={(autoRun) => dispatch({ type: 'SET_CREATE_AUTO_RUN', payload: autoRun })}
                      onToggleDebugAgent={(agentType) => dispatch({ type: 'TOGGLE_DEBUG_AGENT', payload: agentType })}
                      onDebugAgentModelChange={(agentType, model) => dispatch({ type: 'SET_DEBUG_AGENT_MODEL', payload: { agentType, model } })}
                      onRunAgentTypeChange={handleRunAgentTypeChange}
                      onRunModelChange={(model) => dispatch({ type: 'SET_RUN_MODEL', payload: model })}
                      autoFocus={true}
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-border/50 bg-background/30">
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
            <ErrorBoundary
              name="DebatePanel"
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
                    Failed to load debate panel
                  </div>
                </div>
              }
            >
              <DebatePanel
                taskPath={selectedPath}
                taskTitle={editorTitle}
                availableTypes={availableTypes}
                existingDebate={activeDebate}
                onBack={handleCloseDebatePanel}
                onClose={handleCloseDebatePanel}
                onAccept={handleDebateAccept}
              />
            </ErrorBoundary>
          ) : (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <ErrorBoundary
                  name="TaskEditor"
                  fallback={
                    <div className="flex-1 flex items-center justify-center">
                      <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
                        Failed to load task editor
                      </div>
                    </div>
                  }
                >
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
                    onUnarchiveWithAgent={handleOpenUnarchiveModal}
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
                </ErrorBoundary>
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
            <ErrorBoundary
              name="TaskSidebar"
              fallback={
                <div className="p-4 text-sm text-destructive bg-destructive/10">
                  Sidebar failed to load
                </div>
              }
            >
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
            </ErrorBoundary>
          </div>
        )}
      </div>

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

      {/* Unarchive with Context Modal */}
      <UnarchiveModal
        open={modals.unarchiveOpen}
        onClose={handleCloseUnarchiveModal}
        onSubmit={handleUnarchiveWithContext}
        taskTitle={editorTitle}
        availableAgentTypes={availablePlannerTypes}
        defaultAgentType={unarchive.agentType}
        defaultModel={unarchive.model}
        isSubmitting={unarchiveWithContextMutation.isPending}
      />

      {/* Commit and Archive Modal */}
      {selectedPath && (
        <ErrorBoundary
          name="CommitArchiveModal"
          fallback={null}
        >
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
        </ErrorBoundary>
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
