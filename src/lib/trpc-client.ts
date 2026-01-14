/**
 * tRPC React Client Setup
 *
 * Creates the tRPC client with React Query integration.
 * Includes X-Working-Dir header from Zustand store.
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
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        headers: () => {
          const workingDir = getWorkingDir()
          return workingDir ? { "X-Working-Dir": workingDir } : {}
        },
      }),
    ],
  })
}
