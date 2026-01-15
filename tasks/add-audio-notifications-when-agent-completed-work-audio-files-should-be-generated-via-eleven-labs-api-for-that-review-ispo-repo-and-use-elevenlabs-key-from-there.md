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
- [ ] Add `ELEVENLABS_API_KEY` to env schema (`src/env.ts`)
- [ ] Create `src/lib/audio/elevenlabs-client.ts`:
  - `listVoices()` - GET /v1/voices
  - `generateSpeech(voiceId, text)` - POST /v1/text-to-speech/{voiceId}
  - Return audio as base64 data URL

### Phase 2: Server-side tRPC Endpoints
- [ ] Create `src/trpc/audio.ts` router:
  - `audio.listVoices` - returns available voices (name, voiceId, preview_url)
  - `audio.generateSample` - input: voiceId, text; returns base64 audio
  - `audio.generateNotification` - input: type ('completed'|'failed'); uses saved voice
- [ ] Register in `src/trpc/router.ts`
- [ ] Cache generated audio in memory per (voiceId + text) key

### Phase 3: Settings Store Extension
- [ ] Extend `src/lib/stores/settings.ts`:
  - `audioEnabled: boolean` - toggle notifications
  - `selectedVoiceId: string | null` - user's chosen voice
  - `setAudioEnabled(enabled)`, `setSelectedVoiceId(voiceId)`

### Phase 4: Settings UI - Audio Section
- [ ] Add Audio section to `src/routes/settings.tsx` below Brand Color
- [ ] Enable/disable toggle switch
- [ ] Voice dropdown/list fetched from `audio.listVoices`
- [ ] "Generate Sample" button - plays sample via `audio.generateSample`
- [ ] Show loading state during TTS generation
- [ ] Preview buttons for success/failure notifications

### Phase 5: Frontend Audio Hook
- [ ] Create `src/lib/hooks/use-audio-notification.ts`
- [ ] Watch session status transitions to terminal states
- [ ] Use `isTerminalStatus()` from `src/lib/agent/status.ts`
- [ ] Play audio via `<audio>` element
- [ ] Debounce to prevent duplicate plays
- [ ] Respect `audioEnabled` setting

### Phase 6: Integration
- [ ] Add hook to `src/routes/agents/$sessionId.tsx`
- [ ] Trigger on status change to completed/failed

## Key Files
- `src/env.ts` - add ELEVENLABS_API_KEY
- `src/lib/audio/elevenlabs-client.ts` - new, TTS HTTP client
- `src/trpc/audio.ts` - new, voices + TTS endpoints
- `src/trpc/router.ts` - register audio router
- `src/lib/stores/settings.ts` - add audio prefs (enabled, voiceId)
- `src/routes/settings.tsx` - add Audio section with voice picker
- `src/lib/hooks/use-audio-notification.ts` - new, frontend hook
- `src/routes/agents/$sessionId.tsx` - integrate notification hook

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
- [ ] Audio plays when agent transitions to `completed`/`failed`
- [ ] Settings shows voice picker with all available voices
- [ ] User can generate and hear sample before saving
- [ ] Selected voice persists across sessions
- [ ] Toggle to enable/disable notifications works
- [ ] No audio spam on page refresh (debounced)
