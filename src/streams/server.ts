/**
 * Durable Streams Server Configuration
 *
 * Sets up the durable streams server for persisting agent session events.
 * Uses file-based storage with append-only logs for durability.
 */

import { DurableStreamTestServer } from "@durable-streams/server"
import { join } from "path"
import { existsSync, mkdirSync } from "fs"

const STREAMS_DIR = process.env.STREAMS_DIR || join(process.cwd(), ".streams")

// Ensure streams directory exists
if (!existsSync(STREAMS_DIR)) {
  mkdirSync(STREAMS_DIR, { recursive: true })
}

/**
 * Stream server configuration options
 */
export interface StreamServerConfig {
  port?: number
  dataDir?: string
  host?: string
}

/**
 * Start the stream server on the specified port
 */
export async function startStreamServer(config: StreamServerConfig = {}) {
  const port = config.port || 4201
  const dataDir = config.dataDir || STREAMS_DIR
  const host = config.host || "127.0.0.1"

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  const server = new DurableStreamTestServer({
    port,
    host,
    dataDir,
  })

  await server.start()

  console.log(`[Streams] Server started on ${server.url}`)

  return {
    url: server.url,
    port,
    close: async () => {
      await server.stop()
    },
  }
}

/**
 * Get the stream server URL
 */
export function getStreamServerUrl(port: number = 4201): string {
  return process.env.STREAM_SERVER_URL || `http://localhost:${port}`
}

/**
 * Get the streams data directory path
 */
export function getStreamsDataDir(): string {
  return STREAMS_DIR
}
