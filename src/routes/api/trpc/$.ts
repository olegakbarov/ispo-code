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
import { getWorktreeForSession } from "@/lib/agent/git-worktree"
import { getGitRoot } from "@/lib/agent/git-service"
import { getSession } from "@/lib/auth/session-store"

// Default working directory - falls back to current working directory
ensureServerEnv()
const DEFAULT_WORKING_DIR = process.env.WORKING_DIR || process.cwd()

const serve = async (request: Request) => {
  let workingDir: string | null = request.headers.get("X-Working-Dir")
  const sessionId = request.headers.get("X-Session-Id")

  // Check for session-based worktree isolation (preferred over base working dir)
  if (sessionId) {
    const manager = getAgentManager()
    const session = manager.getSession(sessionId)
    let sessionWorktreePath: string | undefined

    // Prefer session store worktree path when available
    if (session?.worktreePath && existsSync(session.worktreePath)) {
      sessionWorktreePath = session.worktreePath
    } else if (session?.worktreePath || session?.worktreeBranch) {
      // Clear stale worktree info from session if worktree doesn't exist on disk
      delete (session as Record<string, unknown>).worktreePath
      delete (session as Record<string, unknown>).worktreeBranch
      const { getSessionStore } = await import("@/lib/agent/session-store")
      getSessionStore().updateSession(sessionId, { worktreePath: undefined, worktreeBranch: undefined } as Partial<typeof session>)
      console.log(`[tRPC] Cleared stale worktree info for session ${sessionId}`)
    }

    // Fallback: derive worktree path from repo root
    if (!sessionWorktreePath) {
      const baseWorkingDir = workingDir ?? DEFAULT_WORKING_DIR
      const repoRoot = getGitRoot(baseWorkingDir)
      const worktreeInfo = repoRoot ? getWorktreeForSession(sessionId, repoRoot) : null
      if (worktreeInfo && existsSync(worktreeInfo.path)) {
        sessionWorktreePath = worktreeInfo.path
      }
    }

    if (sessionWorktreePath) {
      workingDir = sessionWorktreePath
    } else if (!workingDir) {
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
