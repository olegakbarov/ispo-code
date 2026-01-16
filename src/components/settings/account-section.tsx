/**
 * Account Section - user account management and authentication
 */

import { User, LogOut, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { trpc } from "@/lib/trpc-client"

/**
 * Claude Auth Section - toggle between API key and subscription auth
 */
export function ClaudeAuthSection() {
  const { data: claudeUseSubscription, isLoading } = trpc.system.getClaudeUseSubscription.useQuery()
  const utils = trpc.useUtils()

  const setSubscriptionMutation = trpc.system.setClaudeUseSubscription.useMutation({
    onMutate: async ({ enabled }) => {
      // Optimistic update
      await utils.system.getClaudeUseSubscription.cancel()
      const previousValue = utils.system.getClaudeUseSubscription.getData()
      utils.system.getClaudeUseSubscription.setData(undefined, enabled)
      return { previousValue }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousValue !== undefined) {
        utils.system.getClaudeUseSubscription.setData(undefined, context.previousValue)
      }
    },
    onSettled: () => {
      utils.system.getClaudeUseSubscription.invalidate()
    },
  })

  const handleChange = (enabled: boolean) => {
    setSubscriptionMutation.mutate({ enabled })
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Claude Authentication</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Choose how Claude CLI authenticates. Use your Max/Pro subscription ($200/month) instead of API credits.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner size="xs" />
          Loading...
        </div>
      ) : (
        <>
          {/* Auth method toggle */}
          <div className="space-y-3">
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                !claudeUseSubscription
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => handleChange(false)}
            >
              <input
                type="radio"
                name="claude-auth"
                checked={!claudeUseSubscription}
                onChange={() => handleChange(false)}
                className="accent-primary"
              />
              <div className="flex-1">
                <div className="text-xs font-medium">API Key (Pay-per-use)</div>
                <div className="text-[10px] text-muted-foreground">
                  Uses ANTHROPIC_API_KEY env var. Billed per token.
                </div>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                claudeUseSubscription
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => handleChange(true)}
            >
              <input
                type="radio"
                name="claude-auth"
                checked={claudeUseSubscription}
                onChange={() => handleChange(true)}
                className="accent-primary"
              />
              <div className="flex-1">
                <div className="text-xs font-medium">Subscription (Max/Pro)</div>
                <div className="text-[10px] text-muted-foreground">
                  Uses your logged-in Claude account. Requires <code className="px-1 py-0.5 bg-muted rounded">claude login</code>.
                </div>
              </div>
            </label>
          </div>

          {claudeUseSubscription && (
            <div className="mt-3 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400">
              Make sure you're logged in: run <code className="px-1 py-0.5 bg-background rounded">claude login</code> in terminal first.
            </div>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Account Section - shows user info and sign out option
 */
export function AccountSection() {
  const { data: session } = trpc.github.getSession.useQuery()

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.reload()
  }

  // Only show if authenticated
  if (!session?.authenticated || !session.username) {
    return null
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Account</h2>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Manage your GitHub account connection.
      </p>

      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
            {session.username[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium">{session.username}</div>
            <div className="text-xs text-muted-foreground">Connected via GitHub</div>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleLogout}
          variant="outline"
          size="xs"
          className="flex items-center gap-2"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </Button>
      </div>
    </section>
  )
}
