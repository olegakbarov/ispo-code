import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync, unlinkSync, copyFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { AgentSession, AgentOutputChunk, SessionStatus } from "./types.js"
import { safeValidateSessionsData } from "./session-schema.js"
import { SecurityConfig } from "./security-config.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "..", "data")
const SESSIONS_FILE = join(DATA_DIR, "sessions.json")
const TEMP_FILE_SUFFIX = ".tmp"

interface SessionsData {
  sessions: AgentSession[]
}

/**
 * Session store - persists agent sessions to disk
 *
 * Features:
 * - Atomic writes using temp file + rename pattern
 * - Output buffering with concurrent-safe flushing
 * - Automatic cleanup of buffers for completed sessions
 */
class SessionStore {
  private data: SessionsData
  private outputBuffers = new Map<string, AgentOutputChunk[]>()
  private flushPromises = new Map<string, Promise<void>>()
  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private flushDelayMs = 250
  private writeLock = Promise.resolve()

  constructor() {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    this.data = this.load()
  }

  private load(): SessionsData {
    if (!existsSync(SESSIONS_FILE)) {
      return { sessions: [] }
    }

    try {
      const raw = readFileSync(SESSIONS_FILE, "utf-8")
      const parsed = JSON.parse(raw)

      // Validate the data structure
      const validation = safeValidateSessionsData(parsed)

      if (!validation.success || !validation.data) {
        console.error(
          `[SessionStore] Invalid session data detected: ${validation.error}`,
        )

        // Create backup of corrupted file
        const backupPath = SESSIONS_FILE + `.corrupted.${Date.now()}.json`
        try {
          copyFileSync(SESSIONS_FILE, backupPath)
          console.log(`[SessionStore] Backed up corrupted data to ${backupPath}`)
        } catch (backupErr) {
          console.error(`[SessionStore] Failed to create backup:`, backupErr)
        }

        // Return empty sessions to recover gracefully
        console.log(`[SessionStore] Resetting to empty sessions`)
        return { sessions: [] }
      }

      return validation.data
    } catch (err) {
      console.error(`[SessionStore] Failed to load sessions:`, err)
      return { sessions: [] }
    }
  }

  /**
   * Atomic save using temp file + rename pattern
   * This prevents data corruption if process crashes mid-write
   */
  private async save(): Promise<void> {
    // Use a lock to prevent concurrent writes
    this.writeLock = this.writeLock.then(async () => {
      try {
        const tempFile = SESSIONS_FILE + TEMP_FILE_SUFFIX
        writeFileSync(tempFile, JSON.stringify(this.data, null, 2))
        renameSync(tempFile, SESSIONS_FILE)
      } catch (err) {
        console.error("[SessionStore] Failed to save sessions:", err)
        throw err
      }
    })
    return this.writeLock
  }

  /**
   * Synchronous save (for legacy compatibility)
   */
  private saveSync(): void {
    try {
      const tempFile = SESSIONS_FILE + TEMP_FILE_SUFFIX
      writeFileSync(tempFile, JSON.stringify(this.data, null, 2))
      renameSync(tempFile, SESSIONS_FILE)
    } catch (err) {
      console.error("[SessionStore] Failed to save sessions:", err)
      throw err
    }
  }

  createSession(session: AgentSession): void {
    this.data.sessions.push(session)
    this.outputBuffers.set(session.id, [])
    this.saveSync()
  }

  updateSession(sessionId: string, updates: Partial<AgentSession>): void {
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (session) {
      Object.assign(session, updates)
      this.saveSync()
    }
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (session) {
      session.status = status
      if (status === "completed" || status === "failed" || status === "cancelled") {
        session.completedAt = new Date().toISOString()
        // Clean up buffer for completed sessions
        this.outputBuffers.delete(sessionId)
        const timer = this.flushTimers.get(sessionId)
        if (timer) clearTimeout(timer)
        this.flushTimers.delete(sessionId)
        this.flushPromises.delete(sessionId)
      }
      this.saveSync()
    }
  }

