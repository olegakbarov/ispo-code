/**
 * Process Monitor - Health Checks and Management
 *
 * Monitors running agent daemon processes and provides health check functionality.
 * Can be used to detect orphaned processes and ensure clean shutdown.
 */

import { spawn, type ChildProcess, type SpawnOptions } from "child_process"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { randomBytes } from "crypto"
import type { DaemonConfig } from "./agent-daemon"
import { getDaemonRegistry, type DaemonRecord } from "./daemon-registry"

const __dirname = dirname(fileURLToPath(import.meta.url))

const RETRYABLE_SPAWN_ERRORS = new Set(["EAGAIN", "EMFILE", "ENFILE", "ENOMEM"])

function isRetryableSpawnError(error: unknown): error is NodeJS.ErrnoException {
  return !!error
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    && RETRYABLE_SPAWN_ERRORS.has(error.code)
}

function formatSpawnError(error: unknown): string {
  if (isRetryableSpawnError(error)) {
    return `Failed to spawn agent daemon: system refused to create a new process (${error.code}).`
  }
  if (error instanceof Error) {
    return `Failed to spawn agent daemon: ${error.message}`
  }
  return "Failed to spawn agent daemon."
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForSpawn(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: unknown) => {
      cleanup()
      reject(err)
    }
    const onSpawn = () => {
      cleanup()
      resolve()
    }
    const cleanup = () => {
      child.removeListener("error", onError)
      child.removeListener("spawn", onSpawn)
    }
    child.once("error", onError)
    child.once("spawn", onSpawn)
  })
}

async function spawnWithRetry(
  command: string,
  args: string[],
  options: SpawnOptions,
  maxAttempts = 3,
  baseDelayMs = 150
): Promise<ChildProcess> {
  let attempt = 0
  let lastError: unknown

  while (attempt < maxAttempts) {
    attempt += 1
    try {
      const child = spawn(command, args, options)
      await waitForSpawn(child)
      return child
    } catch (err) {
      lastError = err
      const isRetryable = isRetryableSpawnError(err)
      if (!isRetryable || attempt >= maxAttempts) {
        throw err
      }
      const waitMs = baseDelayMs * attempt
      const errorCode = (err as NodeJS.ErrnoException).code ?? "unknown"
      console.warn(`[ProcessMonitor] Spawn failed (${errorCode}); retrying in ${waitMs}ms`)
      await delay(waitMs)
    }
  }

  throw lastError ?? new Error("Failed to spawn daemon process.")
}

export interface SpawnedDaemon {
  sessionId: string
  pid: number
  startedAt: Date
  config: DaemonConfig
}

/**
 * Manager for spawning and monitoring agent daemon processes
 */
export class ProcessMonitor {
  private daemons = new Map<string, SpawnedDaemon>()

  /**
   * Spawn a new agent daemon process (detached)
   */
  async spawnDaemon(config: DaemonConfig): Promise<SpawnedDaemon> {
    console.log(`[ProcessMonitor] spawnDaemon called for session ${config.sessionId}`)
    console.log(`[ProcessMonitor] Agent type: ${config.agentType}, Model: ${config.model || 'default'}`)

    const daemonNonce = config.daemonNonce || randomBytes(16).toString("hex")
    const spawnConfig: DaemonConfig = { ...config, daemonNonce }
    const configJson = JSON.stringify(spawnConfig)

    // Use tsx in development mode to run TypeScript directly
    // In production, the daemon script is built alongside the CLI in the package's dist/
    const isDev = process.env.NODE_ENV !== "production"
    const command = isDev ? "tsx" : "node"
    const daemonScript = isDev
      ? join(__dirname, "agent-daemon.ts")
      : join(__dirname, "..", "daemon", "agent-daemon.js") // Relative to dist/cli/ or dist/daemon/

    console.log(`[ProcessMonitor] isDev: ${isDev}, command: ${command}`)
    console.log(`[ProcessMonitor] daemonScript: ${daemonScript}`)
    console.log(`[ProcessMonitor] workingDir: ${spawnConfig.workingDir}`)
    console.log(`[ProcessMonitor] streamServerUrl: ${spawnConfig.streamServerUrl}`)

    // Spawn detached process
    let child: ChildProcess
    try {
      console.log(`[ProcessMonitor] Calling spawnWithRetry...`)
      child = await spawnWithRetry(command, [daemonScript, `--config=${configJson}`], {
        detached: true,
        stdio: "ignore", // Don't pipe stdio - daemon writes to streams
        cwd: spawnConfig.workingDir,
        env: {
          ...process.env,
          STREAM_SERVER_URL: spawnConfig.streamServerUrl || process.env.STREAM_SERVER_URL,
        },
      })
      console.log(`[ProcessMonitor] spawnWithRetry succeeded, PID: ${child.pid}`)
    } catch (err) {
      const message = formatSpawnError(err)
      console.error(`[ProcessMonitor] spawnWithRetry failed: ${message}`)
      console.error(`[ProcessMonitor] Full error:`, err)
      throw new Error(message)
    }

    // Unref so parent can exit independently
    child.unref()

    const daemon: SpawnedDaemon = {
      sessionId: spawnConfig.sessionId,
      pid: child.pid!,
      startedAt: new Date(),
      config: spawnConfig,
    }

    this.daemons.set(spawnConfig.sessionId, daemon)
    getDaemonRegistry().register(this.toRegistryRecord(daemon, daemonNonce))

    console.log(`[ProcessMonitor] Spawned daemon for session ${spawnConfig.sessionId} (PID: ${child.pid})`)

    return daemon
  }

