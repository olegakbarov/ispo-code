/**
 * Rehydrate daemon tracking from the file-backed registry after streams start.
 * Validates daemon nonce + PID to avoid attaching to reused processes.
 */

import { getDaemonRegistry } from "./daemon-registry"
import { getProcessMonitor } from "./process-monitor"
import { StreamAPI } from "../streams/client"
import type { DaemonStartedEvent, SessionStreamEvent } from "../streams/schemas"

function findLatestDaemonStarted(
  events: SessionStreamEvent[]
): DaemonStartedEvent | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (event?.type === "daemon_started") {
      return event as DaemonStartedEvent
    }
  }
  return null
}

export async function rehydrateDaemonsOnBoot(): Promise<void> {
  if (process.env.DISABLE_DURABLE_STREAMS === "true") {
    return
  }

  const registry = getDaemonRegistry()
  registry.reload()

  const records = registry.list()
  if (records.length === 0) {
    return
  }

  const monitor = getProcessMonitor()
  const apiByUrl = new Map<string, StreamAPI>()
  let rehydrated = 0
  let pruned = 0

  for (const record of records) {
    if (!monitor.isProcessRunning(record.pid)) {
      registry.remove(record.sessionId)
      pruned += 1
      continue
    }

    const serverUrl = record.config.streamServerUrl || "default"
    if (!apiByUrl.has(serverUrl)) {
      apiByUrl.set(
        serverUrl,
        serverUrl === "default" ? new StreamAPI() : new StreamAPI(record.config.streamServerUrl)
      )
    }

    const streamAPI = apiByUrl.get(serverUrl)!
    let events: SessionStreamEvent[]
    try {
      events = await streamAPI.readSession(record.sessionId)
    } catch (err) {
      console.error(`[Rehydrate] Failed to read session ${record.sessionId}:`, err)
      continue
    }

    const latest = findLatestDaemonStarted(events)
    if (!latest || latest.daemonNonce !== record.daemonNonce || latest.pid !== record.pid) {
      registry.remove(record.sessionId)
      pruned += 1
      continue
    }

    monitor.attachDaemon(record)
    rehydrated += 1
  }

  if (rehydrated > 0 || pruned > 0) {
    console.log(`[Rehydrate] Restored ${rehydrated} daemons, pruned ${pruned} stale records`)
  }
}
