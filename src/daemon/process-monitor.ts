/**
 * Process Monitor - Health Checks and Management
 *
 * Monitors running agent daemon processes and provides health check functionality.
 * Can be used to detect orphaned processes and ensure clean shutdown.
 */

import { spawn, ChildProcess } from "child_process"
import { join } from "path"
import type { DaemonConfig } from "./agent-daemon"

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
  spawnDaemon(config: DaemonConfig): SpawnedDaemon {
    const daemonScript = join(process.cwd(), "dist", "daemon", "agent-daemon.js")
    const configJson = JSON.stringify(config)

    // Spawn detached process
    const child: ChildProcess = spawn("node", [daemonScript, `--config=${configJson}`], {
      detached: true,
      stdio: "ignore", // Don't pipe stdio - daemon writes to streams
      cwd: config.workingDir,
      env: {
        ...process.env,
        STREAM_SERVER_URL: config.streamServerUrl || process.env.STREAM_SERVER_URL,
      },
    })

    // Unref so parent can exit independently
    child.unref()

    const daemon: SpawnedDaemon = {
      sessionId: config.sessionId,
      pid: child.pid!,
      startedAt: new Date(),
      config,
    }

    this.daemons.set(config.sessionId, daemon)

    console.log(`[ProcessMonitor] Spawned daemon for session ${config.sessionId} (PID: ${child.pid})`)

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
        deadSessions.push(sessionId)
      }
    }

    return deadSessions
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
