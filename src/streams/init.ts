/**
 * Stream Server Initialization
 *
 * Auto-starts the durable streams server when the app starts.
 * This ensures agents can communicate via streams even if the main server restarts.
 */

import { startStreamServer, type StreamServerConfig } from './server'

let serverStarted = false
let serverPromise: Promise<void> | null = null

/**
 * Initialize the streams server (singleton pattern).
 * Safe to call multiple times - will only start once.
 */
export async function initializeStreamsServer(config?: StreamServerConfig): Promise<void> {
  // Return existing promise if already starting
  if (serverPromise) {
    return serverPromise
  }

  // Already started
  if (serverStarted) {
    return
  }

  // Start server (save promise for concurrent calls)
  serverPromise = startStreamServer(config)
    .then(() => {
      serverStarted = true
      console.log('[Streams] ✓ Durable streams server initialized')
    })
    .catch((error) => {
      console.error('[Streams] ✗ Failed to initialize streams server:', error)
      // Reset so it can be retried
      serverPromise = null
      throw error
    })

  return serverPromise
}

/**
 * Check if the streams server has been initialized.
 */
export function isStreamsServerInitialized(): boolean {
  return serverStarted
}

/**
 * Auto-initialize on module load (for server-side).
 * This runs when the server starts, ensuring streams are available immediately.
 */
if (typeof process !== 'undefined' && !process.env.SKIP_STREAMS_INIT) {
  // Initialize in background, don't block module load
  initializeStreamsServer().catch((error) => {
    console.error('[Streams] Failed to auto-initialize:', error)
  })
}
