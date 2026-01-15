import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Moon, Sun, Cpu, FolderOpen, ChevronRight, Settings, BarChart3 } from 'lucide-react'
import { useTheme } from '@/components/theme'
import { trpc } from '@/lib/trpc-client'
import { FolderPicker } from '@/components/ui/folder-picker'
import { useWorkingDirStore } from '@/lib/stores/working-dir'
import { TaskListSidebar } from '@/components/tasks/task-list-sidebar'

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <aside className="w-80 bg-card flex flex-col border-r border-border">
      <header className="h-12 flex items-center gap-2 px-3 border-b border-border">
        <Cpu className="w-5 h-5 text-primary" />
        <h1 className="font-vcr text-sm text-primary">Agentz</h1>
        <button
          type="button"
          onClick={toggleTheme}
          className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
          aria-label={`Switch to ${nextTheme} mode`}
          title={`Switch to ${nextTheme} mode`}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Task List - always visible */}
        <TaskListSidebar />
      </div>

      <footer className="border-t border-border shrink-0">
        {/* Project Selector */}
        <ProjectIndicator />

        {/* Stats Link */}
        <NavLink to="/stats" icon={<BarChart3 className="w-4 h-4" />}>Stats</NavLink>

        {/* Settings Link */}
        <NavLink to="/settings" icon={<Settings className="w-4 h-4" />}>Settings</NavLink>
      </footer>
    </aside>
  )
}

function NavLink({ to, icon, children }: { to: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 text-sm font-vcr text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
      activeProps={{
        className: 'text-primary bg-secondary',
      }}
    >
      {icon}
      {children}
    </Link>
  )
}

/**
 * Project indicator - shows current working directory
 * Click to open folder picker and change working directory
 */
function ProjectIndicator() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { workingDir: selectedDir } = useWorkingDirStore()
  const { data: serverDir, isLoading } = trpc.system.workingDir.useQuery()

  // Use selected dir from store, or fall back to server default
  const effectiveDir = selectedDir ?? serverDir

  // Get display name (last part of path)
  const displayName = effectiveDir
    ? effectiveDir.split('/').filter(Boolean).pop() || effectiveDir
    : isLoading ? 'Loading...' : 'No project'

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        className="w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="flex-1 min-w-0 text-xs font-vcr truncate text-foreground">
            {displayName}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        </div>
        {effectiveDir && (
          <div className="mt-1 text-[10px] text-muted-foreground truncate" title={effectiveDir}>
            {effectiveDir}
          </div>
        )}
      </button>
      <FolderPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  )
}
