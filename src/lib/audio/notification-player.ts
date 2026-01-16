/**
 * Notification Audio Player
 *
 * Provides a shared, queued audio playback system for notifications.
 * Ensures only one notification plays at a time, preventing overlapping audio.
 *
 * Features:
 * - Single audio element shared across all notification sources
 * - FIFO queue for pending notifications
 * - Automatic cleanup on completion/error
 * - Promise-based API for awaiting playback
 */

/** Queued notification item */
interface QueuedNotification {
  audioDataUrl: string
  resolve: () => void
  reject: (error: Error) => void
}

/** Shared queue and audio element */
class NotificationPlayer {
  private queue: QueuedNotification[] = []
  private audioElement: HTMLAudioElement | null = null
  private isPlaying = false

  /**
   * Enqueue a notification for playback.
   * Returns a promise that resolves when playback completes or rejects on error.
   */
  async enqueue(audioDataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ audioDataUrl, resolve, reject })

      // Start processing if not already playing
      if (!this.isPlaying) {
        this.processQueue()
      }
    })
  }

  /**
   * Process the queue - plays notifications one at a time.
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const notification = this.queue.shift()!

    try {
      await this.playAudio(notification.audioDataUrl)
      notification.resolve()
    } catch (error) {
      notification.reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      // Continue to next in queue
      this.processQueue()
    }
  }

  /**
   * Play a single audio notification.
   */
  private async playAudio(audioDataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create audio element if needed
      if (!this.audioElement) {
        this.audioElement = new Audio()
      }

      const audio = this.audioElement

      // Set up event handlers
      const onEnded = () => {
        cleanup()
        resolve()
      }

      const onError = (event: ErrorEvent) => {
        cleanup()
        reject(new Error(`Audio playback failed: ${event.message || 'Unknown error'}`))
      }

      const cleanup = () => {
        audio.removeEventListener('ended', onEnded)
        audio.removeEventListener('error', onError as any)
      }

      audio.addEventListener('ended', onEnded)
      audio.addEventListener('error', onError as any)

      // Start playback
      audio.src = audioDataUrl
      audio.play().catch((error) => {
        cleanup()
        reject(error)
      })
    })
  }

  /**
   * Check if a notification is currently playing.
   */
  get playing(): boolean {
    return this.isPlaying
  }

  /**
   * Get the current queue length.
   */
  get queueLength(): number {
    return this.queue.length
  }

  /**
   * Clear the queue (stops pending notifications, not current playback).
   */
  clearQueue(): void {
    // Reject all pending notifications
    for (const notification of this.queue) {
      notification.reject(new Error('Queue cleared'))
    }
    this.queue = []
  }

  /**
   * Stop current playback and clear queue.
   */
  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.src = ''
    }
    this.clearQueue()
    this.isPlaying = false
  }
}

/** Global notification player instance */
const notificationPlayer = new NotificationPlayer()

/**
 * Enqueue a notification audio for playback.
 * Only one notification plays at a time - new notifications are queued.
 *
 * @param audioDataUrl - Data URL of the audio to play
 * @returns Promise that resolves when playback completes
 */
export async function enqueueNotificationAudio(audioDataUrl: string): Promise<void> {
  return notificationPlayer.enqueue(audioDataUrl)
}

/**
 * Check if a notification is currently playing.
 */
export function isNotificationPlaying(): boolean {
  return notificationPlayer.playing
}

/**
 * Get the current notification queue length.
 */
export function getNotificationQueueLength(): number {
  return notificationPlayer.queueLength
}

/**
 * Clear all pending notifications (does not stop current playback).
 */
export function clearNotificationQueue(): void {
  notificationPlayer.clearQueue()
}

/**
 * Stop current notification playback and clear queue.
 */
export function stopNotifications(): void {
  notificationPlayer.stop()
}
