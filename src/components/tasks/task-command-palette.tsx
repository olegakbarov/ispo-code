/**
 * Task Command Palette
 * Provides a command palette interface for task-related actions
 */

import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskCommandPaletteProps {
  trigger?: React.ReactNode
  className?: string
}

export function TaskCommandPalette({ trigger, className }: TaskCommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // Handle keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleNewTask = () => {
    navigate({ to: '/tasks/new' })
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button */}
      {trigger ? (
        <div onClick={() => setOpen(true)} className={className}>
          {trigger}
        </div>
      ) : (
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
      )}

      {/* Command palette dialog */}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Task Commands"
        className="fixed inset-0 z-50"
      >
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl" onClick={() => setOpen(false)} />

        {/* Command palette */}
        <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-md">
          <div className="relative z-50 bg-card border border-border rounded shadow-lg overflow-hidden">
            <Command.Input
              placeholder="Type a command..."
              className="w-full px-4 py-3 bg-transparent border-none outline-none text-sm font-vcr placeholder:text-muted-foreground"
            />

            <Command.List className="max-h-[300px] overflow-y-auto border-t border-border">
              <Command.Empty className="px-4 py-3 text-sm text-muted-foreground font-vcr">
                No results found.
              </Command.Empty>

              <Command.Group heading="Actions" className="px-2 py-2">
                <Command.Item
                  onSelect={handleNewTask}
                  className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm font-vcr transition-colors aria-selected:bg-accent/20 aria-selected:text-accent hover:bg-accent/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Task</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </div>
        </div>
      </Command.Dialog>
    </>
  )
}
