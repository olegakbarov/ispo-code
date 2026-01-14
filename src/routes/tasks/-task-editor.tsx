/**
 * Task editor component with edit/preview modes
 */

import { StreamingMarkdown } from '@/components/ui/streaming-markdown'
import { Select } from '@/components/ui/select'
import { AgentProgressBanner } from './-agent-progress-banner'
import { agentTypeLabel } from './-agent-config'
import type { AgentSession } from './-agent-types'
import type { AgentType } from '@/lib/agent/types'

type Mode = 'edit' | 'preview'

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
  dirty: boolean
  progress: TaskProgress | null
  agentSession: AgentSession | null
  runAgentType: AgentType
  availableTypes: AgentType[] | undefined
  isSaving: boolean
  isDeleting: boolean
  isAssigning: boolean
  saveError: string | null
  onModeChange: (mode: Mode) => void
  onDraftChange: (draft: string) => void
  onSave: () => void
  onDelete: () => void
  onReview: () => void
  onAssignToAgent: () => void
  onRunAgentTypeChange: (agentType: AgentType) => void
  onCancelAgent: () => void
}

export function TaskEditor({
  title,
  path,
  mode,
  draft,
  dirty,
  progress,
  agentSession,
  runAgentType,
  availableTypes,
  isSaving,
  isDeleting,
  isAssigning,
  saveError,
  onModeChange,
  onDraftChange,
  onSave,
  onDelete,
  onReview,
  onAssignToAgent,
  onRunAgentTypeChange,
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

      <div className="sticky top-0 z-10 border-b border-border bg-panel/80 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-3">
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

          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => onModeChange('edit')}
              className={`px-2 py-1 rounded text-[10px] font-vcr border cursor-pointer transition-colors ${
                mode === 'edit'
                  ? 'border-accent text-accent bg-panel-hover'
                  : 'border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => onModeChange('preview')}
              className={`px-2 py-1 rounded text-[10px] font-vcr border cursor-pointer transition-colors ${
                mode === 'preview'
                  ? 'border-accent text-accent bg-panel-hover'
                  : 'border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover'
              }`}
            >
              Preview
            </button>
          </div>

          <button
            onClick={onSave}
            disabled={!dirty || isSaving}
            className="px-2 py-1 rounded text-[10px] font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            title={dirty ? 'Save (Cmd/Ctrl+S)' : 'Saved'}
          >
            {isSaving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          <button
            onClick={onReview}
            disabled={!!agentSession}
            className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Ask an AI agent to review and suggest edits to this task"
          >
            Review
          </button>

          <div className="flex items-center gap-1">
            <Select
              value={runAgentType}
              onChange={(e) => onRunAgentTypeChange(e.target.value as AgentType)}
              variant="sm"
              disabled={isAssigning || !!agentSession}
              className="bg-background text-[10px] py-1 min-w-[100px]"
            >
              {(Object.keys(agentTypeLabel) as AgentType[]).map((t) => (
                <option key={t} value={t} disabled={availableTypes ? !availableTypes.includes(t) : false}>
                  {agentTypeLabel[t]}
                </option>
              ))}
            </Select>
            <button
              onClick={onAssignToAgent}
              disabled={isAssigning || !!agentSession || (availableTypes ? !availableTypes.includes(runAgentType) : false)}
              className="px-2 py-1 rounded text-[10px] font-vcr border border-accent/50 text-accent cursor-pointer hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Assign this task to an AI agent"
            >
              {isAssigning ? 'Assigning...' : 'Run'}
            </button>
          </div>

          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="px-2 py-1 rounded text-[10px] font-vcr border border-error/50 text-error cursor-pointer hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete this task"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>

        {saveError && (
          <div className="mt-2 p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
            {saveError}
          </div>
        )}
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
          <div className="h-full overflow-y-auto p-4">
            <StreamingMarkdown content={draft} className="text-xs" />
          </div>
        )}
      </div>
    </>
  )
}
