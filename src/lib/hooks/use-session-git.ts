/**
 * Session-aware git operations hook
 *
 * Provides git operations scoped to a specific agent session's worktree
 */

import { useMemo } from "react"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@/trpc/router"
import { getWorkingDir } from "@/lib/stores/working-dir"

/**
 * Create a session-specific tRPC client that includes X-Session-Id header
 */
export function createSessionTRPCClient(sessionId: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        headers: () => {
          const workingDir = getWorkingDir()
          return {
            ...(workingDir ? { "X-Working-Dir": workingDir } : {}),
            "X-Session-Id": sessionId,
          }
        },
      }),
    ],
  })
}

/**
 * Hook for session-scoped git operations
 *
 * Returns a tRPC client that automatically scopes all git operations
 * to the specified session's worktree (if worktree isolation is enabled).
 *
 * @param sessionId - The session ID to scope git operations to
 * @returns tRPC client with session-scoped context
 */
export function useSessionGit(sessionId: string) {
  return useMemo(() => createSessionTRPCClient(sessionId), [sessionId])
}
