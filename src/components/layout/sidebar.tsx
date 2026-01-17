import { Link } from '@tanstack/react-router'
import { HelpCircle } from 'lucide-react'
import { trpc } from '@/lib/trpc-client'
import { TaskListSidebar } from '@/components/tasks/task-list-sidebar'
import { UserMenu } from '@/components/auth/user-menu'
import { GitHubLoginButton } from '@/components/auth/github-login-button'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import {
  InfoCard,
  InfoCardContent,
  InfoCardTitle,
  InfoCardDescription,
  InfoCardFooter,
  InfoCardAction,
  InfoCardDismiss,
} from '@/components/ui/info-card'

export function Sidebar() {
  const { data: session } = trpc.github.getSession.useQuery()

  return (
    <aside className="w-[400px] bg-card flex flex-col border-r border-border">
      <header className="flex justify-center py-10">
        <Link to="/" className="hover:opacity-70 transition-opacity">
          <img src="/ispo.svg" alt="ISPO" className="h-6 dark:invert" />
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
        {/* FAQ InfoCard */}
        <div className="p-3">
          <InfoCard dismissType="once">
            <InfoCardContent>
              <InfoCardTitle className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                FAQ
              </InfoCardTitle>
              <InfoCardDescription>
                Common questions answered
              </InfoCardDescription>
            </InfoCardContent>
            <InfoCardFooter>
              <InfoCardAction>
                <Link
                  to="/docs/faq"
                  className="text-primary hover:underline"
                >
                  View FAQ →
                </Link>
              </InfoCardAction>
              <InfoCardDismiss>Dismiss</InfoCardDismiss>
            </InfoCardFooter>
          </InfoCard>
        </div>
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

