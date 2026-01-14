import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import type { DaemonConfig } from "./agent-daemon"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "data")
const REGISTRY_FILE = join(DATA_DIR, "daemon-registry.json")
const TEMP_FILE_SUFFIX = ".tmp"
const REGISTRY_VERSION = 1

export interface DaemonRecord {
  sessionId: string
  pid: number
  daemonNonce: string
  startedAt: string
  config: DaemonConfig
}

interface DaemonRegistryData {
  version: number
  daemons: DaemonRecord[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDaemonConfig(value: unknown): value is DaemonConfig {
  if (!isPlainObject(value)) return false
  return (
    typeof value.sessionId === "string" &&
    typeof value.agentType === "string" &&
    typeof value.prompt === "string" &&
    typeof value.workingDir === "string" &&
    typeof value.daemonNonce === "string"
  )
}

function isDaemonRecord(value: unknown): value is DaemonRecord {
  if (!isPlainObject(value)) return false
  return (
    typeof value.sessionId === "string" &&
    typeof value.pid === "number" &&
    Number.isFinite(value.pid) &&
    typeof value.daemonNonce === "string" &&
    typeof value.startedAt === "string" &&
    isDaemonConfig(value.config)
  )
}

function coerceRegistryData(value: unknown): DaemonRegistryData {
  if (!isPlainObject(value)) {
    return { version: REGISTRY_VERSION, daemons: [] }
  }

  const rawDaemons = Array.isArray(value.daemons) ? value.daemons : []
  const daemons = rawDaemons.filter(isDaemonRecord)

  return {
    version: REGISTRY_VERSION,
    daemons,
  }
}

class DaemonRegistry {
  private data: DaemonRegistryData

  constructor() {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    this.data = this.load()
  }

  reload(): void {
    this.data = this.load()
  }

  list(): DaemonRecord[] {
    return [...this.data.daemons]
  }

  get(sessionId: string): DaemonRecord | undefined {
    return this.data.daemons.find((record) => record.sessionId === sessionId)
  }

  register(record: DaemonRecord): void {
    const existingIndex = this.data.daemons.findIndex(
      (entry) => entry.sessionId === record.sessionId
    )
    if (existingIndex >= 0) {
      this.data.daemons[existingIndex] = record
    } else {
      this.data.daemons.push(record)
    }
    this.saveSync()
  }

  remove(sessionId: string): void {
    const next = this.data.daemons.filter((entry) => entry.sessionId !== sessionId)
    if (next.length === this.data.daemons.length) return
    this.data.daemons = next
    this.saveSync()
  }

  private load(): DaemonRegistryData {
    if (!existsSync(REGISTRY_FILE)) {
      return { version: REGISTRY_VERSION, daemons: [] }
    }

    try {
      const raw = readFileSync(REGISTRY_FILE, "utf-8")
      const parsed = JSON.parse(raw)
      return coerceRegistryData(parsed)
    } catch (err) {
      console.error("[DaemonRegistry] Failed to load registry:", err)

      const backupPath = REGISTRY_FILE + `.corrupted.${Date.now()}.json`
      try {
        copyFileSync(REGISTRY_FILE, backupPath)
        console.log(`[DaemonRegistry] Backed up corrupted registry to ${backupPath}`)
      } catch (backupErr) {
        console.error("[DaemonRegistry] Failed to create backup:", backupErr)
      }

      return { version: REGISTRY_VERSION, daemons: [] }
    }
  }

  private saveSync(): void {
    try {
      const tempFile = REGISTRY_FILE + TEMP_FILE_SUFFIX
      writeFileSync(tempFile, JSON.stringify(this.data, null, 2))
      renameSync(tempFile, REGISTRY_FILE)
    } catch (err) {
      console.error("[DaemonRegistry] Failed to save registry:", err)
      throw err
    }
  }
}

let registryInstance: DaemonRegistry | null = null

export function getDaemonRegistry(): DaemonRegistry {
  if (!registryInstance) {
    registryInstance = new DaemonRegistry()
  }
  return registryInstance
}
