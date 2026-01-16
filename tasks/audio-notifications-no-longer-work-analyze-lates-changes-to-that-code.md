# audio notifications no longer work. analyze lates changes to that code

## Problem Statement
Audio notifications silent after recent changes. Regression in notification path or playback gating.

## Scope
**In:**
- recent changes in audio notification code
- session status to playback path
- settings and unlock gates

**Out:**
- new notification features
- non-audio UI refactors
- server infra changes

## Implementation Plan

### Phase: Recent Changes
- [x] Collect recent commits for audio notification files with `git log -p`
- [x] Diff last good commit vs head for `src/lib/hooks/use-global-audio-notifications.ts`
- [x] Diff last good commit vs head for `src/lib/audio/audio-unlock.ts`
- [x] Diff last good commit vs head for `src/lib/audio/notification-player.ts`
- [x] Diff last good commit vs head for `src/lib/hooks/use-agent-session-tracking.ts`
- [x] Diff last good commit vs head for `src/lib/hooks/use-audio-notification.ts`

### Phase: Runtime Path
- [x] Trace hook mount in `src/routes/__root.tsx`
- [x] Trace session source and transition logic in `src/lib/hooks/use-global-audio-notifications.ts`
- [x] Trace per-session audio path in `src/lib/hooks/use-agent-session-tracking.ts`
- [x] Trace unlock gating in `src/lib/audio/audio-unlock.ts`
- [x] Trace playback queue in `src/lib/audio/notification-player.ts`
- [x] Verify settings/voice gating in `src/lib/stores/settings.ts`
- [x] Verify TTS request path in `src/trpc/audio.ts`

### Phase: Diagnosis Output
- [x] Identify regression commit and behavior change
- [x] Pin failing condition to specific file
- [x] Propose fix location and minimal change

## Key Files
- `src/routes/__root.tsx` - global hook mount + unlock init
- `src/lib/hooks/use-global-audio-notifications.ts` - global polling + debounce + playback
- `src/lib/hooks/use-agent-session-tracking.ts` - tasks page audio snapshot
- `src/lib/hooks/use-audio-notification.ts` - per-session playback
- `src/lib/audio/audio-unlock.ts` - autoplay unlock gate
- `src/lib/audio/notification-player.ts` - shared queue player
- `src/trpc/audio.ts` - TTS generation + cache
- `src/lib/stores/settings.ts` - audioEnabled + voiceId
- `src/routes/settings/index.tsx` - toggle + preview UI

## Success Criteria
- [x] Recent commit list and diffs captured for audio files
- [x] Call chain documented to `enqueueNotificationAudio`
- [x] Regression hypothesis tied to file and commit

## Diagnosis Results

### Regression Identified

**Commit:** `fea9b49` - "feat: serialize audio notifications with shared player"

**Root Cause:** The shared notification player (`src/lib/audio/notification-player.ts:68-102`) does NOT check if audio has been unlocked before attempting playback. The refactor moved the unlock check to the hooks, but the player itself bypasses this validation.

**Broken Flow:**
1. Hook checks `isAudioUnlocked()` → passes (returns true prematurely or race condition)
2. Hook calls `enqueueNotificationAudio(audioDataUrl)`
3. Player queues notification
4. Player's `playAudio()` method creates Audio element and calls `audio.play()` at line 98
5. Browser rejects with `NotAllowedError` if audio isn't truly unlocked
6. Error caught at line 98-100, notification rejected, no sound plays
7. Error logged but not surfaced to hooks

**Previous Behavior (before fea9b49):**
- Each hook had its own Audio element
- Unlock check and playback happened atomically in the same function
- No opportunity for race condition between check and play

**Current Behavior (after fea9b49):**
- Hooks check unlock, then enqueue
- Player processes queue asynchronously
- Unlock status can change between enqueue and playback
- No re-validation before calling `audio.play()`

**Evidence:**
- `notification-player.ts:68-102` - no `isAudioUnlocked()` check
- `notification-player.ts:98` - direct `audio.play()` call without validation
- `use-global-audio-notifications.ts:89-92` - checks unlock before enqueue
- `use-audio-notification.ts:73-77` - checks unlock before enqueue
- Both hooks assume player will work, but player can fail silently

### Proposed Fix

**Location:** `src/lib/audio/notification-player.ts:68-102` (the `playAudio` method)

**Minimal Change:** Add audio unlock validation before calling `audio.play()`

```typescript
private async playAudio(audioDataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if audio has been unlocked by user interaction
    if (!isAudioUnlocked()) {
      reject(new Error('Audio not unlocked - user interaction required'))
      return
    }

    // Create audio element if needed
    if (!this.audioElement) {
      this.audioElement = new Audio()
    }

    const audio = this.audioElement

    // ... rest of existing code
  })
}
```

**Why This Works:**
- Catches the unlock state at playback time, not enqueue time
- Prevents `NotAllowedError` by failing fast with clear error
- Hooks already await the promise and handle rejection
- Preserves queue ordering and retry logic

**Alternative (if you want to wait for unlock):**
Import `audioUnlockedPromise` and await it in `playAudio`, similar to how hooks do it. However, this could cause queue blocking if unlock never happens.
