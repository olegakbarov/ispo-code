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
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-panel/80 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-3 w-full">
          {/* Mode tabs */}
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => onModeChange('edit')}
              className={`px-2 py-1 text-xs font-vcr transition-colors ${
                mode === 'edit'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              Edit
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

          <div className="min-w-0 flex-1 font-vcr text-xs text-text-secondary truncate">
            {title}
          </div>

          {/* Timestamps */}
          {createdAt && (
            <div className="shrink-0 text-[10px] text-text-muted font-mono" title={`Created: ${formatDateTime(createdAt)}`}>
              {formatTimeAgo(createdAt)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'edit' ? (
          // Show session output when planning is active (regardless of placeholder text)
          isPlanningActive ? (
            <div className="w-full h-full overflow-y-auto p-3">
              {/* Planning header */}
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                <Spinner size="sm" className="text-accent" />
                <span className="font-vcr text-xs text-accent">
                  {isDebugTask ? 'INVESTIGATING BUG' : 'GENERATING PLAN'}
                </span>
              </div>
              {/* Session output */}
              {activePlanningOutput && activePlanningOutput.length > 0 ? (
                <OutputRenderer chunks={activePlanningOutput as AgentOutputChunk[]} />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Waiting for output...
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Draft/Subtasks tabs */}
              <div className="shrink-0 flex border-b border-border">
                <button
                  onClick={() => setEditTab('draft')}
                  className={`px-3 py-1.5 text-xs font-vcr transition-colors border-b-2 -mb-px ${
                    editTab === 'draft'
                      ? 'text-accent border-accent'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  Draft
                </button>
                <button
                  onClick={() => setEditTab('subtasks')}
                  className={`px-3 py-1.5 text-xs font-vcr transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                    editTab === 'subtasks'
                      ? 'text-accent border-accent'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  Subtasks
                  {subtasks.length > 0 && (
                    <span className={`px-1 min-w-[16px] text-center rounded text-[10px] ${
                      editTab === 'subtasks' ? 'bg-accent/20' : 'bg-border/50'
                    }`}>
                      {subtasks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab content */}
              {editTab === 'draft' ? (
                <Textarea
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  variant="sm"
                  className="flex-1 min-h-0 p-3 bg-background font-mono border-0"
                  spellCheck={false}
                />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-3">
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
              )}
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
                onCommitAndArchive={onCommitAndArchive}
                reviewFile={reviewFile}
                onReviewFileChange={onReviewFileChange}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </>
  )
}
