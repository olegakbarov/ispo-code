/**
 * tRPC React Client Setup
 *
 * Creates the tRPC client with React Query integration
 */

import { createTRPCReact } from "@trpc/react-query"
import { httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@/trpc/router"

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
      }),
    ],
  })
}
