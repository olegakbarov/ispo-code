import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
} from '@tanstack/react-router'
import type { RouterContext } from '@/router'
import { useState, useEffect } from 'react'
import { Moon, Sun, Bot, GitBranch, Cpu, ListTodo, Trash2, FolderOpen, Plus, Map, ChevronRight, Settings } from 'lucide-react'
import appCss from '../styles.css?url'
import { ThemeProvider, ThemeScript, useTheme } from '@/components/theme'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TRPCProvider } from '@/components/providers'
import { trpc } from '@/lib/trpc-client'
import { statusColors, getStatusLabel } from '@/lib/agent/status'
import type { AgentSession, SessionStatus } from '@/lib/agent/types'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { FolderPicker } from '@/components/ui/folder-picker'
import { useWorkingDirStore } from '@/lib/stores/working-dir'
import { useSettingsStore, applyBrandHue } from '@/lib/stores/settings'

// Agent type icons
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
    </svg>
  )
}

function OpenCodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8.78 7.28a.75.75 0 1 0-1.06-1.06l-5.25 5.25a.75.75 0 0 0 0 1.06l5.25 5.25a.75.75 0 1 0 1.06-1.06L4.06 12l4.72-4.72zm6.44 0a.75.75 0 0 1 1.06-1.06l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L19.94 12l-4.72-4.72z"/>
    </svg>
  )
}

function CerebrasIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M14.121 2.701a9.299 9.299 0 000 18.598V22.7c-5.91 0-10.7-4.791-10.7-10.701S8.21 1.299 14.12 1.299V2.7zm4.752 3.677A7.353 7.353 0 109.42 17.643l-.901 1.074a8.754 8.754 0 01-1.08-12.334 8.755 8.755 0 0112.335-1.08l-.901 1.075zm-2.255.844a5.407 5.407 0 00-5.048 9.563l-.656 1.24a6.81 6.81 0 016.358-12.043l-.654 1.24zM14.12 8.539a3.46 3.46 0 100 6.922v1.402a4.863 4.863 0 010-9.726v1.402z"/>
    </svg>
  )
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Agentz - Agent Control Panel' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  const brandHue = useSettingsStore((s) => s.brandHue)

  // Apply brand hue to CSS on mount and when it changes
  useEffect(() => {
    applyBrandHue(brandHue)
  }, [brandHue])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <TRPCProvider>
          <ThemeProvider>
            <TooltipProvider>
              <ErrorBoundary
                name="App"
                fallback={(error) => (
                  <div className="flex items-center justify-center h-screen bg-background">
                    <div className="max-w-2xl p-8 border border-red-500 bg-red-50 dark:bg-red-950 rounded-lg">
                      <h1 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">
                        Application Error
                      </h1>
                      <p className="text-red-600 dark:text-red-400 mb-4">
                        An unexpected error occurred in the application.
                        Please try refreshing the page.
                      </p>
                      <details className="text-sm text-red-600 dark:text-red-400">
                        <summary className="cursor-pointer font-semibold">Error details</summary>
                        <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900 rounded overflow-x-auto">
                          {error.toString()}
                          {error.stack && `\n\n${error.stack}`}
                        </pre>
                      </details>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        Reload Page
                      </button>
                    </div>
                  </div>
                )}
              >
                <div className="flex h-screen overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-auto bg-background">
                    <Outlet />
                  </main>
                </div>
              </ErrorBoundary>
            </TooltipProvider>
          </ThemeProvider>
        </TRPCProvider>
        <Scripts />
      </body>
    </html>
  )
}

