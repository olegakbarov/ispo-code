/**
 * Durable Streams Client Factory
 *
 * Provides client connections to the durable streams server.
 * Used by both the API layer (for reading) and agent daemons (for writing).
 * Supports dynamic port discovery via server info file.
 */

import { DurableStream } from "@durable-streams/client"
import { match } from 'ts-pattern'
import type { RegistryEvent, SessionStreamEvent } from "./schemas"
import { REGISTRY_STREAM, getSessionStreamPath } from "./schemas"
import { readServerInfo } from "./server"

const DEFAULT_STREAM_SERVER_URL = "http://127.0.0.1:4201"

/**
 * Get the stream server base URL (with discovery support)
 */
export function getStreamServerUrl(): string {
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
  return DEFAULT_STREAM_SERVER_URL
}

/**
 * Create a DurableStream handle for a specific stream path
 */
export function createStreamHandle(streamPath: string): DurableStream {
  return new DurableStream({
    url: `${getStreamServerUrl()}${streamPath}`,
  })
}

/**
 * High-level API for interacting with streams
 */
export class StreamAPI {
  private baseUrl: string

  constructor(serverUrl?: string) {
    this.baseUrl = serverUrl || getStreamServerUrl()
  }

  /**
   * Get a stream handle for a path
   */
  private getHandle(streamPath: string): DurableStream {
    return new DurableStream({
      url: `${this.baseUrl}${streamPath}`,
      contentType: 'application/json',
    })
  }

  /**
   * Ensure a stream exists, creating it if necessary
   */
  private async ensureStreamExists(streamPath: string): Promise<void> {
    const handle = this.getHandle(streamPath)
    try {
      await handle.create()
    } catch (err: unknown) {
      // Stream already exists (409 Conflict) - that's fine
      if (err && typeof err === 'object') {
        // Check for CONFLICT_EXISTS code or 409 status
        if ('code' in err && err.code === 'CONFLICT_EXISTS') {
          return
        }
        if ('status' in err && err.status === 409) {
          return
        }
      }
      throw err
    }
  }

  /**
   * Append an event to the registry stream
   */
  async appendToRegistry(event: RegistryEvent): Promise<void> {
    console.log(`[StreamAPI] appendToRegistry: ${event.type} for session ${event.sessionId}`)
    console.log(`[StreamAPI] baseUrl: ${this.baseUrl}`)
    try {
      await this.ensureStreamExists(REGISTRY_STREAM)
      const handle = this.getHandle(REGISTRY_STREAM)
      await handle.append([JSON.stringify(event)])
      console.log(`[StreamAPI] appendToRegistry: success`)
    } catch (err) {
      console.error(`[StreamAPI] appendToRegistry failed:`, err)
      throw err
    }
  }

  /**
   * Append an event to a session stream
   */
  async appendToSession(sessionId: string, event: SessionStreamEvent): Promise<void> {
    const streamPath = getSessionStreamPath(sessionId)
    console.log(`[StreamAPI] appendToSession(${sessionId}): ${event.type}`)
    console.log(`[StreamAPI] streamPath: ${streamPath}, baseUrl: ${this.baseUrl}`)
    try {
      await this.ensureStreamExists(streamPath)
      const handle = this.getHandle(streamPath)
      await handle.append([JSON.stringify(event)])
      console.log(`[StreamAPI] appendToSession: success`)
    } catch (err) {
      console.error(`[StreamAPI] appendToSession failed:`, err)
      throw err
    }
  }

  /**
   * Append a generic event to any stream (e.g., control streams)
   */
  async append(streamPath: string, event: unknown): Promise<void> {
    await this.ensureStreamExists(streamPath)
    const handle = this.getHandle(streamPath)
    await handle.append([JSON.stringify(event)])
  }

  /**
   * Read all events from the registry stream
   */
  async readRegistry(): Promise<RegistryEvent[]> {
    try {
      const handle = this.getHandle(REGISTRY_STREAM)
      const response = await handle.stream({ live: false })
      const decoder = new TextDecoder()
      const events: RegistryEvent[] = []
      let fullText = ""

      for await (const chunk of response.bodyStream()) {
        fullText += decoder.decode(chunk, { stream: true })
      }

      // Handle trailing decoder flush
      fullText += decoder.decode()

      if (!fullText.trim()) {
        return []
      }

      // Try parsing as JSON array first (durable-streams format)
      try {
        const parsed = JSON.parse(fullText)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            // Each item might be an array containing a JSON string, or the event directly
            const eventData = Array.isArray(item) ? item[0] : item
            if (typeof eventData === "string") {
              events.push(JSON.parse(eventData) as RegistryEvent)
            } else if (typeof eventData === "object") {
              events.push(eventData as RegistryEvent)
            }
          }
          return events
        }
      } catch {
        // Fall through to line-based parsing
      }

