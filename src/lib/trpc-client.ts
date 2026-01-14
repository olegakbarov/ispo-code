/**
 * tRPC React Client Setup
 *
 * Creates the tRPC client with React Query integration.
 * Includes X-Working-Dir header from Zustand store.
 * Supports X-Session-Id header via query context.
 */

import { createTRPCReact } from "@trpc/react-query"
import { httpBatchLink } from "@trpc/client"
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
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        headers: (opts) => {
          const workingDir = getWorkingDir()
          const headers: Record<string, string> = {}

          if (workingDir) {
            headers["X-Working-Dir"] = workingDir
          }

          // Extract sessionId from query context
          if (opts.opList.length > 0) {
            const firstOp = opts.opList[0]
            const sessionId = (firstOp.context as any)?.sessionId
            if (sessionId) {
              headers["X-Session-Id"] = sessionId
            }
          }

          return headers
        },
      }),
    ],
  })
}
