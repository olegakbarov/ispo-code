/**
 * Modal for splitting a task into multiple subtasks
 */

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Scissors, GitBranch, Archive } from 'lucide-react'
import type { TaskSection } from '@/lib/agent/task-service'

interface SplitTaskModalProps {
  isOpen: boolean
  isSplitting: boolean
  taskTitle: string
  sections: TaskSection[]
  onClose: () => void
  onSplit: (sectionIndices: number[], archiveOriginal: boolean) => void
}

export function SplitTaskModal({
  isOpen,
  isSplitting,
  taskTitle,
  sections,
  onClose,
  onSplit,
}: SplitTaskModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [archiveOriginal, setArchiveOriginal] = useState(false)

  // Preview of what will be created
  const previewCount = selectedIndices.size

  const toggleSection = (index: number) => {
    const newSet = new Set(selectedIndices)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedIndices(newSet)
  }

  const toggleAll = () => {
    if (selectedIndices.size === sections.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(sections.map((_, i) => i)))
    }
  }

  const handleSplit = () => {
    const indices = Array.from(selectedIndices).sort((a, b) => a - b)
    onSplit(indices, archiveOriginal)
  }

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedIndices(new Set())
    setArchiveOriginal(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg bg-panel border border-border rounded shadow-lg">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-accent" />
            <div className="font-vcr text-sm text-accent">Split Task</div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSplitting}
            className="px-2 py-1 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="font-vcr text-xs text-text-muted mb-1">Splitting task:</div>
            <div className="text-sm text-text-primary truncate">{taskTitle}</div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-vcr text-xs text-text-muted">Select sections to split out:</div>
              <button
                onClick={toggleAll}
                disabled={isSplitting}
                className="text-xs text-accent hover:underline disabled:opacity-50"
              >
                {selectedIndices.size === sections.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sections.map((section, index) => (
                <label
                  key={index}
                  className="flex items-start gap-3 p-3 rounded border border-border hover:border-accent/50 cursor-pointer transition-colors bg-background"
                >
                  <Checkbox
                    checked={selectedIndices.has(index)}
                    onChange={() => toggleSection(index)}
                    disabled={isSplitting}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {section.title}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {section.checkboxes.length} item{section.checkboxes.length === 1 ? '' : 's'}
                    </div>
                    <div className="mt-2 space-y-1">
                      {section.checkboxes.slice(0, 3).map((cb, i) => (
                        <div key={i} className="text-xs text-text-secondary truncate">
                          - {cb}
                        </div>
                      ))}
                      {section.checkboxes.length > 3 && (
                        <div className="text-xs text-text-muted italic">
                          + {section.checkboxes.length - 3} more...
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          {previewCount > 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded p-3">
              <div className="flex items-center gap-2 text-sm text-accent">
                <GitBranch className="w-4 h-4" />
                <span>
                  Will create <strong>{previewCount}</strong> new task{previewCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          )}

          {/* Archive option */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox
              checked={archiveOriginal}
              onChange={() => setArchiveOriginal(!archiveOriginal)}
              disabled={isSplitting}
            />
            <Archive className="w-4 h-4 text-text-muted group-hover:text-text-secondary transition-colors" />
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              Archive original task after split
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isSplitting}
            className="px-3 py-1.5 rounded text-xs font-vcr border border-border text-text-muted hover:text-text-secondary hover:bg-panel-hover cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            disabled={isSplitting || previewCount === 0}
            className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-background cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSplitting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Scissors className="w-3 h-3" />
                Split into {previewCount} Task{previewCount === 1 ? '' : 's'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