      // Fallback: try newline-delimited JSON
      const lines = fullText.split("\n").filter((line: string) => line.trim())
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as RegistryEvent)
        } catch {
          // Skip invalid JSON
        }
      }

      return events
    } catch (error: unknown) {
      // Stream doesn't exist yet - handle both NOT_FOUND code and HTTP 404
      if (error && typeof error === "object") {
        if ("code" in error && error.code === "NOT_FOUND") {
          return []
        }
        // Handle HTTP 404 from FetchError
        if ("message" in error && typeof error.message === "string" && error.message.includes("404")) {
          return []
        }
      }
      throw error
    }
  }

  /**
   * Read all events from a session stream
   */
  async readSession(sessionId: string): Promise<SessionStreamEvent[]> {
    try {
      const handle = this.getHandle(getSessionStreamPath(sessionId))
      const response = await handle.stream({ live: false })
      const decoder = new TextDecoder()
      const events: SessionStreamEvent[] = []
      let fullText = ""

      for await (const chunk of response.bodyStream()) {
        fullText += decoder.decode(chunk, { stream: true })
      }

      // Handle trailing decoder flush
      fullText += decoder.decode()

      if (!fullText.trim()) {
        return []
      }

      // Try parsing as JSON array first (durable-streams format)
      try {
        const parsed = JSON.parse(fullText)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            // Each item might be an array containing a JSON string, or the event directly
            const eventData = Array.isArray(item) ? item[0] : item
            if (typeof eventData === "string") {
              events.push(JSON.parse(eventData) as SessionStreamEvent)
            } else if (typeof eventData === "object") {
              events.push(eventData as SessionStreamEvent)
            }
          }
          return events
        }
      } catch {
        // Fall through to line-based parsing
      }

      // Fallback: try newline-delimited JSON
      const lines = fullText.split("\n").filter((line: string) => line.trim())
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as SessionStreamEvent)
        } catch {
          // Skip invalid JSON
        }
      }

      return events
    } catch (error: unknown) {
      // Stream doesn't exist yet - handle both NOT_FOUND code and HTTP 404
      if (error && typeof error === "object") {
        if ("code" in error && error.code === "NOT_FOUND") {
          return []
        }
        // Handle HTTP 404 from FetchError
        if ("message" in error && typeof error.message === "string" && error.message.includes("404")) {
          return []
        }
      }
      throw error
    }
  }

  /**
   * Subscribe to new events from the registry stream (SSE)
   */
  async *subscribeToRegistry(opts?: { fromStart?: boolean }): AsyncIterable<RegistryEvent> {
    const handle = this.getHandle(REGISTRY_STREAM)
    const response = await handle.stream({
      live: "sse",
      offset: opts?.fromStart ? "0" : undefined,
    })

    const decoder = new TextDecoder()

    for await (const chunk of response.bodyStream()) {
      const text = decoder.decode(chunk, { stream: true })
      const lines = text.split("\n").filter((line: string) => line.trim())
      for (const line of lines) {
        try {
          yield JSON.parse(line) as RegistryEvent
        } catch {
          // Skip invalid JSON or SSE control messages
        }
      }
    }
  }

  /**
   * Subscribe to new events from a session stream (SSE)
   */
  async *subscribeToSession(
    sessionId: string,
    opts?: { fromStart?: boolean }
  ): AsyncIterable<SessionStreamEvent> {
    const handle = this.getHandle(getSessionStreamPath(sessionId))
    const response = await handle.stream({
      live: "sse",
      offset: opts?.fromStart ? "0" : undefined,
    })

    const decoder = new TextDecoder()

    for await (const chunk of response.bodyStream()) {
      const text = decoder.decode(chunk, { stream: true })
      const lines = text.split("\n").filter((line: string) => line.trim())
      for (const line of lines) {
        try {
          yield JSON.parse(line) as SessionStreamEvent
        } catch {
          // Skip invalid JSON or SSE control messages
        }
      }
    }
  }

  /**
   * Get registry events for a specific session
   */
  async getSessionRegistryEvents(sessionId: string): Promise<RegistryEvent[]> {
    const allEvents = await this.readRegistry()
    return allEvents.filter((event) => event.sessionId === sessionId)
  }

  /**
   * Get the latest status for a session from the registry
   */
  async getSessionStatus(sessionId: string): Promise<{
    status: string
    latestEvent: RegistryEvent | null
  }> {
    const events = await this.getSessionRegistryEvents(sessionId)
    if (events.length === 0) {
      return { status: "unknown", latestEvent: null }
    }

    const latestEvent = events[events.length - 1]
    const status = match(latestEvent.type)
      .with("session_created", () => "pending")
      .with("session_updated", () => latestEvent.status)
      .with("session_completed", () => "completed")
      .with("session_failed", () => "failed")
      .with("session_cancelled", () => "cancelled")
      .otherwise(() => "unknown")

    return { status, latestEvent }
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const events = await this.getSessionRegistryEvents(sessionId)
      return events.length > 0
    } catch {
      return false
    }
  }
}

/**
 * Get a singleton instance of the StreamAPI
 */
let streamAPIInstance: StreamAPI | null = null

export function getStreamAPI(serverUrl?: string): StreamAPI {
  if (!streamAPIInstance) {
    streamAPIInstance = new StreamAPI(serverUrl)
  }
  return streamAPIInstance
}
