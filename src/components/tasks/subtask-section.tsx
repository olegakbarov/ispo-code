/**
 * Subtask section component for displaying and managing subtasks within a task
 */

import { useState, useCallback } from 'react'
import { Layers, ChevronDown, ChevronRight, Check, Circle, Loader2, Trash2, Plus } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { SubTask } from '@/lib/agent/task-service'

interface SubtaskSectionProps {
  taskPath: string
  subtasks: SubTask[]
  version: number
  onRefresh: () => void
}

interface SubtaskCardProps {
  subtask: SubTask
  taskPath: string
  version: number
  isExpanded: boolean
  onToggleExpand: () => void
  onRefresh: () => void
}

function StatusBadge({ status }: { status: SubTask['status'] }) {
  const styles = {
    pending: 'bg-border/30 text-muted-foreground',
    in_progress: 'bg-yellow-500/20 text-yellow-600',
    completed: 'bg-accent/20 text-accent',
  }
  const labels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
  }
  const icons = {
    pending: <Circle className="w-2.5 h-2.5" />,
    in_progress: <Loader2 className="w-2.5 h-2.5 animate-spin" />,
    completed: <Check className="w-2.5 h-2.5" />,
  }

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-vcr ${styles[status]}`}>
      {icons[status]}
      <span>{labels[status]}</span>
    </div>
  )
}

function SubtaskCard({
  subtask,
  taskPath,
  version,
  isExpanded,
  onToggleExpand,
  onRefresh,
}: SubtaskCardProps) {
  const utils = trpc.useUtils()

  const updateMutation = trpc.tasks.updateSubtask.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ path: taskPath })
      onRefresh()
    },
  })

  const deleteMutation = trpc.tasks.deleteSubtask.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ path: taskPath })
      onRefresh()
    },
  })

  const handleStatusChange = useCallback((newStatus: SubTask['status']) => {
    updateMutation.mutate({
      taskPath,
      subtaskId: subtask.id,
      updates: { status: newStatus },
      expectedVersion: version,
    })
  }, [updateMutation, taskPath, subtask.id, version])

  const handleCheckboxChange = useCallback((index: number, checked: boolean) => {
    const newCheckboxes = [...subtask.checkboxes]
    newCheckboxes[index] = { ...newCheckboxes[index], checked }
    updateMutation.mutate({
      taskPath,
      subtaskId: subtask.id,
      updates: { checkboxes: newCheckboxes },
      expectedVersion: version,
    })
  }, [updateMutation, taskPath, subtask.id, subtask.checkboxes, version])

  const handleDelete = useCallback(() => {
    if (confirm(`Delete subtask "${subtask.title}"?`)) {
      deleteMutation.mutate({
        taskPath,
        subtaskId: subtask.id,
        expectedVersion: version,
      })
    }
  }, [deleteMutation, taskPath, subtask.id, subtask.title, version])

  const completedCount = subtask.checkboxes.filter((cb) => cb.checked).length
  const totalCount = subtask.checkboxes.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const isUpdating = updateMutation.isPending || deleteMutation.isPending

  return (
    <div className="border border-border rounded bg-background">
      {/* Header */}
      <div
        onClick={onToggleExpand}
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
      >
        <button className="shrink-0 p-0.5 rounded hover:bg-accent/20 text-muted-foreground hover:text-accent transition-colors">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">{subtask.title}</span>
            <StatusBadge status={subtask.status} />
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden max-w-[100px]">
                <div
                  className={`h-full rounded-full transition-all ${progress < 50 ? 'bg-yellow-500' : 'bg-accent'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1">
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete subtask"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-vcr text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1">
              {(['pending', 'in_progress', 'completed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={isUpdating}
                  className={`px-2 py-0.5 rounded text-[10px] font-vcr transition-colors disabled:opacity-50 ${
                    subtask.status === status
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-border/30 text-muted-foreground hover:bg-border/50'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Checkboxes */}
          {subtask.checkboxes.length > 0 && (
            <div className="space-y-1.5">
              {subtask.checkboxes.map((cb, index) => (
                <label
                  key={index}
                  className="flex items-start gap-2 cursor-pointer group"
                >
                  <Checkbox
                    checked={cb.checked}
                    onChange={() => handleCheckboxChange(index, !cb.checked)}
                    disabled={isUpdating}
                    className="mt-0.5"
                  />
                  <span className={`text-xs ${cb.checked ? 'text-muted-foreground line-through' : 'text-text-secondary'}`}>
                    {cb.text}
                  </span>
                </label>
              ))}
            </div>
          )}

          {subtask.checkboxes.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No items</div>
          )}
        </div>
      )}
    </div>
  )
}

export function SubtaskSection({ taskPath, subtasks, version, onRefresh }: SubtaskSectionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  const utils = trpc.useUtils()

  const addSubtaskMutation = trpc.tasks.addSubtask.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate({ path: taskPath })
      setNewSubtaskTitle('')
      setIsAddingSubtask(false)
      onRefresh()
    },
  })

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleAddSubtask = useCallback(() => {
    if (!newSubtaskTitle.trim()) return
    addSubtaskMutation.mutate({
      taskPath,
      subtask: {
        title: newSubtaskTitle.trim(),
        checkboxes: [],
        status: 'pending',
      },
      expectedVersion: version,
    })
  }, [addSubtaskMutation, taskPath, newSubtaskTitle, version])

  if (subtasks.length === 0 && !isAddingSubtask) {
    return null
  }

  return (
    <div className="border-t border-border mt-4 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <span className="font-vcr text-xs text-accent">Subtasks ({subtasks.length})</span>
        </div>
        {!isAddingSubtask && subtasks.length < 20 && (
          <button
            onClick={() => setIsAddingSubtask(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-vcr text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <SubtaskCard
            key={subtask.id}
            subtask={subtask}
            taskPath={taskPath}
            version={version}
            isExpanded={expandedIds.has(subtask.id)}
            onToggleExpand={() => toggleExpand(subtask.id)}
            onRefresh={onRefresh}
          />
        ))}

        {/* Add subtask form */}
        {isAddingSubtask && (
          <div className="border border-border rounded bg-background p-3 space-y-2">
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Subtask title..."
              variant="sm"
              className="bg-secondary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubtask()
                if (e.key === 'Escape') {
                  setIsAddingSubtask(false)
                  setNewSubtaskTitle('')
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim() || addSubtaskMutation.isPending}
                className="px-2 py-1 rounded text-[10px] font-vcr bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {addSubtaskMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add
              </button>
              <button
                onClick={() => {
                  setIsAddingSubtask(false)
                  setNewSubtaskTitle('')
                }}
                className="px-2 py-1 rounded text-[10px] font-vcr text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