  /**
   * Check if a process is running
   */
  isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without killing it
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  /**
   * Kill a daemon process
   */
  killDaemon(sessionId: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const daemon = this.daemons.get(sessionId)
    if (!daemon) {
      return false
    }

    try {
      if (this.isProcessRunning(daemon.pid)) {
        process.kill(daemon.pid, signal)
        console.log(`[ProcessMonitor] Sent ${signal} to daemon ${sessionId} (PID: ${daemon.pid})`)
      }
      this.daemons.delete(sessionId)
      getDaemonRegistry().remove(sessionId)
      return true
    } catch (err) {
      console.error(`[ProcessMonitor] Failed to kill daemon ${sessionId}:`, err)
      return false
    }
  }

  /**
   * Get all spawned daemons
   */
  getAllDaemons(): SpawnedDaemon[] {
    return Array.from(this.daemons.values())
  }

  /**
   * Get daemon info for a session
   */
  getDaemon(sessionId: string): SpawnedDaemon | undefined {
    return this.daemons.get(sessionId)
  }

  /**
   * Check health of all daemons and remove dead ones
   */
  pruneDeadDaemons(): string[] {
    const deadSessions: string[] = []

    for (const [sessionId, daemon] of this.daemons.entries()) {
      if (!this.isProcessRunning(daemon.pid)) {
        console.log(`[ProcessMonitor] Daemon ${sessionId} (PID: ${daemon.pid}) is no longer running`)
        this.daemons.delete(sessionId)
        getDaemonRegistry().remove(sessionId)
        deadSessions.push(sessionId)
      }
    }

    return deadSessions
  }

  /**
   * Track an existing daemon without spawning a new process.
   */
  attachDaemon(record: DaemonRecord): void {
    const daemon: SpawnedDaemon = {
      sessionId: record.sessionId,
      pid: record.pid,
      startedAt: new Date(record.startedAt),
      config: record.config,
    }
    this.daemons.set(record.sessionId, daemon)
  }

  private toRegistryRecord(daemon: SpawnedDaemon, daemonNonce: string): DaemonRecord {
    return {
      sessionId: daemon.sessionId,
      pid: daemon.pid,
      daemonNonce,
      startedAt: daemon.startedAt.toISOString(),
      config: daemon.config,
    }
  }

  /**
   * Kill all tracked daemons
   */
  killAllDaemons(signal: NodeJS.Signals = "SIGTERM"): void {
    for (const sessionId of this.daemons.keys()) {
      this.killDaemon(sessionId, signal)
    }
  }

  /**
   * Get statistics about running daemons
   */
  getStats(): {
    total: number
    running: number
    dead: number
    byAgentType: Record<string, number>
  } {
    let running = 0
    let dead = 0
    const byAgentType: Record<string, number> = {}

    for (const daemon of this.daemons.values()) {
      if (this.isProcessRunning(daemon.pid)) {
        running++
      } else {
        dead++
      }

      const type = daemon.config.agentType
      byAgentType[type] = (byAgentType[type] || 0) + 1
    }

    return {
      total: this.daemons.size,
      running,
      dead,
      byAgentType,
    }
  }
}

/**
 * Singleton instance
 */
let monitorInstance: ProcessMonitor | null = null

export function getProcessMonitor(): ProcessMonitor {
  if (!monitorInstance) {
    monitorInstance = new ProcessMonitor()
  }
  return monitorInstance
}
