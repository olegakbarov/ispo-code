/**
 * tRPC API Route Handler
 *
 * Handles all /api/trpc/* requests using the fetch adapter
 * Working directory can be set via X-Working-Dir header
 */

import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@/trpc/router"
import { ensureServerEnv } from "@/lib/server/env"

// Default working directory - falls back to current working directory
ensureServerEnv()
const DEFAULT_WORKING_DIR = process.env.WORKING_DIR || process.cwd()

const serve = async (request: Request) => {
  // Read working directory from header, fall back to default
  const workingDir = request.headers.get("X-Working-Dir") || DEFAULT_WORKING_DIR

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({ workingDir }),
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
