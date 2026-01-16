/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type PlayImpl = (() => Promise<void>) | null

class MockAudio {
  static playImpl: PlayImpl = null
  muted = false
  src = ''
  constructor(src?: string) {
    if (src) this.src = src
  }
  setAttribute = vi.fn()
  play() {
    if (MockAudio.playImpl) return MockAudio.playImpl()
    return Promise.resolve()
  }
  pause() {
    // no-op
  }
}

class MockAudioContext {
  state: AudioContextState = 'suspended'
  resume = vi.fn(async () => {
    this.state = 'running'
  })
}

beforeEach(() => {
  vi.resetModules()
  MockAudio.playImpl = null
  ;(globalThis as unknown as { Audio: typeof MockAudio }).Audio = MockAudio
  ;(globalThis as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext
})

describe('audio unlock', () => {
  it('unlocks on trusted interaction even if silent audio is unsupported', async () => {
    MockAudio.playImpl = () =>
      Promise.reject(new DOMException('unsupported', 'NotSupportedError'))

    const { audioUnlockedPromise, isAudioUnlocked, tryUnlockAudio } = await import(
      '@/lib/audio/audio-unlock'
    )

    const unlocked = await tryUnlockAudio({ isTrusted: true } as Event)

    expect(unlocked).toBe(true)
    expect(isAudioUnlocked()).toBe(true)
    await expect(audioUnlockedPromise).resolves.toBe(true)
  })

  it('does not unlock when play is blocked without a trusted interaction', async () => {
    MockAudio.playImpl = () =>
      Promise.reject(new DOMException('blocked', 'NotAllowedError'))

    const { isAudioUnlocked, tryUnlockAudio } = await import('@/lib/audio/audio-unlock')

    const unlocked = await tryUnlockAudio({ isTrusted: false } as Event)

    expect(unlocked).toBe(false)
    expect(isAudioUnlocked()).toBe(false)
  })
})
