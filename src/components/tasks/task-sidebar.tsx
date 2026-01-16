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

interface TaskSidebarProps {
  // Mode - hide sessions/controls in review/debate mode
  mode: 'edit' | 'review' | 'debate'

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
  onCancelAgent?: (sessionId: string) => void
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
  onCancelAgent,
}: TaskSidebarProps) {
  // State for collapsible merge history
  const [showMergeHistory, setShowMergeHistory] = useState(false)

  // Hide sessions and controls in review mode
  if (mode === 'review') {
    return null
  }

  // Determine if merge button should be shown
  const canMerge = worktreeBranch && !latestActiveMerge && onMergeToMain
  const showQAControls = qaStatus === 'pending' && latestActiveMerge
  const canRevert = qaStatus === 'fail' && latestActiveMerge && !latestActiveMerge.revertedAt
  const hasHistory = mergeHistory && mergeHistory.length > 0

  return (
    <div className="w-full h-full bg-panel overflow-y-auto flex flex-col">
      <div className="p-3 flex-1 flex flex-col">
        {/* Controls Section */}
        <div className="space-y-2 mb-4">
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

          {/* Main action buttons - REVIEW, IMPLEMENT, VERIFY */}
          <div className="flex gap-2">
            <Button
              onClick={onReview}
              disabled={!!agentSession}
              variant={hasActiveDebate ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-[11px] uppercase tracking-wide"
              title={hasActiveDebate ? "Resume active spec review" : "Review spec quality"}
            >
              Review
            </Button>

            <Button
              onClick={onAssignToAgent}
              disabled={isAssigning || !!agentSession}
              variant="default"
              size="sm"
              className="flex-1 text-[11px] uppercase tracking-wide"
              title="Assign to AI agent"
            >
              {isAssigning ? '...' : 'Implement'}
            </Button>

            <Button
              onClick={onVerify}
              disabled={!!agentSession}
              variant="outline"
              size="sm"
              className="flex-1 text-[11px] uppercase tracking-wide"
              title="Verify against codebase"
            >
              Verify
            </Button>
          </div>

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

        {/* QA Workflow Section */}
        {(canMerge || qaStatus || latestActiveMerge) && (
          <div className="space-y-3 mb-4 pt-2 border-t border-border/50">
            <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
              QA Workflow
            </h3>

            {/* QA Status Badge */}
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

            {/* Merge Button - show when branch exists and no active merge */}
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

            {/* QA Pass/Fail buttons - show when QA status is pending */}
            {showQAControls && (
              <div className="flex gap-2">
                <Button
                  onClick={onSetQAPass}
                  disabled={isSettingQA}
                  variant="success"
                  size="xs"
                  className="flex-1 flex items-center justify-center gap-1"
                  title="Mark QA as passed - changes are good"
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
                  title="Mark QA as failed - will enable revert"
                >
                  <XCircle className="w-3 h-3" />
                  Fail
                </Button>
              </div>
            )}

            {/* Revert Button - show when QA failed and merge exists */}
            {canRevert && onRevertMerge && (
              <Button
                onClick={onRevertMerge}
                disabled={isReverting}
                variant="destructive"
                size="xs"
                className="w-full flex items-center justify-center gap-2"
                title="Revert the merge commit to restore main branch"
              >
                <RotateCcw className="w-3 h-3" />
                {isReverting ? 'Reverting...' : 'Revert Merge'}
              </Button>
            )}

            {/* Merge History */}
            {hasHistory && (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowMergeHistory(!showMergeHistory)}
                  variant="ghost"
                  size="xs"
                  className="flex items-center gap-1 text-[10px] h-auto px-0 py-0"
                >
                  {showMergeHistory ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <History className="w-3 h-3" />
                  <span>Merge History ({mergeHistory.length})</span>
                </Button>

                {showMergeHistory && (
                  <div className="space-y-1 pl-4 border-l border-border/30">
                    {mergeHistory.map((entry, idx) => (
                      <div
                        key={entry.commitHash}
                        className={`text-[10px] p-1.5 rounded ${
                          entry.revertedAt
                            ? 'bg-error/5 text-text-muted'
                            : idx === mergeHistory.length - 1 && !entry.revertedAt
                              ? 'bg-accent/5 text-text-secondary'
                              : 'text-text-muted'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {entry.revertedAt ? (
                            <RotateCcw className="w-2.5 h-2.5 text-error" />
                          ) : (
                            <GitMerge className="w-2.5 h-2.5 text-accent" />
                          )}
                          <span className="font-mono">{entry.commitHash.slice(0, 7)}</span>
                          <span className="text-text-muted">
                            {new Date(entry.mergedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {entry.revertedAt && (
                          <div className="text-error ml-3.5 mt-0.5">
                            Reverted {new Date(entry.revertedAt).toLocaleDateString()}
                            {entry.revertCommitHash && (
                              <span className="font-mono ml-1">
                                ({entry.revertCommitHash.slice(0, 7)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Current merge info (quick view when history collapsed) */}
            {latestActiveMerge && !showMergeHistory && (
              <div className="text-[10px] text-text-muted">
                Latest: {latestActiveMerge.commitHash.slice(0, 7)} ({new Date(latestActiveMerge.mergedAt).toLocaleDateString()})
                {latestActiveMerge.revertedAt && (
                  <span className="text-error"> - Reverted</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sessions Section */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <h3 className="text-xs font-vcr text-text-muted uppercase tracking-wider">
            Sessions
          </h3>
          {taskSessions ? (
            <TaskSessions
              planning={taskSessions.grouped.planning}
              review={taskSessions.grouped.review}
              verify={taskSessions.grouped.verify}
              execution={taskSessions.grouped.execution}
              rewrite={taskSessions.grouped.rewrite}
              comment={taskSessions.grouped.comment}
              orchestrator={taskSessions.grouped.orchestrator}
              onCancelSession={onCancelAgent}
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

        {/* Delete Button - pushed to bottom */}
        <div className="mt-auto pt-4 border-t border-border/50">
          <Button
            onClick={onDelete}
            disabled={isDeleting}
            variant="ghost"
            size="xs"
            className="w-full text-error hover:text-error hover:bg-error/10"
            title="Delete this task"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
