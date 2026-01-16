/**
 * Task Command Palette
 * Provides a command palette interface for task-related actions
 *
 * Supports two modes:
 * - 'commands': Show task commands and search
 * - 'create': Show inline task creation form
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { Plus, Play, CheckCircle, Archive, ArchiveRestore, FileText, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHotkey } from '@/lib/hooks/use-hotkeys'
import { useCreateTaskForm } from '@/lib/hooks/use-create-task-form'
import { CreateTaskForm, CreateTaskActions } from '@/components/tasks/create-task-form'

interface TaskSummary {
  path: string
  title: string
  source: string
  archived: boolean
  archivedAt?: string
  progress: {
    total: number
    done: number
    inProgress: number
  }
  subtaskCount: number
  hasSubtasks: boolean
}

type PaletteMode = 'commands' | 'create'

interface TaskCommandPaletteProps {
  trigger?: React.ReactNode
  className?: string
  variant?: 'button' | 'inline'
  /** List of all tasks for search/navigation */
  tasks?: TaskSummary[]
  /** Currently selected task path */
  selectedPath?: string | null
  /** Task action handlers */
  onRunImpl?: (path: string) => void
  onRunVerify?: (path: string) => void
  onNavigateReview?: (path: string) => void
  onArchive?: (path: string) => void
  onRestore?: (path: string) => void
}