  /**
   * Calculate total size of output in bytes
   */
  private calculateOutputSize(output: AgentOutputChunk[]): number {
    return output.reduce((total, chunk) => {
      const chunkSize = Buffer.byteLength(chunk.content, 'utf-8')
      const metadataSize = chunk.metadata ? Buffer.byteLength(JSON.stringify(chunk.metadata), 'utf-8') : 0
      return total + chunkSize + metadataSize
    }, 0)
  }

  /**
   * Prune old output chunks to keep within size limits
   */
  private pruneOutputIfNeeded(session: AgentSession): void {
    const currentSize = this.calculateOutputSize(session.output)

    if (currentSize <= SecurityConfig.MAX_OUTPUT_SIZE_BYTES) {
      return // No pruning needed
    }

    // Keep the most recent chunks that fit within the limit
    // Use a sliding window approach - keep last 60% of allowed size
    const targetSize = Math.floor(SecurityConfig.MAX_OUTPUT_SIZE_BYTES * 0.6)
    let accumulatedSize = 0
    let keepFromIndex = session.output.length

    // Scan backwards to find where to cut
    for (let i = session.output.length - 1; i >= 0; i--) {
      const chunk = session.output[i]
      const chunkSize = Buffer.byteLength(chunk.content, 'utf-8')
      accumulatedSize += chunkSize

      if (accumulatedSize > targetSize) {
        keepFromIndex = i + 1
        break
      }
    }

    const removedCount = keepFromIndex
    if (removedCount > 0) {
      session.output = session.output.slice(keepFromIndex)

      // Add a marker chunk to indicate truncation
      session.output.unshift({
        type: "system",
        content: `[Output truncated: removed ${removedCount} older chunks to stay within ${Math.floor(SecurityConfig.MAX_OUTPUT_SIZE_BYTES / 1024 / 1024)}MB limit]`,
        timestamp: new Date().toISOString(),
      })

      console.log(
        `[SessionStore] Pruned ${removedCount} output chunks from session ${session.id} (${Math.floor(currentSize / 1024)}KB -> ${Math.floor(this.calculateOutputSize(session.output) / 1024)}KB)`
      )
    }
  }

  /**
   * Append output to session with concurrent-safe buffering and size limits
   * Uses per-session flush promises to prevent race conditions
   */
  appendOutput(sessionId: string, chunk: AgentOutputChunk): void {
    let buffer = this.outputBuffers.get(sessionId)
    if (!buffer) {
      buffer = []
      this.outputBuffers.set(sessionId, buffer)
    }

    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (session) {
      session.output.push(chunk)

      // Prune output if it exceeds size limits
      this.pruneOutputIfNeeded(session)
    }

    buffer.push(chunk)

    // Persist output quickly so streaming output survives hot reloads or
    // separate worker instances (without waiting for a 10-chunk flush).
    if (!this.flushTimers.has(sessionId)) {
      const timer = setTimeout(() => {
        this.flushTimers.delete(sessionId)
        void this.flushOutput(sessionId)
      }, this.flushDelayMs)
      this.flushTimers.set(sessionId, timer)
    }

    // Flush every 10 chunks
    if (buffer.length >= SecurityConfig.FLUSH_CHUNK_THRESHOLD) {
      void this.flushOutput(sessionId)
    }
  }

  /**
   * Flush output buffer to disk with concurrent safety
   * Uses per-session promises to prevent concurrent flushes
   */
  async flushOutput(sessionId: string): Promise<void> {
    const timer = this.flushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(sessionId)
    }

    // If a flush is already in progress, wait for it
    const existingFlush = this.flushPromises.get(sessionId)
    if (existingFlush) {
      return existingFlush
    }

    const flushPromise = (async () => {
      try {
        const buffer = this.outputBuffers.get(sessionId)
        const session = this.data.sessions.find((s) => s.id === sessionId)
        if (!session || !buffer || buffer.length === 0) return

        buffer.length = 0
        await this.save()
      } catch (err) {
        console.error("[SessionStore] Failed to flush output:", err)
      } finally {
        this.flushPromises.delete(sessionId)
      }
    })()

