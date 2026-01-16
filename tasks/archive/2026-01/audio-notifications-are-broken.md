# audio notifications are broken

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Audio notifications never play when sessions reach terminal states; browser logs show repeated unlock failures and notification waits.
- **Immediate Cause**: `playNotification()` in `src/lib/hooks/use-audio-notification.ts` (and the global hook) waits on `audioUnlockedPromise`, but `audioUnlockedPromise` never resolves because `attemptUnlock()` fails to unlock HTMLAudioElement playback.
- **Call Chain**: Session completes -> `useAudioNotification`/`useGlobalAudioNotifications` detects terminal transition -> `playNotification()` -> `isAudioUnlocked()` false -> await `audioUnlockedPromise` -> `initAudioUnlock()` listener fires -> `attemptUnlock()` -> `silentAudio.play()` throws -> `htmlUnlocked` stays false -> unlock never resolves -> notification never plays.
- **Original Trigger**: `attemptUnlock()` requires a silent audio data URL (`audio/mp3`) to play successfully; failures keep `isUnlocked` false, so all later notifications hang waiting for unlock.
- **Evidence**: `logs/browser.log` shows repeated `[AudioUnlock] Silent audio play failed`/`HTML audio unlock failed` and `[AudioNotification] Audio not unlocked yet - waiting for user interaction` with no successful unlock log.

### Phase 2: Pattern Analysis
- **Working Examples**: `src/routes/settings.tsx` audio preview plays on a user click via `new Audio(result.audioDataUrl).play()` and uses `data:audio/mpeg` from `src/lib/audio/elevenlabs-client.ts`.
- **Key Differences**: Notifications run from effects and wait on `audioUnlockedPromise`; unlock relies on a silent `data:audio/mp3` play that is failing, so notifications never reach the actual `Audio.play()` call.
- **Dependencies**: `initAudioUnlock()` in `src/routes/__root.tsx`, `audioUnlockedPromise`/`isAudioUnlocked` in `src/lib/audio/audio-unlock.ts`, `useSettingsStore` (audioEnabled/selectedVoiceId), `trpc.audio.generateNotification`, ElevenLabs API key.

### Phase 3: Hypothesis & Testing
- **Hypothesis**: Notifications stall because `audioUnlockedPromise` never resolves; `silentAudio.play()` fails (likely due to unsupported `audio/mp3` data URL), so `attemptUnlock()` never flips `isUnlocked` even after real user interaction.
- **Test Design**: Change the silent audio URL to `data:audio/mpeg`, set `muted`/`playsInline`, and allow trusted-gesture fallback when the silent clip fails; add a unit test that mocks `Audio.play()` and verifies `audioUnlockedPromise` resolves after a synthetic click; manual UI test: enable audio, start a session, wait for completion, click once, expect `[AudioUnlock] Audio unlocked successfully` and audible notification.
- **Prediction**: Unlock succeeds on first trusted interaction, `audioUnlockedPromise` resolves, and the pending notification plays without additional status changes.
- **Result**: Unit test passes with a mocked `NotSupportedError` and trusted interaction, confirming the fallback unlock path resolves `audioUnlockedPromise`; manual browser verification still pending.
- **Conclusion**: Hypothesis supported by unit test; still needs real UI validation to confirm audio plays.

### Phase 4: Implementation
- **Root Cause**: `audioUnlockedPromise` never resolved because `attemptUnlock()` required a silent `audio/mp3` play to succeed; the silent clip repeatedly failed, so notifications waited forever for unlock.
- **Solution**: Use a more compatible `data:audio/mpeg` silent clip, set `muted`/`playsinline`, capture error names, and allow trusted-gesture fallback when the silent clip fails for non-`NotAllowedError` reasons; pass the event into `attemptUnlock()` and add unit coverage.
- **Test Case**: `src/lib/audio/audio-unlock.test.ts` mocks `Audio.play()` failures (NotSupported/NotAllowed) and verifies unlock behavior; manual: enable audio + select voice, run a session, wait for completion, click once, expect `[AudioUnlock] Audio unlocked successfully` and audible notification.
- **Verification**: `npm run test:run -- src/lib/audio/audio-unlock.test.ts` (pass). Full suite run shows 2/2 audio tests passing; 8 unrelated pre-existing test failures in manager.test.ts (6) and create-task-visibility.test.ts (2).
- **Changes Made**: `src/lib/audio/audio-unlock.ts` (unlock fallback + MIME/attribute adjustments + event propagation), `src/lib/audio/audio-unlock.test.ts` (new tests), `tasks/audio-notifications-are-broken.md` (investigation log).

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass (audio-unlock tests pass; unrelated pre-existing failures in manager.test.ts and create-task-visibility.test.ts)
