import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { AgentSession, AgentOutputChunk, SessionStatus } from "./types.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "..", "..", "data")
const SESSIONS_FILE = join(DATA_DIR, "sessions.json")

interface SessionsData {
  sessions: AgentSession[]
}

/**
 * Session store - persists agent sessions to disk
 */
class SessionStore {
  private data: SessionsData
  private outputBuffers = new Map<string, AgentOutputChunk[]>()

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
      return JSON.parse(readFileSync(SESSIONS_FILE, "utf-8"))
    } catch {
      return { sessions: [] }
    }
  }

  private save() {
    writeFileSync(SESSIONS_FILE, JSON.stringify(this.data, null, 2))
  }

  createSession(session: AgentSession): void {
    this.data.sessions.push(session)
    this.outputBuffers.set(session.id, [])
    this.save()
  }

  updateSession(sessionId: string, updates: Partial<AgentSession>): void {
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (session) {
      Object.assign(session, updates)
      this.save()
    }
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (session) {
      session.status = status
      if (status === "completed" || status === "failed" || status === "cancelled") {
        session.completedAt = new Date().toISOString()
      }
      this.save()
    }
  }

  appendOutput(sessionId: string, chunk: AgentOutputChunk): void {
    let buffer = this.outputBuffers.get(sessionId)
    if (!buffer) {
      buffer = []
      this.outputBuffers.set(sessionId, buffer)
    }

    buffer.push(chunk)
    // Flush every 10 chunks
    if (buffer.length >= 10) {
      this.flushOutput(sessionId)
    }
  }

  flushOutput(sessionId: string): void {
    const buffer = this.outputBuffers.get(sessionId)
    const session = this.data.sessions.find((s) => s.id === sessionId)
    if (!session || !buffer || buffer.length === 0) return

    session.output.push(...buffer)
    buffer.length = 0
    this.save()
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
      this.save()
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
        this.save()
      }
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
