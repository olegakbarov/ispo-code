import { Link } from '@tanstack/react-router'
import { Cpu, BarChart3, Wrench, GitBranch } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import { TaskListSidebar } from '@/components/tasks/task-list-sidebar'
import { UserMenu } from '@/components/auth/user-menu'
import { GitHubLoginButton } from '@/components/auth/github-login-button'

export function Sidebar() {
  const { data: session } = trpc.github.getSession.useQuery()

  return (
    <aside className="w-80 bg-card flex flex-col border-r border-border">
      <header className="h-12 flex items-center border-b border-border">
        <Link to="/" className="flex items-center gap-2 px-3 h-full hover:bg-secondary/50 transition-colors">
          <Cpu className="w-5 h-5 text-primary" />
          <h1 className="font-vcr text-sm text-primary">Agentz</h1>
        </Link>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Task List - always visible */}
        <TaskListSidebar />
      </div>

      <footer className="border-t border-border shrink-0">
        {/* Worktrees Link */}
        <NavLink to="/worktrees" icon={<GitBranch className="w-4 h-4" />}>Worktrees</NavLink>

        {/* Stats Link */}
        <NavLink to="/stats" icon={<BarChart3 className="w-4 h-4" />}>Stats</NavLink>

        {/* Tool Calls Gallery Link */}
        <NavLink to="/tool-calls" icon={<Wrench className="w-4 h-4" />}>Tool Calls</NavLink>

        {/* GitHub Auth */}
        <div className="px-3 py-2 border-t border-border">
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

