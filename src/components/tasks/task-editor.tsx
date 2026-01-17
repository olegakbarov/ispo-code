/**
 * Task editor component with edit/review modes
 */

import { TaskReviewPanel } from './task-review-panel'
import { SubtaskSection } from './subtask-section'
import { OutputRenderer } from '@/components/agents/output-renderer'
import { Spinner } from '@/components/ui/spinner'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { formatDateTime, formatTimeAgo } from '@/lib/utils/time'
import type { AgentOutputChunk } from '@/lib/agent/types'
import type { SubTask } from '@/lib/agent/task-service'

export type EditTab = 'draft' | 'subtasks'

// Looser output type from agent-types.ts for compatibility
type OutputChunk = { type: string; content: string; timestamp?: string }

type Mode = 'edit' | 'review' | 'debate'

interface TaskEditorProps {
  title: string
  path: string
  mode: Mode
  editTab: EditTab
  draft: string
  taskDescription?: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
  // Subtasks
  subtasks?: SubTask[]
  subtasksCount?: number
  taskVersion?: number
  onSubtasksChange?: () => void
  // Mode/tab navigation callbacks
  onModeChange?: (mode: Mode) => void
  onEditTabChange?: (tab: EditTab) => void
  // Archive state for review panel
  isArchived?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onArchive?: () => void
  onRestore?: () => void
  onUnarchiveWithAgent?: () => void
  /** Pre-generated commit message */
  initialCommitMessage?: string | null
  /** Whether the initial message is still being generated */
  isGeneratingCommitMessage?: boolean
  /** Session ID for tracking merge history */
  sessionId?: string
  /** Worktree branch name if using worktree isolation */
  worktreeBranch?: string
  /** Called after successful archive */
  onArchiveSuccess?: () => void
  /** Called after successful merge */
  onMergeSuccess?: () => void
  // Active planning session output (when planning is in progress)
  activePlanningOutput?: OutputChunk[]
  isPlanningActive?: boolean
  // Review mode - selected file from URL
  reviewFile?: string
  onReviewFileChange?: (file: string | null) => void
  // Callbacks
  onDraftChange: (draft: string) => void
}

export function TaskEditor({
  title,
  path,
  mode,
  editTab,
  draft,
  taskDescription,
  createdAt,
  // updatedAt is available but not displayed currently
  subtasks = [],
  subtasksCount = 0,
  taskVersion = 1,
  onSubtasksChange,
  onModeChange,
  onEditTabChange,
  isArchived,
  isArchiving,
  isRestoring,
  onArchive,
  onRestore,
  onUnarchiveWithAgent,
  initialCommitMessage,
  isGeneratingCommitMessage,
  sessionId,
  worktreeBranch,
  onArchiveSuccess,
  onMergeSuccess,
  activePlanningOutput,
  isPlanningActive,
  reviewFile,
  onReviewFileChange,
  onDraftChange,
}: TaskEditorProps) {
  // Check if task content has debug placeholder (for header text display)
  // Matches both single-agent "_Investigating bug..._" and multi-agent "_Investigating bug with N agent(s)..._"
  const isDebugTask = draft.includes('_Investigating bug')

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 h-12 border-b border-border bg-panel/80 backdrop-blur">
        <div className="flex items-center gap-3 w-full h-full px-3">
          <div className="min-w-0 flex-1 font-vcr text-xs text-text-secondary truncate">
            {title}
          </div>

          <div className="shrink-0 flex items-center gap-3">
            {isPlanningActive && (
              <div className="flex items-center gap-2">
                <Spinner size="sm" className="text-accent" />
                <span className="font-vcr text-[10px] text-accent tracking-wide">
                  {isDebugTask ? 'INVESTIGATING BUG' : 'GENERATING PLAN'}
                </span>
              </div>
            )}

            {/* Timestamps */}
            {createdAt && (
              <div className="text-[10px] text-text-muted font-mono" title={`Created: ${formatDateTime(createdAt)}`}>
                {formatTimeAgo(createdAt)}
              </div>
            )}

            {/* Mode/Tab Navigation */}
            {onModeChange && onEditTabChange && (
              <div className="flex border border-border rounded overflow-hidden">
                <button
                  onClick={() => {
                    onModeChange('edit')
                    onEditTabChange('draft')
                  }}
                  className={`px-2 py-1 text-[10px] font-vcr transition-colors ${
                    mode === 'edit' && editTab === 'draft'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  Plan
                </button>
                <button
                  onClick={() => {
                    onModeChange('edit')
                    onEditTabChange('subtasks')
                  }}
                  className={`px-2 py-1 text-[10px] font-vcr transition-colors border-l border-border flex items-center gap-1 ${
                    mode === 'edit' && editTab === 'subtasks'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  Subtasks
                  {subtasksCount > 0 && (
                    <span className={`px-1 min-w-[14px] text-center rounded text-[9px] ${
                      mode === 'edit' && editTab === 'subtasks' ? 'bg-accent-foreground/20' : 'bg-border/50'
                    }`}>
                      {subtasksCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => onModeChange('review')}
                  className={`px-2 py-1 text-[10px] font-vcr transition-colors border-l border-border ${
                    mode === 'review'
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  Review
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto ${mode === 'edit' ? 'pb-64' : ''}`}>
        {mode === 'edit' ? (
          isPlanningActive ? (
            <div className="p-3">
              {activePlanningOutput && activePlanningOutput.length > 0 ? (
                <OutputRenderer chunks={activePlanningOutput as AgentOutputChunk[]} />
              ) : (
                <div className="text-sm text-muted-foreground">Waiting for output...</div>
              )}
            </div>
          ) : editTab === 'draft' ? (
            <div className="flex justify-center p-3">
              <MarkdownEditor
                value={draft}
                onChange={onDraftChange}
                variant="sm"
                containerClassName="max-w-[900px] w-full"
                placeholder="Click to edit task description..."
                spellCheck={false}
                rows={3}
              />
            </div>
          ) : (
            <div className="p-3">
              <ErrorBoundary
                name="SubtaskSection"
                fallback={
                  <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
                    Failed to load subtasks
                  </div>
                }
              >
                <SubtaskSection
                  taskPath={path}
                  subtasks={subtasks}
                  version={taskVersion}
                  onRefresh={onSubtasksChange ?? (() => {})}
                />
              </ErrorBoundary>
            </div>
          )
        ) : (
          <div className="h-full">
            <ErrorBoundary
              name="TaskReviewPanel"
              fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded">
                    Failed to load review panel
                  </div>
                </div>
              }
            >
              <TaskReviewPanel
                taskPath={path}
                taskTitle={title}
                taskDescription={taskDescription}
                isArchived={isArchived}
                isArchiving={isArchiving}
                isRestoring={isRestoring}
                onArchive={onArchive}
                onRestore={onRestore}
                onUnarchiveWithAgent={onUnarchiveWithAgent}
                initialCommitMessage={initialCommitMessage}
                isGeneratingCommitMessage={isGeneratingCommitMessage}
                sessionId={sessionId}
                worktreeBranch={worktreeBranch}
                onArchiveSuccess={onArchiveSuccess}
                onMergeSuccess={onMergeSuccess}
                reviewFile={reviewFile}
                onReviewFileChange={onReviewFileChange}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  )
}