function Sidebar() {
  const [agentsExpanded, setAgentsExpanded] = useState(true)
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const utils = trpc.useUtils()

  // Fetch sessions from server
  const { data: sessions = [] } = trpc.agent.list.useQuery(undefined, {
    refetchInterval: 3000, // Poll every 3s for status updates
  })

  // Delete mutation
  const deleteMutation = trpc.agent.delete.useMutation({
    onSuccess: () => utils.agent.list.invalidate(),
  })

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteMutation.mutate({ id: sessionId })
  }

  const sessionCount = sessions.length

  return (
    <aside className="w-56 bg-card flex flex-col border-r border-border">
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

      {/* Project Selector */}
      <ProjectIndicator />

      <nav className="divide-y divide-border/40">
        <NavLink to="/tasks" icon={<ListTodo className="w-4 h-4" />}>Tasks</NavLink>
        <NavLink to="/git" icon={<GitBranch className="w-4 h-4" />}>Git</NavLink>
        <NavLink to="/map" icon={<Map className="w-4 h-4" />}>Map</NavLink>
        <NavLink to="/settings" icon={<Settings className="w-4 h-4" />}>Settings</NavLink>
      </nav>

      <div className="flex-1 overflow-y-auto">
        {/* AGENTS */}
        <div>
          <button
            onClick={() => setAgentsExpanded(!agentsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-vcr text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Agents
              {sessionCount > 0 && (
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full">
                  {sessionCount}
                </span>
              )}
            </span>
            <span className="text-xs">{agentsExpanded ? '−' : '+'}</span>
          </button>

          {agentsExpanded && (
            <div className="relative">
              <div aria-hidden className="pointer-events-none absolute left-5 top-0 bottom-0 w-px bg-border/40" />

              {/* New Agent Button */}
              <Link
                to="/"
                className="w-full flex items-center gap-2 pr-3 pl-8 py-2 text-xs font-vcr text-primary hover:bg-secondary border-t border-border/30 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>New Agent</span>
              </Link>

              {/* Agent Sessions */}
              {sessions.length > 0 ? (
                <div className="border-t border-border/30">
                  {sessions.map((session) => (
                    <AgentSessionLink
                      key={session.id}
                      session={session}
                      onDelete={handleDeleteSession}
                    />
                  ))}
                </div>
              ) : (
                <div className="pr-3 pl-8 py-3 text-xs text-muted-foreground border-t border-border/30">
                  No active sessions
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="px-3 py-2 border-t border-border">
        <p className="font-vcr text-[9px] text-muted-foreground-faint text-center">
          v0.1.0
        </p>
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
 * Status indicator dot
 */
function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${statusColors[status]}`}
      title={getStatusLabel(status)}
    />
  )
}

/**
 * Agent type icon component
 */
function AgentTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'cerebras':
      return <CerebrasIcon className={className} />
    case 'opencode':
      return <OpenCodeIcon className={className} />
    case 'claude':
      return <ClaudeIcon className={className} />
    default:
      return <Bot className={className} />
  }
}

/**
 * Agent session link with status and delete button
 */
function AgentSessionLink({
  session,
  onDelete,
}: {
  session: AgentSession
  onDelete: (sessionId: string, e: React.MouseEvent) => void
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Use title if available, otherwise truncate prompt for display
  const displayText = session.title
    ? (session.title.length > 30 ? session.title.slice(0, 27) + '...' : session.title)
    : (session.prompt.length > 30 ? session.prompt.slice(0, 27) + '...' : session.prompt)

  return (
    <Link
      to="/agents/$sessionId"
      params={{ sessionId: session.id }}
      className="group relative flex items-center gap-2 pr-3 pl-8 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
      activeProps={{
        className: 'bg-primary/10 text-foreground border-l-2 border-primary pl-[30px]',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <StatusDot status={session.status} />
      <AgentTypeIcon type={session.agentType ?? 'opencode'} className="w-3 h-3 shrink-0" />
      <span className="truncate flex-1">{displayText}</span>
      {isHovered && (
        <button
          onClick={(e) => onDelete(session.id, e)}
          className="absolute right-2 p-1 text-muted-foreground hover:text-error hover:bg-error/10 rounded transition-colors"
          title="Delete session"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
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
        className="w-full px-3 py-2 border-b border-border text-left hover:bg-secondary/50 transition-colors cursor-pointer"
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
