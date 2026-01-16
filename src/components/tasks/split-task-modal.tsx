/**
 * Modal for adding sections as subtasks (inline in parent task)
 */

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Layers, AlertCircle } from 'lucide-react'
import type { TaskSection } from '@/lib/agent/task-service'

interface SplitTaskModalProps {
  isOpen: boolean
  isSplitting: boolean
  taskTitle: string
  sections: TaskSection[]
  currentSubtaskCount?: number // Number of existing subtasks
  maxSubtasks?: number // Maximum allowed subtasks
  onClose: () => void
  onSplit: (sectionIndices: number[], archiveOriginal: boolean) => void
}

export function SplitTaskModal({
  isOpen,
  isSplitting,
  taskTitle,
  sections,
  currentSubtaskCount = 0,
  maxSubtasks = 20,
  onClose,
  onSplit,
}: SplitTaskModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  // Preview of what will be added as subtasks
  const previewCount = selectedIndices.size
  const wouldExceedLimit = currentSubtaskCount + previewCount > maxSubtasks
  const remainingSlots = maxSubtasks - currentSubtaskCount

  const toggleSection = (index: number) => {
    const newSet = new Set(selectedIndices)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      // Don't allow selecting more than remaining slots
      if (newSet.size < remainingSlots) {
        newSet.add(index)
      }
    }
    setSelectedIndices(newSet)
  }

  const toggleAll = () => {
    if (selectedIndices.size === Math.min(sections.length, remainingSlots)) {
      setSelectedIndices(new Set())
    } else {
      // Select up to remaining slots
      const indices = sections.map((_, i) => i).slice(0, remainingSlots)
      setSelectedIndices(new Set(indices))
    }
  }

  const handleSplit = () => {
    const indices = Array.from(selectedIndices).sort((a, b) => a - b)
    // archiveOriginal is always false now (backward compat param)
    onSplit(indices, false)
  }

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedIndices(new Set())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg bg-panel border border-border rounded shadow-lg">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <div className="font-vcr text-sm text-accent">Add Subtasks</div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSplitting}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x
          </button>
        </div>

        <div className="p-3 space-y-3">
          <div>
            <div className="font-vcr text-[10px] text-text-muted mb-0.5">Adding subtasks to:</div>
            <div className="text-xs text-text-primary truncate">{taskTitle}</div>
            {currentSubtaskCount > 0 && (
              <div className="text-[10px] text-text-muted mt-0.5">
                {currentSubtaskCount} existing subtask{currentSubtaskCount === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {/* Limit warning */}
          {remainingSlots < sections.length && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-yellow-600">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>
                  Can only add {remainingSlots} more subtask{remainingSlots === 1 ? '' : 's'} (max {maxSubtasks})
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-vcr text-[10px] text-text-muted">Select sections:</div>
              <button
                onClick={toggleAll}
                disabled={isSplitting || remainingSlots === 0}
                className="text-[10px] text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedIndices.size === Math.min(sections.length, remainingSlots) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {sections.map((section, index) => {
                const isDisabled = isSplitting || (!selectedIndices.has(index) && selectedIndices.size >= remainingSlots)
                return (
                  <label
                    key={index}
                    className={`flex items-start gap-2 p-2 rounded border border-border hover:border-accent/50 cursor-pointer transition-colors bg-background ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Checkbox
                      checked={selectedIndices.has(index)}
                      onChange={() => toggleSection(index)}
                      disabled={isDisabled}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text-primary truncate">
                        {section.title}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {section.checkboxes.length} item{section.checkboxes.length === 1 ? '' : 's'}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {section.checkboxes.slice(0, 2).map((cb, i) => (
                          <div key={i} className="text-[10px] text-text-secondary truncate">
                            - {cb}
                          </div>
                        ))}
                        {section.checkboxes.length > 2 && (
                          <div className="text-[10px] text-text-muted italic">
                            + {section.checkboxes.length - 2} more...
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Preview */}
          {previewCount > 0 && !wouldExceedLimit && (
            <div className="bg-accent/10 border border-accent/30 rounded px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs text-accent">
                <Layers className="w-3 h-3" />
                <span>
                  Will add <strong>{previewCount}</strong> subtask{previewCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-2 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isSplitting}
            className="px-2 py-1 rounded text-[10px] font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={isSplitting || previewCount === 0 || wouldExceedLimit}
            className="px-2 py-1 rounded text-[10px] font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isSplitting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Layers className="w-3 h-3" />
                Add {previewCount}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
