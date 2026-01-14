/**
 * App Providers - tRPC + React Query setup
 */

import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createTRPCClient } from '@/lib/trpc-client'
import { useRouteContext } from '@tanstack/react-router'

/**
 * Main provider wrapper
 * Uses QueryClient from router context (set up in router.tsx for SSR)
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  // Get queryClient from router context (created in createRouter)
  const { queryClient } = useRouteContext({ from: '__root__' })

  // Create tRPC client
  const trpcClient = useMemo(() => createTRPCClient(), [])

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
