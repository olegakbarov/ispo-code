import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        refetchOnWindowFocus: false,
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient },
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: false, // We provide our own QueryClientProvider in TRPCProvider
  })

  return router
}

// SSR requires a fresh router per request - no singleton caching
export function getRouter() {
  return createRouter()
}

export interface RouterContext {
  queryClient: QueryClient
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
