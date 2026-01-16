/**
 * Task editor component with edit/review modes
 */

import { useState } from 'react'
import { TaskReviewPanel } from './task-review-panel'
import { SubtaskSection } from './subtask-section'
import { OutputRenderer } from '@/components/agents/output-renderer'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { formatDateTime, formatTimeAgo } from '@/lib/utils/time'
import type { AgentOutputChunk } from '@/lib/agent/types'
import type { SubTask } from '@/lib/agent/task-service'

type EditTab = 'draft' | 'subtasks'

// Looser output type from agent-types.ts for compatibility
type OutputChunk = { type: string; content: string; timestamp?: string }

type Mode = 'edit' | 'review' | 'debate'

interface TaskEditorProps {
  title: string
  path: string
  mode: Mode
  draft: string
  taskDescription?: string
  // Timestamps
  createdAt?: string
  updatedAt?: string
  // Subtasks
  subtasks?: SubTask[]
  taskVersion?: number
  onSubtasksChange?: () => void
  // Archive state for review panel
  isArchived?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onArchive?: () => void
  onRestore?: () => void
  onUnarchiveWithAgent?: () => void
  onCommitAndArchive?: () => void
  // Active planning session output (when planning is in progress)
  activePlanningOutput?: OutputChunk[]
  isPlanningActive?: boolean
  // Review mode - selected file from URL
  reviewFile?: string
  onReviewFileChange?: (file: string | null) => void
  // Callbacks
  onModeChange: (mode: Mode) => void
  onDraftChange: (draft: string) => void
}

export function TaskEditor({
  title,
  path,
  mode,
  draft,
  taskDescription,
  createdAt,
  // updatedAt is available but not displayed currently
  subtasks = [],
  taskVersion = 1,
  onSubtasksChange,
  isArchived,
  isArchiving,
  isRestoring,
  onArchive,
  onRestore,
  onUnarchiveWithAgent,
  onCommitAndArchive,
  activePlanningOutput,
  isPlanningActive,
  reviewFile,
  onReviewFileChange,
  onModeChange,
  onDraftChange,
}: TaskEditorProps) {
  // Check if task content has debug placeholder (for header text display)
  // Matches both single-agent "_Investigating bug..._" and multi-agent "_Investigating bug with N agent(s)..._"
  const isDebugTask = draft.includes('_Investigating bug')

  // Edit mode sub-tabs (Draft/Subtasks)
  const [editTab, setEditTab] = useState<EditTab>('draft')
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 h-12 border-b border-border bg-panel/80 backdrop-blur">
        <div className="flex items-center gap-3 w-full h-full px-3">
          {/* Header tabs */}
          <div className="flex items-center shrink-0">
            <div className="flex items-center border border-border rounded overflow-hidden">
              <button
                onClick={() => {
                  onModeChange('edit')
                  setEditTab('draft')
                }}
                className={`px-2 py-1 text-xs font-vcr transition-colors ${
                  mode === 'edit' && editTab === 'draft'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  onModeChange('edit')
                  setEditTab('subtasks')
                }}
                className={`px-2 py-1 text-xs font-vcr transition-colors border-l border-border flex items-center gap-1.5 ${
                  mode === 'edit' && editTab === 'subtasks'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                Subtasks
                {subtasks.length > 0 && (
                  <span className={`px-1 min-w-[16px] text-center rounded text-[10px] ${
                    mode === 'edit' && editTab === 'subtasks' ? 'bg-accent-foreground/20' : 'bg-border/50'
                  }`}>
                    {subtasks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => onModeChange('review')}
                className={`px-2 py-1 text-xs font-vcr transition-colors border-l border-border ${
                  mode === 'review'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                Review
              </button>
            </div>
          </div>

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
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
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
              <div className="grow-wrap w-full max-w-[900px]" data-replicated-value={draft}>
                <Textarea
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  variant="sm"
                  className="w-full bg-transparent font-mono border-0"
                  spellCheck={false}
                  rows={3}
                />
              </div>
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
                onCommitAndArchive={onCommitAndArchive}
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
