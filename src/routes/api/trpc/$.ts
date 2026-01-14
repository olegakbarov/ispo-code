/**
 * tRPC API Route Handler
 *
 * Handles all /api/trpc/* requests using the fetch adapter
 * Working directory can be set via X-Working-Dir header
 * Session isolation: pass X-Session-Id to auto-resolve to worktree path
 */

import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/trpc/router"
import { ensureServerEnv } from "@/lib/server/env"
import { getAgentManager } from "@/lib/agent/manager"

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
    // Use worktree path if available, otherwise use session's working dir
    workingDir = session?.worktreePath ?? session?.workingDir ?? null
  }

  // Fall back to default working directory
  const finalWorkingDir: string = workingDir || DEFAULT_WORKING_DIR

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({
      workingDir: finalWorkingDir,
      sessionId: sessionId ?? undefined,
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
