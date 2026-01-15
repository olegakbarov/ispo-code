/**
 * Task editor component with edit/review modes
 */

import { TaskReviewPanel } from './task-review-panel'

type Mode = 'edit' | 'review' | 'debate'

interface TaskEditorProps {
  title: string
  path: string
  mode: Mode
  draft: string
  taskDescription?: string
  // Archive state for review panel
  isArchived?: boolean
  isArchiving?: boolean
  isRestoring?: boolean
  onArchive?: () => void
  onRestore?: () => void
  onCommitAndArchive?: () => void
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
  isArchived,
  isArchiving,
  isRestoring,
  onArchive,
  onRestore,
  onCommitAndArchive,
  onModeChange,
  onDraftChange,
}: TaskEditorProps) {
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-panel/80 backdrop-blur min-h-12 px-3 py-2">
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
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'edit' ? (
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            className="w-full h-full p-3 bg-background text-xs text-text-primary font-mono border-0 outline-none resize-none"
            spellCheck={false}
          />
        ) : (
          <div className="h-full">
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
            />
          </div>
        )}
      </div>
    </>
  )
}
