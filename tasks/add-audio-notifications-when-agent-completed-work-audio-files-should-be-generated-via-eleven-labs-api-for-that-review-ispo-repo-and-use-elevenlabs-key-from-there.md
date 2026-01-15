# Add Audio Notifications on Agent Completion

## Problem Statement
No audio feedback when agents finish work. Users miss completion events when multitasking. Generate notification sounds via ElevenLabs TTS API (key from ispo repo).

## Scope
**In:**
- Audio notification on session completion/failure
- ElevenLabs TTS integration for generating spoken notifications
- User preference toggle (enable/disable)
- Distinct sounds for success vs failure

**Out:**
- Custom voice selection UI
- Notification customization settings
- Background/minimized tab notifications (browser limitation)
- Pre-generated static audio files

## Implementation Plan

### Phase 1: Environment & Client Setup
- [ ] Add `ELEVENLABS_API_KEY` to env schema (`src/env.ts`)
- [ ] Create `src/lib/audio/elevenlabs-client.ts` - minimal TTS client
- [ ] Single endpoint: `POST /v1/text-to-speech/{voiceId}` with `xi-api-key` header
- [ ] Return audio as base64 data URL

### Phase 2: Server-side TTS Endpoint
- [ ] Add tRPC endpoint `audio.generateNotification` in `src/trpc/audio.ts`
- [ ] Input: `type: 'completed' | 'failed'`
- [ ] Hardcoded messages: "Task completed" / "Task failed"
- [ ] Cache generated audio in memory (same message = same audio)

### Phase 3: Frontend Audio Hook
- [ ] Create `src/lib/hooks/use-audio-notification.ts`
- [ ] Watch session status transitions to terminal states
- [ ] Use `isTerminalStatus()` from `src/lib/agent/status.ts`
- [ ] Play audio via Web Audio API / `<audio>` element
- [ ] Debounce to prevent duplicate plays

### Phase 4: Integration & Preferences
- [ ] Add hook to `src/routes/agents/$sessionId.tsx` - trigger on status change
- [ ] Store user preference in localStorage: `agentz:audio-notifications`
- [ ] Add toggle in settings/sidebar (optional, can defer)

## Key Files
- `src/env.ts` - add ELEVENLABS_API_KEY
- `src/lib/audio/elevenlabs-client.ts` - new, TTS HTTP client
- `src/trpc/audio.ts` - new, notification generation endpoint
- `src/trpc/router.ts` - register audio router
- `src/lib/hooks/use-audio-notification.ts` - new, frontend hook
- `src/routes/agents/$sessionId.tsx` - integrate notification hook
- `src/lib/agent/status.ts` - use `isTerminalStatus()` helper

## Reference: ISPO ElevenLabs Pattern
```typescript
// Minimal client needed:
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: {
    'xi-api-key': env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: "Task completed",
    model_id: "eleven_multilingual_v2",
    voice_settings: { stability: 0.7, similarity_boost: 0.7 }
  })
})
// Returns: ArrayBuffer → convert to base64 data URL
```

## Success Criteria
- [ ] Audio plays when agent transitions to `completed`/`failed`
- [ ] No audio spam on page refresh (debounced)
- [ ] Works when ELEVENLABS_API_KEY missing (silent fail)
- [ ] User can disable via localStorage toggle