    this.flushPromises.set(sessionId, flushPromise)
    return flushPromise
  }

  /**
   * Synchronous flush for legacy compatibility
   */
  flushOutputSync(sessionId: string): void {
    const buffer = this.outputBuffers.get(sessionId)
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (!session || !buffer || buffer.length === 0) return

    buffer.length = 0
    this.saveSync()
  }

  getSession(sessionId: string): AgentSession | null {
    return this.data.sessions.find((s) => s.id === sessionId) || null
  }

  getAllSessions(): AgentSession[] {
    return [...this.data.sessions].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  }

  getActiveSessions(): AgentSession[] {
    return this.data.sessions.filter((s) =>
      s.status === "running" ||
      s.status === "pending" ||
      s.status === "working" ||
      s.status === "waiting_approval" ||
      s.status === "waiting_input"
    )
  }

  deleteSession(sessionId: string): boolean {
    const index = this.data.sessions.findIndex((s) => s.id === sessionId)
    if (index !== -1) {
      this.data.sessions.splice(index, 1)
      this.outputBuffers.delete(sessionId)
      this.flushPromises.delete(sessionId)
      const timer = this.flushTimers.get(sessionId)
      if (timer) clearTimeout(timer)
      this.flushTimers.delete(sessionId)
      this.saveSync()
      return true
    }
    return false
  }

  /**
   * Update session without immediately saving (for high-frequency updates)
   */
  updateSessionBuffered(sessionId: string, updates: Partial<AgentSession>, options?: { save?: boolean }): void {
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (session) {
      Object.assign(session, updates)
      if (options?.save !== false) {
        this.saveSync()
      }
    }
  }

  /**
   * Clean up old completed sessions to prevent memory leaks
   * @param maxAge Maximum age in milliseconds (default: 7 days)
   * @param maxCount Maximum number of sessions to keep (default: 100)
   */
  pruneOldSessions(maxAge: number = 7 * 24 * 60 * 60 * 1000, maxCount: number = 100): void {
    const now = Date.now()
    const completedSessions = this.data.sessions.filter(
      (s) => s.status === "completed" || s.status === "failed" || s.status === "cancelled"
    )

    // Remove sessions older than maxAge
    let pruned = 0
    this.data.sessions = this.data.sessions.filter((session) => {
      if (
        (session.status === "completed" || session.status === "failed" || session.status === "cancelled") &&
        session.completedAt
      ) {
        const age = now - new Date(session.completedAt).getTime()
        if (age > maxAge) {
          this.outputBuffers.delete(session.id)
          this.flushPromises.delete(session.id)
          pruned++
          return false
        }
      }
      return true
    })

    // If still too many sessions, remove oldest completed ones
    if (this.data.sessions.length > maxCount) {
      const activeCount = this.data.sessions.filter(
        (s) => !(s.status === "completed" || s.status === "failed" || s.status === "cancelled")
      ).length

      const completedToRemove = this.data.sessions.length - maxCount
      if (completedToRemove > 0) {
        const completed = this.data.sessions.filter(
          (s) => s.status === "completed" || s.status === "failed" || s.status === "cancelled"
        )
        completed.sort((a, b) => new Date(a.completedAt || a.startedAt).getTime() - new Date(b.completedAt || b.startedAt).getTime())

        const toRemove = completed.slice(0, Math.min(completedToRemove, completed.length))
        for (const session of toRemove) {
          const index = this.data.sessions.findIndex((s) => s.id === session.id)
          if (index !== -1) {
            this.data.sessions.splice(index, 1)
            this.outputBuffers.delete(session.id)
            this.flushPromises.delete(session.id)
            pruned++
          }
        }
      }
    }

    if (pruned > 0) {
      this.saveSync()
      console.log(`[SessionStore] Pruned ${pruned} old sessions`)
    }
  }
}

let instance: SessionStore | null = null

export function getSessionStore(): SessionStore {
  if (!instance) {
    instance = new SessionStore()
  }
  return instance
}
