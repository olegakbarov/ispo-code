/**
 * Durable Streams Server Configuration
 *
 * Sets up the durable streams server for persisting agent session events.
 * Uses file-based storage with append-only logs for durability.
 * Supports dynamic port allocation to avoid conflicts.
 */

import { DurableStreamTestServer } from "@durable-streams/server"
import { join } from "path"
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "fs"
import { createServer } from "net"

const STREAMS_DIR = process.env.STREAMS_DIR || join(process.cwd(), ".streams")
const SERVER_INFO_FILE = join(STREAMS_DIR, "server.json")
const BASE_PORT = parseInt(process.env.STREAMS_BASE_PORT || "4201", 10)
const MAX_PORT_ATTEMPTS = 10

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
 * Check if a port is available
 */
async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

/**
 * Find an available port starting from basePort
 */
async function findAvailablePort(basePort: number, host: string): Promise<number> {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const port = basePort + i
    if (await isPortAvailable(port, host)) {
      return port
    }
  }
  throw new Error(`No available port found in range ${basePort}-${basePort + MAX_PORT_ATTEMPTS - 1}`)
}

/**
 * Write server info to discovery file
 */
function writeServerInfo(port: number, host: string): void {
  const info = {
    port,
    host,
    url: `http://${host}:${port}`,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(SERVER_INFO_FILE, JSON.stringify(info, null, 2))
}

/**
 * Read server info from discovery file
 */
export function readServerInfo(): { port: number; host: string; url: string; pid: number } | null {
  try {
    if (!existsSync(SERVER_INFO_FILE)) return null
    const content = readFileSync(SERVER_INFO_FILE, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Clean up server info file
 */
export function cleanupServerInfo(): void {
  try {
    if (existsSync(SERVER_INFO_FILE)) {
      unlinkSync(SERVER_INFO_FILE)
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Start the stream server, finding an available port if needed
 */
export async function startStreamServer(config: StreamServerConfig = {}) {
  const dataDir = config.dataDir || STREAMS_DIR
  const host = config.host || "127.0.0.1"

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  // Find available port (use specified port or find one starting from BASE_PORT)
  const port = config.port
    ? (await isPortAvailable(config.port, host) ? config.port : await findAvailablePort(BASE_PORT, host))
    : await findAvailablePort(BASE_PORT, host)

  const server = new DurableStreamTestServer({
    port,
    host,
    dataDir,
  })

  await server.start()

  // Write server info for client discovery
  writeServerInfo(port, host)

  console.log(`[Streams] Server started on http://${host}:${port}`)

  return {
    url: `http://${host}:${port}`,
    port,
    close: async () => {
      cleanupServerInfo()
      await server.stop()
    },
  }
}

/**
 * Get the stream server URL (reads from discovery file or falls back to env/default)
 */
export function getStreamServerUrl(port: number = BASE_PORT): string {
  // Check environment variable first
  if (process.env.STREAM_SERVER_URL) {
    return process.env.STREAM_SERVER_URL
  }

  // Try reading from discovery file
  const serverInfo = readServerInfo()
  if (serverInfo) {
    return serverInfo.url
  }

  // Fallback to default
  return `http://127.0.0.1:${port}`
}

/**
 * Get the streams data directory path
 */
export function getStreamsDataDir(): string {
  return STREAMS_DIR
}
