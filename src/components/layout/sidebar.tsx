import { Link } from '@tanstack/react-router'
import { Cpu } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import { TaskListSidebar } from '@/components/tasks/task-list-sidebar'
import { UserMenu } from '@/components/auth/user-menu'
import { GitHubLoginButton } from '@/components/auth/github-login-button'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export function Sidebar() {
  const { data: session } = trpc.github.getSession.useQuery()

  return (
    <aside className="w-80 bg-card flex flex-col border-r border-border">
      <header className="h-12 flex items-center border-b border-border">
        <Link to="/" className="flex items-center gap-2 px-3 h-full hover:bg-secondary/50 transition-colors">
          <Cpu className="w-5 h-5 text-primary" />
          <h1 className="font-vcr text-sm text-primary">ISPO Code</h1>
        </Link>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Task List - always visible */}
        <ErrorBoundary
          name="TaskListSidebar"
          fallback={
            <div className="flex-1 flex items-center justify-center p-3">
              <div className="text-sm text-destructive">Task list failed to load</div>
            </div>
          }
        >
          <TaskListSidebar />
        </ErrorBoundary>
      </div>

      <footer className="border-t border-border shrink-0">
        {/* GitHub Auth */}
        <div className="px-3 py-2">
          {session?.authenticated ? (
            <UserMenu />
          ) : (
            <GitHubLoginButton />
          )}
        </div>
      </footer>
    </aside>
  )
}

