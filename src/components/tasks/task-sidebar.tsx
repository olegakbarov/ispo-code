/**
 * Task Sidebar Component
 * Contains all task controls, rewrite panel, commit panel, and sessions list
 */

import { TaskSessions, type TaskSessionsGrouped } from './task-sessions'
import type { AgentSession } from './agent-types'
import { useState } from 'react'
import { ExternalLink, GitMerge, CheckCircle, XCircle, Clock, RotateCcw, ChevronDown, ChevronRight, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { QAStatus, MergeHistoryEntry } from '@/lib/agent/task-service'
import { FileListPanel, type ChangedFile } from './file-list-panel'
import { CommitActionPanel } from './commit-action-button'
import type { GitDiffView } from '@/components/git/file-list'

type Mode = 'edit' | 'review' | 'debate'

interface TaskSidebarProps {
  // Mode for conditional rendering
  mode: Mode

  // Control state
  isSaving: boolean
  isDeleting: boolean
  isAssigning: boolean
  saveError: string | null

  // Agent session
  agentSession: AgentSession | null

  // Sessions list
  taskSessions?: {
    grouped: TaskSessionsGrouped
  }

  // Split from badge
  splitFrom?: string
  onNavigateToSplitFrom?: () => void

  // Commit and archive
  hasUncommittedChanges?: boolean
  onCommitAndArchive?: () => void

  // Debate state
  hasActiveDebate?: boolean

  // QA workflow state
  qaStatus?: QAStatus
  latestActiveMerge?: MergeHistoryEntry | null
  mergeHistory?: MergeHistoryEntry[]
  worktreeBranch?: string
  isMerging?: boolean
  isReverting?: boolean
  isSettingQA?: boolean

  // QA workflow handlers
  onMergeToMain?: () => void
  onSetQAPass?: () => void
  onSetQAFail?: () => void
  onRevertMerge?: () => void

  // Handlers
  onDelete: () => void
  onReview: () => void
  onVerify: () => void
  onAssignToAgent: () => void

  // Review mode - file list and commit
  reviewFiles?: ChangedFile[]
  reviewActiveFile?: string | null
  reviewFilesLoading?: boolean
  onReviewFileClick?: (file: string, view: GitDiffView, sessionWorkingDir?: string) => void
  // Commit action panel props (for review mode)
  taskPath?: string
  taskTitle?: string
  taskContent?: string
  gitRelativeFiles?: string[]
  initialCommitMessage?: string | null
  isGeneratingCommitMessage?: boolean
  sessionId?: string
  onArchiveSuccess?: () => void
  onMergeSuccess?: () => void
}

export function TaskSidebar({
  mode,
  isSaving,
  isDeleting,
  isAssigning,
  saveError,
  agentSession,
  taskSessions,
  splitFrom,
  onNavigateToSplitFrom,
  hasActiveDebate,
  qaStatus,
  latestActiveMerge,
  mergeHistory,
  worktreeBranch,
  isMerging,
  isReverting,
  isSettingQA,
  onMergeToMain,
  onSetQAPass,
  onSetQAFail,
  onRevertMerge,
  onDelete,
  onReview,
  onVerify,
  onAssignToAgent,
  // Review mode props
  reviewFiles,
  reviewActiveFile,
  reviewFilesLoading,
  onReviewFileClick,
  taskPath,
  taskTitle,
  taskContent,
  gitRelativeFiles,
  initialCommitMessage,
  isGeneratingCommitMessage,
  sessionId,
  onArchiveSuccess,
  onMergeSuccess,
}: TaskSidebarProps) {
  // State for collapsible merge history
  const [showMergeHistory, setShowMergeHistory] = useState(false)

  // Determine if merge button should be shown
  const canMerge = worktreeBranch && sessionId && !latestActiveMerge && onMergeToMain
  const showQAControls = qaStatus === 'pending' && latestActiveMerge
  const canRevert = qaStatus === 'fail' && latestActiveMerge && !latestActiveMerge.revertedAt
  const hasHistory = mergeHistory && mergeHistory.length > 0

  return (
    <div className="w-full h-full bg-panel overflow-y-auto flex flex-col">
      <div className="p-3 flex-1 flex flex-col">
        {/* Status indicators - only show in edit mode */}
        {mode === 'edit' && (
          <div className="mb-2">
            {saveError && (
              <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
                {saveError}
              </div>
            )}
            {isSaving && (
              <span className="text-[10px] text-text-muted animate-pulse block text-right">
                Saving...
              </span>
            )}

            {/* Split From Badge */}
            {splitFrom && onNavigateToSplitFrom && (
              <Button
                onClick={onNavigateToSplitFrom}
                variant="default"
                size="sm"
                className="w-full flex items-center gap-2 justify-start"
                title={`Split from: ${splitFrom}`}
              >
                <ExternalLink className="w-3 h-3" />
                <span className="truncate text-xs">Split from: {splitFrom.replace('tasks/', '')}</span>
              </Button>
            )}
          </div>
        )}

        {/* Review Mode - File list, commit panel, and QA workflow */}
        {mode === 'review' && (
          <div className="flex-1 flex flex-col min-h-0 -mx-3 -mb-3">
            {reviewFilesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Loading files...</span>
              </div>
            ) : reviewFiles && reviewFiles.length > 0 ? (
              <>
                <FileListPanel
                  files={reviewFiles}
                  activeFile={reviewActiveFile}
                  onFileClick={onReviewFileClick ?? (() => {})}
                />
                {/* Commit + QA Workflow container */}
                <div className="shrink-0 border-t border-border/50">
                  {taskPath && (
                    <CommitActionPanel
                      taskPath={taskPath}
                      taskTitle={taskTitle ?? ''}
                      taskContent={taskContent}
                      fileCount={reviewFiles.length}
                      gitRelativeFiles={gitRelativeFiles ?? []}
                      initialMessage={initialCommitMessage}
                      isGeneratingInitial={isGeneratingCommitMessage}
                      sessionId={sessionId}
                      worktreeBranch={worktreeBranch}
                      onArchiveSuccess={onArchiveSuccess}
                      onMergeSuccess={onMergeSuccess}
                    />
                  )}
                  {/* QA Workflow - Merge to Main */}
                  {(canMerge || qaStatus || latestActiveMerge) && (
                    <div className="space-y-2 p-3 border-t border-border/50">
                      <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
                        QA Workflow
                      </h3>
                      {qaStatus && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-vcr ${
                          qaStatus === 'pending' ? 'bg-warning/10 border border-warning/30 text-warning' :
                          qaStatus === 'pass' ? 'bg-success/10 border border-success/30 text-success' :
                          'bg-error/10 border border-error/30 text-error'
                        }`}>
                          {qaStatus === 'pending' && <Clock className="w-3 h-3" />}
                          {qaStatus === 'pass' && <CheckCircle className="w-3 h-3" />}
                          {qaStatus === 'fail' && <XCircle className="w-3 h-3" />}
                          <span>QA: {qaStatus.toUpperCase()}</span>
                        </div>
                      )}
                      {canMerge && (
                        <Button
                          onClick={onMergeToMain}
                          disabled={isMerging || !!agentSession}
                          variant="default"
                          size="xs"
                          className="w-full flex items-center justify-center gap-2"
                          title={`Merge ${worktreeBranch} to main`}
                        >
                          <GitMerge className="w-3 h-3" />
                          {isMerging ? 'Merging...' : 'Merge to Main'}
                        </Button>
                      )}
                      {showQAControls && (
                        <div className="flex gap-2">
                          <Button
                            onClick={onSetQAPass}
                            disabled={isSettingQA}
                            variant="success"
                            size="xs"
                            className="flex-1 flex items-center justify-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Pass
                          </Button>
                          <Button
                            onClick={onSetQAFail}
                            disabled={isSettingQA}
                            variant="destructive"
                            size="xs"
                            className="flex-1 flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            Fail
                          </Button>
                        </div>
                      )}
                      {canRevert && onRevertMerge && (
                        <Button
                          onClick={onRevertMerge}
                          disabled={isReverting}
                          variant="destructive"
                          size="xs"
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {isReverting ? 'Reverting...' : 'Revert Merge'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <span className="text-xs text-muted-foreground text-center">
                  No files changed yet
                </span>
              </div>
            )}
          </div>
        )}

        {/* Sessions Section - only in edit mode */}
        {mode === 'edit' && (
          <div className="flex-1 min-h-0 overflow-y-auto pb-4 border-b border-border/50">
            {taskSessions ? (
              <TaskSessions
                planning={taskSessions.grouped.planning}
                review={taskSessions.grouped.review}
                verify={taskSessions.grouped.verify}
                execution={taskSessions.grouped.execution}
                rewrite={taskSessions.grouped.rewrite}
                comment={taskSessions.grouped.comment}
                orchestrator={taskSessions.grouped.orchestrator}
              />
            ) : (
              <div className="p-4 border border-border/40 rounded text-center">
                <p className="text-xs text-text-muted">No sessions yet</p>
                <p className="text-[10px] text-text-muted mt-1">
                  Sessions will appear here when you run an agent
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons + Delete - only in edit mode, pushed to bottom */}
        {mode === 'edit' && (
          <div className="shrink-0 pt-4 space-y-2">
            {/* Main action buttons */}
            <Button
              onClick={onReview}
              disabled={!!agentSession}
              variant={hasActiveDebate ? 'default' : 'outline'}
              size="sm"
              className="w-full text-[11px] uppercase tracking-wide"
              title={hasActiveDebate ? "Resume active spec review" : "Review spec quality"}
            >
              Review
            </Button>

            <Button
              onClick={onAssignToAgent}
              disabled={isAssigning || !!agentSession}
              variant="default"
              size="sm"
              className="w-full text-[11px] uppercase tracking-wide"
              title="Assign to AI agent"
            >
              {isAssigning ? '...' : 'Implement'}
            </Button>

            <Button
              onClick={onVerify}
              disabled={!!agentSession}
              variant="outline"
              size="sm"
              className="w-full text-[11px] uppercase tracking-wide"
              title="Verify against codebase"
            >
              Verify
            </Button>

            {/* Divider */}
            <div className="pt-3 mt-3 border-t border-border/50">
              {/* Delete button */}
              <Button
                onClick={onDelete}
                disabled={isDeleting}
                variant="destructive"
                size="sm"
                className="w-full text-[11px] uppercase tracking-wide"
                title="Delete this task"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
