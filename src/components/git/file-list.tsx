/**
 * FileList - Tabbed list of changed files with selection
 */

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

// Local type definition - matches git service types
export interface GitFileStatus {
  file: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied'
}

type Tab = 'staged' | 'modified' | 'untracked'
export type GitDiffView = 'staged' | 'working'

interface FileListProps {
  staged: GitFileStatus[]
  modified: GitFileStatus[]
  untracked: string[]
  selectedFiles: Set<string>
  onSelectionChange: (files: Set<string>) => void
  onFileClick?: (file: string, view: GitDiffView) => void
}

export function FileList({
  staged,
  modified,
  untracked,
  selectedFiles,
  onSelectionChange,
  onFileClick,
}: FileListProps) {
  // Default to first tab with files
  const getDefaultTab = (): Tab => {
    if (staged.length > 0) return 'staged'
    if (modified.length > 0) return 'modified'
    if (untracked.length > 0) return 'untracked'
    return 'staged'
  }
  const [activeTab, setActiveTab] = useState<Tab>(getDefaultTab)

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'staged', label: 'Staged', count: staged.length },
    { id: 'modified', label: 'Modified', count: modified.length },
    { id: 'untracked', label: 'Untracked', count: untracked.length },
  ]

  const toggleFile = (file: string) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(file)) {
      newSelection.delete(file)
    } else {
      newSelection.add(file)
    }
    onSelectionChange(newSelection)
  }

  const toggleAll = () => {
    const currentFiles = getCurrentFiles()
    const allSelected = currentFiles.every((f) => selectedFiles.has(f))

    if (allSelected) {
      // Deselect all current tab files
      const newSelection = new Set(selectedFiles)
      currentFiles.forEach((f) => newSelection.delete(f))
      onSelectionChange(newSelection)
    } else {
      // Select all current tab files
      const newSelection = new Set(selectedFiles)
      currentFiles.forEach((f) => newSelection.add(f))
      onSelectionChange(newSelection)
    }
  }

  const getCurrentFiles = (): string[] => {
    switch (activeTab) {
      case 'staged':
        return staged.map((f) => f.file)
      case 'modified':
        return modified.map((f) => f.file)
      case 'untracked':
        return untracked
    }
  }

  const currentFiles = getCurrentFiles()
  const allSelected = currentFiles.length > 0 && currentFiles.every((f) => selectedFiles.has(f))
  const someSelected = currentFiles.some((f) => selectedFiles.has(f))

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab, idx) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 font-vcr text-[10px] cursor-pointer transition-colors whitespace-nowrap ${idx > 0 ? 'border-l border-border/40' : ''} ${
              activeTab === tab.id
                ? 'text-primary bg-secondary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {tab.label}
            <span className={`ml-1 ${tab.count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Select All Header */}
      {currentFiles.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border-b border-border">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={toggleAll}
            size="sm"
          />
          <span className="font-vcr text-xs text-muted-foreground">
            {selectedFiles.size > 0
              ? `${selectedFiles.size} selected`
              : 'Select all'}
          </span>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {currentFiles.length === 0 ? (
          <div className="p-3 text-center text-muted-foreground text-xs">
            No {activeTab} files
          </div>
        ) : (
          <div>
            {activeTab === 'staged' &&
              staged.map((file) => (
                <FileRow
                  key={file.file}
                  file={file.file}
                  status={file.status}
                  selected={selectedFiles.has(file.file)}
                  onToggle={() => toggleFile(file.file)}
                  onClick={() => onFileClick?.(file.file, 'staged')}
                />
              ))}
            {activeTab === 'modified' &&
              modified.map((file) => (
                <FileRow
                  key={file.file}
                  file={file.file}
                  status={file.status}
                  selected={selectedFiles.has(file.file)}
                  onToggle={() => toggleFile(file.file)}
                  onClick={() => onFileClick?.(file.file, 'working')}
                />
              ))}
            {activeTab === 'untracked' &&
              untracked.map((file) => (
                <UntrackedFileRow
                  key={file}
                  file={file}
                  selected={selectedFiles.has(file)}
                  onToggle={() => toggleFile(file)}
                  onClick={() => onFileClick?.(file, 'working')}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FileRowProps {
  file: string
  status: GitFileStatus['status']
  selected: boolean
  onToggle: () => void
  onClick?: () => void
}

function FileRow({ file, status, selected, onToggle, onClick }: FileRowProps) {
  const statusColors: Record<GitFileStatus['status'], string> = {
    added: 'text-primary',
    modified: 'text-chart-4',
    deleted: 'text-destructive',
    renamed: 'text-purple-400',
    copied: 'text-blue-400',
  }

  const statusLabels: Record<GitFileStatus['status'], string> = {
    added: 'A',
    modified: 'M',
    deleted: 'D',
    renamed: 'R',
    copied: 'C',
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors border-t border-border/40 ${
        selected ? 'bg-secondary' : ''
      }`}
    >
      <Checkbox
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        size="sm"
      />
      <span className={`font-vcr text-[10px] w-3 ${statusColors[status]}`}>
        {statusLabels[status]}
      </span>
      <span
        className="flex-1 text-xs text-foreground truncate cursor-pointer hover:text-primary"
        onClick={onClick}
        title={file}
      >
        {file}
      </span>
    </div>
  )
}

interface UntrackedFileRowProps {
  file: string
  selected: boolean
  onToggle: () => void
  onClick?: () => void
}

function UntrackedFileRow({ file, selected, onToggle, onClick }: UntrackedFileRowProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors border-t border-border/40 ${
        selected ? 'bg-secondary' : ''
      }`}
    >
      <Checkbox
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        size="sm"
      />
      <span className="font-vcr text-[10px] w-3 text-blue-400">?</span>
      <span
        className="flex-1 text-xs text-foreground truncate cursor-pointer hover:text-primary"
        onClick={onClick}
        title={file}
      >
        {file}
      </span>
    </div>
  )
}
