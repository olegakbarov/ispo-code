/**
 * tRPC React Client Setup
 *
 * Creates the tRPC client with React Query integration.
 * Includes X-Working-Dir header from Zustand store.
 * Supports X-Session-Id header via query context.
 */

import { createTRPCReact } from "@trpc/react-query"
import { httpBatchLink, httpLink, splitLink } from "@trpc/client"
import type { AppRouter } from "@/trpc/router"
import { getWorkingDir } from "@/lib/stores/working-dir"

/**
 * tRPC React hooks
 */
export const trpc = createTRPCReact<AppRouter>()

/**
 * Create tRPC client instance
 *
 * Supports passing sessionId via query context:
 * ```ts
 * trpc.git.status.useQuery(undefined, {
 *   context: { sessionId: 'abc123' }
 * })
 * ```
 */
export function createTRPCClient() {
  const getSessionId = (context?: unknown): string | undefined =>
    (context as { sessionId?: string })?.sessionId

  const getTaskPath = (context?: unknown): string | undefined =>
    (context as { taskPath?: string })?.taskPath

  const buildHeaders = (context?: unknown, includeTaskPath = false) => {
    const workingDir = getWorkingDir()
    const headers: Record<string, string> = {}

    if (workingDir) {
      headers["X-Working-Dir"] = workingDir
    }

    const sessionId = getSessionId(context)
    if (sessionId) {
      headers["X-Session-Id"] = sessionId
    }

    if (includeTaskPath) {
      const taskPath = getTaskPath(context)
      if (taskPath) {
        headers["X-Task-Path"] = taskPath
      }
    }

    return headers
  }

  return trpc.createClient({
    links: [
      splitLink({
        condition(op) {
          return Boolean((op.context as { taskPath?: string })?.taskPath)
        },
        true: httpLink({
          url: "/api/trpc",
          headers: (opts) => buildHeaders(opts.op.context, true),
        }),
        false: httpBatchLink({
          url: "/api/trpc",
          headers: (opts) => {
            const firstOp = opts.opList[0]
            return buildHeaders(firstOp?.context, false)
          },
        }),
      }),
    ],
  })
}
