/**
 * Stream Publisher Utility
 *
 * Handles publishing events to durable streams from agent daemons.
 * Provides buffering and error handling for robust event publishing.
 */

import { StreamAPI } from "../streams/client"
import type { RegistryEvent, SessionStreamEvent } from "../streams/schemas"

export interface StreamPublisherOptions {
  /**
   * Stream server URL
   */
  serverUrl?: string

  /**
   * Buffer events before publishing (for batch writes)
   */
  bufferSize?: number

  /**
   * Flush buffer after this many milliseconds
   */
  flushIntervalMs?: number

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Publisher for writing events to durable streams
 */
export class StreamPublisher {
  private streamAPI: StreamAPI
  private registryBuffer: RegistryEvent[] = []
  private sessionBuffers = new Map<string, SessionStreamEvent[]>()
  private flushTimer: NodeJS.Timeout | null = null
  private options: Required<StreamPublisherOptions>

  constructor(options: StreamPublisherOptions = {}) {
    this.options = {
      serverUrl: options.serverUrl || "http://localhost:4201",
      bufferSize: options.bufferSize ?? 10,
      flushIntervalMs: options.flushIntervalMs ?? 1000,
      debug: options.debug ?? false,
    }

    this.streamAPI = new StreamAPI(this.options.serverUrl)

    // Auto-flush on interval
    if (this.options.flushIntervalMs > 0) {
      this.startFlushTimer()
    }
  }

  /**
   * Start the auto-flush timer
   */
  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        if (this.options.debug) {
          console.error("[StreamPublisher] Auto-flush error:", err)
        }
      })
    }, this.options.flushIntervalMs)
  }

  /**
   * Stop the auto-flush timer
   */
  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  /**
   * Publish an event to the registry stream
   */
  async publishRegistry(event: RegistryEvent): Promise<void> {
    if (this.options.bufferSize > 1) {
      this.registryBuffer.push(event)
      if (this.registryBuffer.length >= this.options.bufferSize) {
        await this.flushRegistry()
      }
    } else {
      // No buffering - publish immediately
      await this.streamAPI.appendToRegistry(event)
    }
  }

  /**
   * Publish an event to a session stream
   */
  async publishSession(sessionId: string, event: SessionStreamEvent): Promise<void> {
    if (this.options.bufferSize > 1) {
      if (!this.sessionBuffers.has(sessionId)) {
        this.sessionBuffers.set(sessionId, [])
      }
      const buffer = this.sessionBuffers.get(sessionId)!
      buffer.push(event)

      if (buffer.length >= this.options.bufferSize) {
        await this.flushSession(sessionId)
      }
    } else {
      // No buffering - publish immediately
      await this.streamAPI.appendToSession(sessionId, event)
    }
  }

  /**
   * Flush registry buffer
   */
  private async flushRegistry(): Promise<void> {
    if (this.registryBuffer.length === 0) return

    const events = [...this.registryBuffer]
    this.registryBuffer = []

    try {
      // Publish all buffered events
      for (const event of events) {
        await this.streamAPI.appendToRegistry(event)
      }

      if (this.options.debug) {
        console.log(`[StreamPublisher] Flushed ${events.length} registry events`)
      }
    } catch (err) {
      // On error, put events back in buffer
      this.registryBuffer.unshift(...events)
      throw err
    }
  }

  /**
   * Flush session buffer
   */
  private async flushSession(sessionId: string): Promise<void> {
    const buffer = this.sessionBuffers.get(sessionId)
    if (!buffer || buffer.length === 0) return

    const events = [...buffer]
    this.sessionBuffers.set(sessionId, [])

    try {
      // Publish all buffered events
      for (const event of events) {
        await this.streamAPI.appendToSession(sessionId, event)
      }

      if (this.options.debug) {
        console.log(`[StreamPublisher] Flushed ${events.length} events for session ${sessionId}`)
      }
    } catch (err) {
      // On error, put events back in buffer
      const currentBuffer = this.sessionBuffers.get(sessionId) || []
      this.sessionBuffers.set(sessionId, [...events, ...currentBuffer])
      throw err
    }
  }

  /**
   * Flush all buffers
   */
  async flush(): Promise<void> {
    await this.flushRegistry()

    // Flush all session buffers
    const sessionIds = Array.from(this.sessionBuffers.keys())
    for (const sessionId of sessionIds) {
      await this.flushSession(sessionId)
    }
  }

  /**
   * Close the publisher and flush all pending events
   */
  async close(): Promise<void> {
    this.stopFlushTimer()
    await this.flush()
  }

  /**
   * Get pending event counts (for debugging)
   */
  getPendingCounts(): { registry: number; sessions: Map<string, number> } {
    const sessions = new Map<string, number>()
    for (const [sessionId, buffer] of this.sessionBuffers.entries()) {
      sessions.set(sessionId, buffer.length)
    }
    return {
      registry: this.registryBuffer.length,
      sessions,
    }
  }
}
