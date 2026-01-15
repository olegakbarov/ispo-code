/**
 * Streams Worker
 *
 * Standalone script to run the durable streams server.
 * This is run alongside the Vite dev server to serve session data.
 * Supports dynamic port allocation to avoid conflicts.
 */

import { startStreamServer, cleanupServerInfo } from '../src/streams/server'
import { rehydrateDaemonsOnBoot } from '../src/daemon/rehydrate'

async function main() {
  console.log('[Worker] Starting streams server...')

  // Start server (will find available port automatically)
  const server = await startStreamServer()
  console.log(`[Worker] Streams server running at ${server.url} (port ${server.port})`)

  // Rehydrate any running daemon sessions
  await rehydrateDaemonsOnBoot()
  console.log('[Worker] Daemon rehydration complete')

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n[Worker] Shutting down...')
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err: unknown) => {
  // Clean up server info on failure
  cleanupServerInfo()

  console.error('[Worker] Failed to start:', err)
  process.exit(1)
})
