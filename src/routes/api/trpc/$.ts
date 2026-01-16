/**
 * tRPC API Route Handler
 *
 * Handles all /api/trpc/* requests using the fetch adapter
 * Working directory can be set via X-Working-Dir header
 * Session isolation: pass X-Session-Id to auto-resolve to worktree path
 */

import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { existsSync } from "fs"
import { appRouter } from "@/trpc/router"
import { ensureServerEnv } from "@/lib/server/env"
import { getAgentManager } from "@/lib/agent/manager"
import { getSession } from "@/lib/auth/session-store"

// Default working directory - falls back to current working directory
ensureServerEnv()
const DEFAULT_WORKING_DIR = process.env.WORKING_DIR || process.cwd()

const serve = async (request: Request) => {
  let workingDir: string | null = request.headers.get("X-Working-Dir")
  const sessionId = request.headers.get("X-Session-Id")

  // If no explicit working dir, check for session-based worktree isolation
  if (!workingDir && sessionId) {
    const manager = getAgentManager()
    const session = manager.getSession(sessionId)
    // Use worktree path if available AND exists on disk, otherwise fall back to workingDir
    const worktreePath = session?.worktreePath
    if (worktreePath && existsSync(worktreePath)) {
      workingDir = worktreePath
    } else {
      // Clear stale worktree info from session if worktree doesn't exist on disk
      if (session?.worktreePath || session?.worktreeBranch) {
        // Session object is from store, mutate directly and trigger save
        delete (session as Record<string, unknown>).worktreePath
        delete (session as Record<string, unknown>).worktreeBranch
        // Force a save by calling updateSession (this persists the deleted fields)
        const { getSessionStore } = await import("@/lib/agent/session-store")
        getSessionStore().updateSession(sessionId, { worktreePath: undefined, worktreeBranch: undefined } as Partial<typeof session>)
        console.log(`[tRPC] Cleared stale worktree info for session ${sessionId}`)
      }
      workingDir = session?.workingDir ?? null
    }
  }

  // Fall back to default working directory
  const finalWorkingDir: string = workingDir || DEFAULT_WORKING_DIR

  // Extract auth session
  const authSession = await getSession(request)

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({
      workingDir: finalWorkingDir,
      sessionId: sessionId ?? undefined,
      userId: authSession.userId,
      githubToken: authSession.githubToken,
      username: authSession.username,
    }),
  })
}

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: async ({ request }) => serve(request),
      POST: async ({ request }) => serve(request),
    },
  },
})
