/**
 * Task editor component with edit/preview/review modes
 */

import { StreamingMarkdown } from '@/components/ui/streaming-markdown'
import { AgentProgressBanner } from './agent-progress-banner'
import { TaskReviewPanel } from './task-review-panel'
import type { AgentSession } from './agent-types'

type Mode = 'edit' | 'preview' | 'review'

interface TaskProgress {
  total: number
  done: number
  inProgress: number
}

interface TaskEditorProps {
  title: string
  path: string
  mode: Mode
  draft: string
  progress: TaskProgress | null
  agentSession: AgentSession | null
  taskDescription?: string
  onModeChange: (mode: Mode) => void
  onDraftChange: (draft: string) => void
  onCancelAgent: () => void
}

export function TaskEditor({
  title,
  path,
  mode,
  draft,
  progress,
  agentSession,
  taskDescription,
  onModeChange,
  onDraftChange,
  onCancelAgent,
}: TaskEditorProps) {
  return (
    <>
      {/* Agent Progress Banner */}
      {agentSession && (
        <AgentProgressBanner
          session={agentSession}
          onCancel={onCancelAgent}
        />
      )}

      <div className="sticky top-0 z-10 border-b border-border bg-panel/80 backdrop-blur min-h-12 px-3 py-2">
        <div className="flex items-center gap-3 w-full">
          <div className="min-w-0 flex-1">
            <div className="font-vcr text-xs text-text-secondary truncate">{title}</div>
            <div className="text-[10px] text-text-muted truncate">{path}</div>
          </div>

          {progress && progress.total > 0 && (
            <div className="shrink-0 text-[10px] font-vcr text-text-muted">
              {progress.done}/{progress.total}
              {progress.inProgress > 0 ? ` ~ ${progress.inProgress}` : ''}
            </div>
          )}

          {/* Mode tabs */}
          <div className="flex items-center gap-1 border border-border rounded overflow-hidden">
            <button
              onClick={() => onModeChange('edit')}
              className={`px-3 py-1 text-xs font-vcr transition-colors ${
                mode === 'edit'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => onModeChange('preview')}
              className={`px-3 py-1 text-xs font-vcr transition-colors border-l border-border ${
                mode === 'preview'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => onModeChange('review')}
              className={`px-3 py-1 text-xs font-vcr transition-colors border-l border-border ${
                mode === 'review'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              Review
            </button>
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
        ) : mode === 'preview' ? (
          <div className="h-full overflow-y-auto p-4">
            <StreamingMarkdown content={draft} className="text-xs" />
          </div>
        ) : (
          <div className="h-full">
            <TaskReviewPanel taskPath={path} taskTitle={title} taskDescription={taskDescription} />
          </div>
        )}
      </div>
    </>
  )
}
