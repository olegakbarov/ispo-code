/**
 * Subtask section component - compact row layout with inline editing
 */

import { useState, useCallback, memo } from 'react'
import { Plus, Check, Circle, Loader2, Trash2, ChevronDown, ChevronRight, X, Pencil } from 'lucide-react'
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

interface SubtaskRowProps {
  subtask: SubTask
  taskPath: string
  version: number
  isExpanded: boolean
  onToggleExpand: () => void
  onRefresh: () => void
}

const STATUS_CYCLE: SubTask['status'][] = ['pending', 'in_progress', 'completed']

function getNextStatus(current: SubTask['status']): SubTask['status'] {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

function StatusIcon({ status, onClick, disabled }: { status: SubTask['status']; onClick: () => void; disabled?: boolean }) {
  const icons = {
    pending: <Circle className="w-3.5 h-3.5" />,
    in_progress: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    completed: <Check className="w-3.5 h-3.5" />,
  }
  const colors = {
    pending: 'text-muted-foreground hover:text-foreground',
    in_progress: 'text-yellow-500 hover:text-yellow-400',
    completed: 'text-accent hover:text-accent/80',
  }
  const titles = {
    pending: 'Pending → In Progress',
    in_progress: 'In Progress → Completed',
    completed: 'Completed → Pending',
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick()
      }}
      disabled={disabled}
      className={`p-1 rounded transition-colors ${colors[status]} disabled:opacity-50`}
      title={titles[status]}
    >
      {icons[status]}
    </button>
  )
}

const SubtaskRow = memo(function SubtaskRow({
  subtask,
  taskPath,
  version,
  isExpanded,
  onToggleExpand,
  onRefresh,
}: SubtaskRowProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(subtask.title)
  const [newCheckboxText, setNewCheckboxText] = useState('')

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

  const isUpdating = updateMutation.isPending || deleteMutation.isPending

  const handleStatusCycle = useCallback(() => {
    updateMutation.mutate({
      taskPath,
      subtaskId: subtask.id,
      updates: { status: getNextStatus(subtask.status) },
      expectedVersion: version,
    })
  }, [updateMutation, taskPath, subtask.id, subtask.status, version])

  const handleTitleSave = useCallback(() => {
    if (editedTitle.trim() && editedTitle !== subtask.title) {
      updateMutation.mutate({
        taskPath,
        subtaskId: subtask.id,
        updates: { title: editedTitle.trim() },
        expectedVersion: version,
      })
    }
    setIsEditingTitle(false)
  }, [updateMutation, taskPath, subtask.id, editedTitle, subtask.title, version])

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

  const handleAddCheckbox = useCallback(() => {
    if (!newCheckboxText.trim()) return
    const newCheckboxes = [...subtask.checkboxes, { text: newCheckboxText.trim(), checked: false }]
    updateMutation.mutate({
      taskPath,
      subtaskId: subtask.id,
      updates: { checkboxes: newCheckboxes },
      expectedVersion: version,
    })
    setNewCheckboxText('')
  }, [updateMutation, taskPath, subtask.id, subtask.checkboxes, newCheckboxText, version])

  const handleRemoveCheckbox = useCallback((index: number) => {
    const newCheckboxes = subtask.checkboxes.filter((_, i) => i !== index)
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

  return (
    <div className="border-b border-border/50 last:border-b-0">
      {/* Row header - dense layout */}
      <div className="flex items-center gap-1.5 py-1.5 px-1 group">
        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* Status cycle button */}
        <StatusIcon status={subtask.status} onClick={handleStatusCycle} disabled={isUpdating} />

        {/* Title - inline edit */}
        {isEditingTitle ? (
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave()
              if (e.key === 'Escape') {
                setEditedTitle(subtask.title)
                setIsEditingTitle(false)
              }
            }}
            variant="sm"
            className="flex-1 h-6 text-xs bg-secondary px-1.5"
            autoFocus
          />
        ) : (
          <span
            onClick={() => {
              setEditedTitle(subtask.title)
              setIsEditingTitle(true)
            }}
            className={`flex-1 text-xs truncate cursor-text ${
              subtask.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
            title="Click to edit"
          >
            {subtask.title}
          </span>
        )}

        {/* Progress indicator */}
        {totalCount > 0 && (
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {completedCount}/{totalCount}
          </span>
        )}

        {/* Actions - visible on hover */}
        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditedTitle(subtask.title)
              setIsEditingTitle(true)
            }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Edit title"
          >
            <Pencil className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Delete subtask"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Expanded: checkboxes */}
      {isExpanded && (
        <div className="pl-8 pr-2 pb-2 space-y-1">
          {subtask.checkboxes.map((cb, index) => (
            <div key={index} className="flex items-center gap-2 group/item">
              <Checkbox
                checked={cb.checked}
                onChange={() => handleCheckboxChange(index, !cb.checked)}
                disabled={isUpdating}
                className="shrink-0"
              />
              <span className={`flex-1 text-xs ${cb.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {cb.text}
              </span>
              <button
                onClick={() => handleRemoveCheckbox(index)}
                className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity"
                title="Remove item"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* Add checkbox input */}
          <div className="flex items-center gap-2 mt-1.5">
            <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
            <Input
              value={newCheckboxText}
              onChange={(e) => setNewCheckboxText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCheckbox()
                if (e.key === 'Escape') setNewCheckboxText('')
              }}
              placeholder="Add item..."
              variant="sm"
              className="flex-1 h-5 text-xs bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  )
})

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

  return (
    <div className="h-full flex flex-col">
      {/* Always-visible header */}
      <div className="shrink-0 flex items-center justify-between pb-2 border-b border-border mb-2">
        <span className="font-vcr text-xs text-muted-foreground">
          {subtasks.length === 0 ? 'No subtasks' : `${subtasks.length} subtask${subtasks.length === 1 ? '' : 's'}`}
        </span>
        {!isAddingSubtask && subtasks.length < 20 && (
          <button
            onClick={() => setIsAddingSubtask(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-vcr text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Subtask list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subtasks.length === 0 && !isAddingSubtask ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-muted-foreground text-xs mb-2">No subtasks yet</div>
            <button
              onClick={() => setIsAddingSubtask(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-vcr text-accent hover:bg-accent/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add first subtask
            </button>
          </div>
        ) : (
          <div>
            {subtasks.map((subtask) => (
              <SubtaskRow
                key={subtask.id}
                subtask={subtask}
                taskPath={taskPath}
                version={version}
                isExpanded={expandedIds.has(subtask.id)}
                onToggleExpand={() => toggleExpand(subtask.id)}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}

        {/* Add subtask inline form */}
        {isAddingSubtask && (
          <div className="flex items-center gap-2 py-1.5 px-1 border-b border-border/50">
            <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="New subtask title..."
              variant="sm"
              className="flex-1 h-6 text-xs bg-secondary px-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubtask()
                if (e.key === 'Escape') {
                  setIsAddingSubtask(false)
                  setNewSubtaskTitle('')
                }
              }}
            />
            <button
              onClick={handleAddSubtask}
              disabled={!newSubtaskTitle.trim() || addSubtaskMutation.isPending}
              className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-vcr bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {addSubtaskMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
            </button>
            <button
              onClick={() => {
                setIsAddingSubtask(false)
                setNewSubtaskTitle('')
              }}
              className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
