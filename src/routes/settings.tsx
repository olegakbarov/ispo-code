/**
 * Settings Layout Route - Contains navigation for settings subpages
 */

import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { Settings, GitBranch, BarChart3, Wrench, Bot } from "lucide-react"

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border h-12 px-4 flex items-center">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-bold">Settings</h1>
        </div>
      </header>

      {/* Settings Subnav */}
      <nav className="border-b border-border bg-card/50">
        <div className="flex items-center gap-1 px-4 py-2">
          <NavLink to="/settings" icon={<Settings className="w-3 h-3" />}>
            General
          </NavLink>
          <NavLink to="/settings/agent-defaults" icon={<Bot className="w-3 h-3" />}>
            Agent Defaults
          </NavLink>
          <NavLink to="/settings/worktrees" icon={<GitBranch className="w-3 h-3" />}>
            Worktrees
          </NavLink>
          <NavLink to="/settings/stats" icon={<BarChart3 className="w-3 h-3" />}>
            Stats
          </NavLink>
          <NavLink to="/settings/tool-calls" icon={<Wrench className="w-3 h-3" />}>
            Tool Calls
          </NavLink>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}

function NavLink({ to, icon, children }: { to: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors"
      activeOptions={{ exact: to === "/settings" }}
      activeProps={{
        className: 'text-primary bg-secondary',
      }}
    >
      {icon}
      {children}
    </Link>
  )
}
