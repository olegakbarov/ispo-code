/**
 * Daemon Spawner - Utility for spawning detached agent daemon processes
 *
 * This module provides functions for spawning agent daemons as detached
 * child processes that will continue running even if the parent server restarts.
 */

import { spawn, type ChildProcess } from "child_process"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { randomBytes } from "crypto"
import type { AgentType } from "../lib/agent/types"

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Configuration for spawning an agent daemon
 */
export interface SpawnDaemonConfig {
  sessionId: string
  agentType: AgentType
  prompt: string
  workingDir: string
  daemonNonce?: string
  model?: string
  cliSessionId?: string
  isResume?: boolean
  taskPath?: string
  streamServerUrl?: string
}

/**
 * Spawn an agent daemon as a detached process
 *
 * The daemon will:
 * - Run independently of the parent process
 * - Continue running even if parent restarts
 * - Publish all output to durable streams
 * - Exit automatically when the agent completes
 *
 * @returns Process ID of the spawned daemon
 */
export function spawnAgentDaemon(config: SpawnDaemonConfig): number {
  const daemonNonce = config.daemonNonce ?? randomBytes(16).toString("hex")
  const daemonConfig = { ...config, daemonNonce }
  // Path to the daemon script
  const daemonPath = join(__dirname, "agent-daemon.js")

  // For development, use tsx to run TypeScript directly
  const isDev = process.env.NODE_ENV !== "production"
  const command = isDev ? "tsx" : "node"
  const args = isDev
    ? [join(__dirname, "agent-daemon.ts"), `--config=${JSON.stringify(daemonConfig)}`]
    : [daemonPath, `--config=${JSON.stringify(daemonConfig)}`]

  console.log(`[SpawnDaemon] Spawning daemon for session ${config.sessionId}`)
  console.log(`[SpawnDaemon] Command: ${command} ${args[0]}`)

  // Spawn as detached process
  const child: ChildProcess = spawn(command, args, {
    detached: true,
    stdio: "ignore", // Don't pipe stdio to parent
    cwd: daemonConfig.workingDir,
    env: {
      ...process.env,
      STREAM_SERVER_URL: daemonConfig.streamServerUrl || process.env.STREAM_SERVER_URL,
    },
  })

  // Unreference so parent can exit independently
  child.unref()

  const pid = child.pid!
  console.log(`[SpawnDaemon] Spawned daemon with PID: ${pid}`)

  return pid
}

/**
 * Check if a daemon process is still running
 */
export function isDaemonRunning(pid: number): boolean {
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
export function killDaemon(pid: number): boolean {
  try {
    process.kill(pid, "SIGTERM")
    return true
  } catch {
    return false
  }
}
