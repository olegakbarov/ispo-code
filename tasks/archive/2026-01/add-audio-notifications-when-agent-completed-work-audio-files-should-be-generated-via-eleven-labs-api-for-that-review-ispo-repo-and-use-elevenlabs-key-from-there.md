# Add Audio Notifications on Agent Completion

## Problem Statement
No audio feedback when agents finish work. Users miss completion events when multitasking. Generate notification sounds via ElevenLabs TTS API (key from ispo repo). Users should pick voices and preview samples in settings.

## Scope
**In:**
- Audio notification on session completion/failure
- ElevenLabs TTS integration
- Settings UI: voice picker, sample generation, enable/disable toggle
- Distinct sounds for success vs failure
- User-selected voice persistence

**Out:**
- Background/minimized tab notifications (browser limitation)
- Pre-generated static audio files
- Custom voice uploads

## Implementation Plan

### Phase 1: Environment & Client Setup
- [x] Add `ELEVENLABS_API_KEY` to env schema (`src/env.ts`) - uses ensureServerEnv() pattern
  - ✓ Verified: `src/lib/audio/elevenlabs-client.ts:30-37` uses `ensureServerEnv()` to load the key from `.env`. Note: env file is at `src/lib/server/env.ts`, not `src/env.ts` as documented.
- [x] Create `src/lib/audio/elevenlabs-client.ts`:
  - `listVoices()` - GET /v1/voices
  - `generateSpeech(voiceId, text)` - POST /v1/text-to-speech/{voiceId}
  - Return audio as base64 data URL
  - ✓ Verified: File exists with all three functions implemented correctly (`listVoices`:42-58, `generateSpeech`:64-94, `isConfigured`:100-103)

### Phase 2: Server-side tRPC Endpoints
- [x] Create `src/trpc/audio.ts` router:
  - `audio.listVoices` - returns available voices (name, voiceId, preview_url)
  - `audio.generateSample` - input: voiceId, text; returns base64 audio
  - `audio.generateNotification` - input: type ('completed'|'failed'); uses saved voice
  - ✓ Verified: File exists with `isConfigured`:36-38, `listVoices`:44-56, `generateSample`:62-85, `generateNotification`:91-115
- [x] Register in `src/trpc/router.ts`
  - ✓ Verified: `src/trpc/router.ts:11` imports audioRouter, line 19 registers it
- [x] Cache generated audio in memory per (voiceId + text) key
  - ✓ Verified: `src/trpc/audio.ts:19` creates `audioCache` Map, used in both `generateSample` and `generateNotification`

### Phase 3: Settings Store Extension
- [x] Extend `src/lib/stores/settings.ts`:
  - `audioEnabled: boolean` - toggle notifications
  - `selectedVoiceId: string | null` - user's chosen voice
  - `setAudioEnabled(enabled)`, `setSelectedVoiceId(voiceId)`
  - ✓ Verified: All four properties/methods present in `src/lib/stores/settings.ts:17-24,36-39`

### Phase 4: Settings UI - Audio Section
- [x] Add Audio section to `src/routes/settings.tsx` below Brand Color
  - ✓ Verified: Audio section at lines 250-357
- [x] Enable/disable toggle switch
  - ✓ Verified: Toggle at lines 268-287
- [x] Voice dropdown/list fetched from `audio.listVoices`
  - ✓ Verified: Voice select at lines 289-316
- [x] "Generate Sample" button - plays sample via `audio.generateSample`
  - ✓ Verified: Preview buttons use `generateNotification` mutation (lines 318-352), not `generateSample`. This is a minor deviation but functionally equivalent.
- [x] Show loading state during TTS generation
  - ✓ Verified: `isGenerating` state with Loader2 spinner (lines 331-332, 344-345)
- [x] Preview buttons for success/failure notifications
  - ✓ Verified: Two preview buttons at lines 325-350 for "completed" and "failed"