export function TaskCommandPalette({
  trigger,
  className,
  variant = 'button',
  tasks = [],
  selectedPath = null,
  onRunImpl,
  onRunVerify,
  onNavigateReview,
  onArchive,
  onRestore,
}: TaskCommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PaletteMode>('commands')
  const navigate = useNavigate()

  // Handle keyboard shortcut (Cmd+K or Ctrl+K) using useHotkey
  useHotkey({
    keys: 'cmd+k,ctrl+k',
    handler: () => setOpen((prev) => !prev),
    preventDefault: true,
  })

  // Reset mode when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to avoid visual flash
      const timer = setTimeout(() => setMode('commands'), 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Create task form hook
  const createForm = useCreateTaskForm({
    tasks,
    onCreated: () => {
      setOpen(false)
    },
    navigateOnCreate: true,
  })

  const handleNewTask = useCallback(() => {
    setMode('create')
  }, [])

  const handleBackToCommands = useCallback(() => {
    setMode('commands')
  }, [])

  const handleTaskSelect = (path: string) => {
    navigate({
      to: '/tasks/$',
      params: { _splat: encodeURIComponent(path) },
    })
    setOpen(false)
  }

  const handleTaskAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  // Get selected task info
  const selectedTask = tasks.find((t) => t.path === selectedPath)

  // Filter tasks for search
  const activeTasks = tasks.filter((t) => !t.archived)
  const archivedTasks = tasks.filter((t) => t.archived)

  const renderTrigger = () => {
    if (trigger) {
      return (
        <div onClick={() => setOpen(true)} className={className}>
          {trigger}
        </div>
      )
    }

    if (variant === 'inline') {
      return (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded bg-background border border-border/60 text-left text-xs font-vcr text-muted-foreground hover:border-border hover:text-foreground transition-colors',
            className
          )}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">Type a command...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-border/30 rounded">
            <span>⌘</span>
            <span>K</span>
          </kbd>
        </button>
      )
    }

    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center justify-center gap-1.5 w-full py-1.5 rounded bg-accent text-accent-foreground hover:opacity-90 transition-opacity text-xs font-vcr',
          className
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New Task</span>
      </button>
    )
  }

  // Render palette content - unified container with mode-based content
  const renderPaletteContent = () => (
    <div className="fixed left-1/2 top-[12%] -translate-x-1/2 w-full max-w-2xl px-4">
      <div className="relative z-50 bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl overflow-hidden min-h-[200px]">
        {mode === 'create' ? (
          <>
            {/* Create mode header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <button
                onClick={handleBackToCommands}
                className="p-1 -ml-1 rounded hover:bg-accent/10 transition-colors"
                title="Back to commands (Esc)"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <Plus className="w-4 h-4 text-accent shrink-0" />
              <span className="flex-1 text-sm font-vcr text-foreground">New Task</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-border/30 rounded font-vcr text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Create form content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <CreateTaskForm
                isCreating={createForm.isCreating}
                newTitle={createForm.title}
                taskType={createForm.taskType}
                useAgent={createForm.useAgent}
                createAgentType={createForm.agentType}
                createModel={createForm.model}
                availableTypes={createForm.availableTypes}
                availablePlannerTypes={createForm.availablePlannerTypes}
                debugAgents={createForm.debugAgents}
                autoRun={createForm.autoRun}
                includeQuestions={createForm.includeQuestions}
                runAgentType={createForm.runAgentType}
                runModel={createForm.runModel}
                onCreate={createForm.onCreate}
                onTitleChange={createForm.onTitleChange}
                onTaskTypeChange={createForm.onTaskTypeChange}
                onUseAgentChange={createForm.onUseAgentChange}
                onAgentTypeChange={createForm.onAgentTypeChange}
                onModelChange={createForm.onModelChange}
                onAutoRunChange={createForm.onAutoRunChange}
                onIncludeQuestionsChange={createForm.onIncludeQuestionsChange}
                onToggleDebugAgent={createForm.onToggleDebugAgent}
                onDebugAgentModelChange={createForm.onDebugAgentModelChange}
                onRunAgentTypeChange={createForm.onRunAgentTypeChange}
                onRunModelChange={createForm.onRunModelChange}
                onCancel={handleBackToCommands}
                autoFocus={true}
              />
            </div>

            {/* Create actions footer */}
            <div className="px-4 py-3 border-t border-border/50 bg-background/30">
              <CreateTaskActions
                isCreating={createForm.isCreating}
                canCreate={createForm.canCreate}
                onCreate={createForm.onCreate}
                onCancel={handleBackToCommands}
              />
            </div>
          </>
        ) : (
          <>
            {/* Commands mode header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
              <Command.Input
                placeholder="Search tasks or type a command..."
                className="flex-1 bg-transparent border-none outline-none text-sm font-vcr placeholder:text-muted-foreground"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-border/30 rounded font-vcr text-muted-foreground">
                ESC
              </kbd>
            </div>

            <Command.List className="max-h-[400px] overflow-y-auto p-2">
              {/* Enhanced empty state */}
              <Command.Empty className="px-4 py-8 text-center">
                <div className="text-muted-foreground/60 text-sm font-vcr">
                  No results found
                </div>
                <div className="text-muted-foreground/40 text-xs font-vcr mt-1">
                  Try a different search term
                </div>
              </Command.Empty>

              {/* Actions Group */}
              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-vcr [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                <Command.Item
                  onSelect={handleNewTask}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="flex-1">New Task</span>
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-border/30 rounded">
                    C
                  </kbd>
                </Command.Item>
              </Command.Group>

              {/* Selected Task Actions Group */}
              {selectedTask && (
                <Command.Group
                  heading="Current Task Actions"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-vcr [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {onRunImpl && !selectedTask.archived && (
                    <Command.Item
                      onSelect={() => handleTaskAction(() => onRunImpl(selectedTask.path))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                    >
                      <Play className="w-4 h-4 shrink-0" />
                      <div className="flex-1">
                        <div>Implement</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {selectedTask.title}
                        </div>
                      </div>
                      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-border/30 rounded">
                        I
                      </kbd>
                    </Command.Item>
                  )}
                  {onRunVerify && !selectedTask.archived && (
                    <Command.Item
                      onSelect={() => handleTaskAction(() => onRunVerify(selectedTask.path))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                    >
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <div className="flex-1">
                        <div>Verify</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {selectedTask.title}
                        </div>
                      </div>
                      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-border/30 rounded">
                        V
                      </kbd>
                    </Command.Item>
                  )}
                  {onNavigateReview && !selectedTask.archived && (
                    <Command.Item
                      onSelect={() => handleTaskAction(() => onNavigateReview(selectedTask.path))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <div className="flex-1">
                        <div>Review & Commit</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {selectedTask.title}
                        </div>
                      </div>
                      <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-border/30 rounded">
                        R
                      </kbd>
                    </Command.Item>
                  )}
                  {onArchive && !selectedTask.archived && (
                    <Command.Item
                      onSelect={() => handleTaskAction(() => onArchive(selectedTask.path))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                    >
                      <Archive className="w-4 h-4 shrink-0" />
                      <div className="flex-1">
                        <div>Archive</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {selectedTask.title}
                        </div>
                      </div>
                    </Command.Item>
                  )}
                  {onRestore && selectedTask.archived && (
                    <Command.Item
                      onSelect={() => handleTaskAction(() => onRestore(selectedTask.path))}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                    >
                      <ArchiveRestore className="w-4 h-4 shrink-0" />
                      <div className="flex-1">
                        <div>Restore</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {selectedTask.title}
                        </div>
                      </div>
                    </Command.Item>
                  )}
                </Command.Group>
              )}

              {/* Active Tasks Group */}
              {activeTasks.length > 0 && (
                <Command.Group
                  heading="Active Tasks"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-vcr [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {activeTasks.map((task) => {
                    const progressPercent =
                      task.progress.total > 0
                        ? (task.progress.done / task.progress.total) * 100
                        : 0
                    const isSelected = task.path === selectedPath

                    return (
                      <Command.Item
                        key={task.path}
                        value={`${task.path} ${task.title}`}
                        onSelect={() => handleTaskSelect(task.path)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1"
                      >
                        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{task.title}</div>
                          {task.progress.total > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {task.progress.done}/{task.progress.total}
                              </span>
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
                        )}
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              )}

              {/* Archived Tasks Group */}
              {archivedTasks.length > 0 && (
                <Command.Group
                  heading="Archived Tasks"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-vcr [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {archivedTasks.map((task) => (
                    <Command.Item
                      key={task.path}
                      value={`${task.path} ${task.title}`}
                      onSelect={() => handleTaskSelect(task.path)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent mb-1 opacity-60"
                    >
                      <Archive className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 truncate">{task.title}</div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Trigger */}
      {renderTrigger()}

      {/* Command palette dialog */}
      <Command.Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && mode === 'create') {
            // In create mode, Escape goes back to commands first
            setMode('commands')
          } else {
            setOpen(newOpen)
          }
        }}
        label="Task Commands"
        className="fixed inset-0 z-50"
      >
        {/* Enhanced backdrop with blur */}
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            if (mode === 'create') {
              setMode('commands')
            } else {
              setOpen(false)
            }
          }}
        />

        {/* Render unified palette content */}
        {renderPaletteContent()}
      </Command.Dialog>
    </>
  )
}
