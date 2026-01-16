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
let listenersInitialized = false

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
type AudioContextConstructor = typeof AudioContext

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null
  const win = window as Window & { webkitAudioContext?: AudioContextConstructor }
  return window.AudioContext ?? win.webkitAudioContext ?? null
}

function getErrorName(error: unknown): string | null {
  if (error instanceof DOMException) return error.name
  if (typeof error === "object" && error && "name" in error) {
    return String((error as { name: unknown }).name)
  }
  return null
}

async function attemptUnlock(event?: Event): Promise<boolean> {
  if (isUnlocked) return true

  const isTrustedInteraction = event?.isTrusted ?? false

  try {
    // Create AudioContext if supported
    if (!audioContext) {
      const AudioContextCtor = getAudioContextConstructor()
      if (AudioContextCtor) {
        audioContext = new AudioContextCtor()
      }
    }

    // Resume the AudioContext (this requires user gesture)
    if (audioContext && audioContext.state === "suspended") {
      void audioContext.resume().catch((error) => {
        console.debug("[AudioUnlock] AudioContext resume failed:", error)
      })
    }

    // Also play a silent audio element to unlock HTMLAudioElement
    // Some browsers treat AudioContext and HTMLAudioElement separately
    const silentAudio = new Audio()
    silentAudio.src = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/////////////////////////////////"
    silentAudio.muted = true
    silentAudio.setAttribute("playsinline", "true")

    let htmlUnlocked = false
    try {
      // Call play() before any await to preserve user-gesture context
      const playPromise = silentAudio.play()
      if (playPromise !== undefined) {
        await playPromise
      }
      htmlUnlocked = true
    } catch (playError) {
      const errorName = getErrorName(playError)
      console.debug("[AudioUnlock] Silent audio play failed:", { name: errorName, error: playError })
      // If this was a trusted user interaction, allow fallback unless it was explicitly blocked.
      if (isTrustedInteraction && errorName !== "NotAllowedError") {
        console.debug("[AudioUnlock] Proceeding with trusted interaction despite silent audio failure")
        htmlUnlocked = true
      }
    }
    silentAudio.pause()

    if (!htmlUnlocked) {
      console.debug("[AudioUnlock] HTML audio unlock failed - will retry on next interaction")
      return false
    }

    isUnlocked = true
    console.debug("[AudioUnlock] Audio unlocked successfully")
    unlockPromiseResolve?.(true)
    unlockPromiseResolve = null
    return true
  } catch (error) {
    console.debug("[AudioUnlock] Unlock attempt failed:", error)
    return false
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
  if (isUnlocked || listenersInitialized) return
  listenersInitialized = true

  const events = ["click", "keydown", "touchstart"] as const

  const unlockListener = (event: Event) => {
    attemptUnlock(event).then((unlocked) => {
      if (!unlocked) return
      // Remove listeners after successful unlock
      for (const event of events) {
        document.removeEventListener(event, unlockListener, true)
      }
    })
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

/**
 * Manually attempt to unlock audio.
 * Useful for retry scenarios when the automatic unlock failed.
 * Returns true if unlock succeeded, false otherwise.
 */
export async function tryUnlockAudio(event?: Event): Promise<boolean> {
  return attemptUnlock(event)
}
