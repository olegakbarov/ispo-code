/**
 * Audio Unlock Utility
 *
 * Handles browser autoplay policy restrictions by "unlocking" audio
 * capabilities on the first user interaction (click, keypress, etc.).
 *
 * How it works:
 * - Browsers block Audio.play() without prior user gesture
 * - We create an AudioContext on first user interaction
 * - Once resumed, subsequent programmatic audio plays work
 *
 * Usage:
 * - Call initAudioUnlock() once at app startup
 * - Audio notifications will then work from effects
 */

let audioContext: AudioContext | null = null
let isUnlocked = false
let unlockPromiseResolve: ((value: boolean) => void) | null = null

/**
 * Promise that resolves when audio is unlocked.
 * Useful for code that needs to wait for audio availability.
 */
export const audioUnlockedPromise = new Promise<boolean>((resolve) => {
  unlockPromiseResolve = resolve
})

/**
 * Check if audio has been unlocked by user interaction.
 */
export function isAudioUnlocked(): boolean {
  return isUnlocked
}

/**
 * Attempt to unlock audio. Called on user interaction events.
 * Safe to call multiple times - only unlocks once.
 */
async function attemptUnlock(): Promise<void> {
  if (isUnlocked) return

  try {
    // Create AudioContext if needed
    if (!audioContext) {
      audioContext = new AudioContext()
    }

    // Resume the AudioContext (this requires user gesture)
    if (audioContext.state === "suspended") {
      await audioContext.resume()
    }

    // Also play a silent audio element to unlock HTMLAudioElement
    // Some browsers treat AudioContext and HTMLAudioElement separately
    const silentAudio = new Audio()
    silentAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/////////////////////////////////"
    silentAudio.volume = 0

    // This may throw if not unlocked, that's fine
    await silentAudio.play().catch(() => {})
    silentAudio.pause()

    isUnlocked = true
    console.debug("[AudioUnlock] Audio unlocked successfully")
    unlockPromiseResolve?.(true)
  } catch (error) {
    console.debug("[AudioUnlock] Unlock attempt failed:", error)
  }
}

/**
 * Initialize audio unlock listeners.
 * Call this once at app startup (e.g., in root component).
 *
 * Listens for click, keydown, and touchstart events to unlock audio
 * on the first user interaction.
 */
export function initAudioUnlock(): void {
  if (typeof window === "undefined") return

  const events = ["click", "keydown", "touchstart"] as const

  const unlockListener = () => {
    attemptUnlock()
    // Remove listeners after first interaction
    for (const event of events) {
      document.removeEventListener(event, unlockListener, true)
    }
  }

  // Use capture phase to catch events early
  for (const event of events) {
    document.addEventListener(event, unlockListener, true)
  }

  console.debug("[AudioUnlock] Listeners initialized")
}

/**
 * Get the shared AudioContext.
 * May be null if not yet initialized.
 */
export function getAudioContext(): AudioContext | null {
  return audioContext
}
