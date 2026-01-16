# audio notifications are broken

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Audio notifications never play when sessions reach terminal states; browser logs show repeated unlock failures and notification waits.
- **Immediate Cause**: `playNotification()` in `src/lib/hooks/use-audio-notification.ts` (and the global hook) waits on `audioUnlockedPromise`, but `audioUnlockedPromise` never resolves because `attemptUnlock()` fails to unlock HTMLAudioElement playback.
- **Call Chain**: Session completes -> `useAudioNotification`/`useGlobalAudioNotifications` detects terminal transition -> `playNotification()` -> `isAudioUnlocked()` false -> await `audioUnlockedPromise` -> `initAudioUnlock()` listener fires -> `attemptUnlock()` -> `silentAudio.play()` throws -> `htmlUnlocked` stays false -> unlock never resolves -> notification never plays.
- **Original Trigger**: `attemptUnlock()` requires a silent audio data URL (`audio/mp3`) to play successfully; failures keep `isUnlocked` false, so all later notifications hang waiting for unlock.
- **Evidence**: `logs/browser.log` shows repeated `[AudioUnlock] Silent audio play failed`/`HTML audio unlock failed` and `[AudioNotification] Audio not unlocked yet - waiting for user interaction` with no successful unlock log.

### Phase 2: Pattern Analysis
- **Working Examples**: TBD
- **Key Differences**: TBD
- **Dependencies**: TBD

### Phase 3: Hypothesis & Testing
- **Hypothesis**: TBD
- **Test Design**: TBD
- **Prediction**: TBD
- **Result**: TBD
- **Conclusion**: TBD

### Phase 4: Implementation
- **Root Cause**: TBD
- **Solution**: TBD
- **Test Case**: TBD
- **Verification**: TBD
- **Changes Made**: TBD

## Success Criteria
- [ ] Root cause identified and documented
- [ ] Fix addresses root cause (not symptoms)
- [ ] Test created reproducing bug
- [ ] All tests pass
