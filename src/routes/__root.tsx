import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import '@/lib/client/browser-logger'
import '@/lib/server/setup-server-logging'
import type { RouterContext } from '@/router'
import { useEffect } from 'react'
import appCss from '../styles.css?url'
import { ThemeProvider, ThemeScript } from '@/components/theme'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TRPCProvider } from '@/components/providers'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { AppErrorFallback } from '@/components/ui/app-error-fallback'
import { Sidebar } from '@/components/layout/sidebar'
import { initAudioUnlock } from '@/lib/audio/audio-unlock'
import { preloadHighlighter } from '@/lib/utils/syntax-highlighter'
import { useGlobalAudioNotifications } from '@/lib/hooks/use-global-audio-notifications'
import { GlobalHotkeysProvider } from '@/components/hotkeys/global-hotkeys-provider'

// Preload syntax highlighter early for better UX
preloadHighlighter()


export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ispo Code - Agent Control Panel' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  // Initialize audio unlock listeners for notification sounds
  useEffect(() => {
    initAudioUnlock()
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <HeadContent />
      </head>
      <body>
        <TRPCProvider>
          <ThemeProvider>
            <TooltipProvider>
              <ErrorBoundary name="App" fallback={(error) => <AppErrorFallback error={error} />}>
                <GlobalAudioNotificationsProvider />
                <GlobalHotkeysProvider />
                <div className="flex h-screen overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-hidden bg-background">
                    <Outlet />
                  </main>
                </div>
              </ErrorBoundary>
            </TooltipProvider>
          </ThemeProvider>
        </TRPCProvider>
        <Scripts />
      </body>
    </html>
  )
}

/** Component that mounts global audio notifications (must be inside TRPCProvider) */
function GlobalAudioNotificationsProvider() {
  useGlobalAudioNotifications()
  return null
}