### Phase 5: Frontend Audio Hook
- [x] Create `src/lib/hooks/use-audio-notification.ts`
  - ✓ Verified: File exists at `/Users/venge/Code/agentz/src/lib/hooks/use-audio-notification.ts`
- [x] Watch session status transitions to terminal states
  - ✓ Verified: Lines 78-109 watch for status transitions using `wasActive && isNowTerminal` check
- [x] Use `isTerminalStatus()` from `src/lib/agent/status.ts`
  - ✓ Verified: Imported at line 16, used at line 97
- [x] Play audio via `<audio>` element
  - ✓ Verified: Audio element created at line 66, played at line 70
- [x] Debounce to prevent duplicate plays
  - ✓ Verified: `hasPlayedRef` prevents duplicate plays (lines 45, 89, 100), reset on sessionId change (lines 112-115)
- [x] Respect `audioEnabled` setting
  - ✓ Verified: Checked at line 86

### Phase 6: Integration
- [x] Add hook to `src/routes/agents/$sessionId.tsx`
  - ✓ Verified: Import at line 16, usage at lines 53-56
- [x] Trigger on status change to completed/failed
  - ✓ Verified: Hook receives `session?.status` and `sessionId` as props

## Key Files
- `src/env.ts` - add ELEVENLABS_API_KEY
  - ⚠️ Note: Actual path is `src/lib/server/env.ts`
- `src/lib/audio/elevenlabs-client.ts` - new, TTS HTTP client ✓
- `src/trpc/audio.ts` - new, voices + TTS endpoints ✓
- `src/trpc/router.ts` - register audio router ✓
- `src/lib/stores/settings.ts` - add audio prefs (enabled, voiceId) ✓
- `src/routes/settings.tsx` - add Audio section with voice picker ✓
- `src/lib/hooks/use-audio-notification.ts` - new, frontend hook ✓
- `src/routes/agents/$sessionId.tsx` - integrate notification hook ✓

## Reference: ElevenLabs API
```typescript
// List voices
GET https://api.elevenlabs.io/v1/voices
// Response: { voices: [{ voice_id, name, preview_url, ... }] }

// Generate speech
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
Headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }
Body: { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.7, similarity_boost: 0.7 } }
// Returns: ArrayBuffer → base64 data URL
```

## Success Criteria
- [x] Audio plays when agent transitions to `completed`/`failed`
  - ✓ Verified: Hook detects transitions and plays appropriate notification
- [x] Settings shows voice picker with all available voices
  - ✓ Verified: Voice dropdown populated from `audio.listVoices` query
- [x] User can generate and hear sample before saving
  - ✓ Verified: Preview buttons generate and play audio via mutation
- [x] Selected voice persists across sessions
  - ✓ Verified: Uses zustand persist middleware in settings store
- [x] Toggle to enable/disable notifications works
  - ✓ Verified: Toggle switch in settings UI, checked in hook
- [x] No audio spam on page refresh (debounced)
  - ✓ Verified: `prevStatus === undefined` check prevents play on initial mount (line 93)

## Verification Results

### Summary: ✅ ALL ITEMS VERIFIED

All implementation items have been verified as complete. The code is well-structured and follows the implementation plan correctly.

### Minor Documentation Issue
- The task document references `src/env.ts` but the actual env loader is at `src/lib/server/env.ts`. This is a documentation inaccuracy only; the implementation is correct.

### Implementation Quality Notes
1. **Type safety**: All code is properly typed with TypeScript
2. **Error handling**: Graceful error handling in both client and hook
3. **Caching**: Server-side audio caching implemented to reduce API calls
4. **UX**: Loading states, disabled states, and clear UI feedback
5. **Clean transitions**: Only plays on actual status transitions (active → terminal), not on page load

### TypeScript Build Status
- ✅ Application code compiles without errors
- ⚠️ Test files have missing `vitest` types (unrelated to this feature)