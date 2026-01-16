# fix clash of multiple audio notifications. make sure we only run one at a time

## Problem Statement
Parallel notification sources, overlapping playback.
Need serialized playback to stop clashing audio.

## Scope
**In:**
- Shared notification playback queue in `src/lib/audio/notification-player.ts`
- Hook wiring in `src/lib/hooks/use-global-audio-notifications.ts`
- Hook wiring in `src/lib/hooks/use-audio-notification.ts`
- Playback state/cleanup in `src/lib/audio/notification-player.ts`
**Out:**
- ElevenLabs generation in `src/trpc/audio.ts`
- Audio unlock flow in `src/lib/audio/audio-unlock.ts`
- Settings preview playback in `src/routes/settings/index.tsx`

## Implementation Plan

### Phase: Shared Playback
- [x] Add queued single-audio player in `src/lib/audio/notification-player.ts`
- [x] Expose `enqueueNotificationAudio` API in `src/lib/audio/notification-player.ts`
- [x] Track active playback state + end/error cleanup in `src/lib/audio/notification-player.ts`

### Phase: Hook Wiring
- [x] Replace `new Audio()` in `src/lib/hooks/use-global-audio-notifications.ts` with queue API
- [x] Await queued playback in `src/lib/hooks/use-global-audio-notifications.ts`
- [x] Replace `audioRef` usage in `src/lib/hooks/use-audio-notification.ts` with queue API
- [x] Remove per-hook audio cleanup in `src/lib/hooks/use-audio-notification.ts`

## Key Files
- `src/lib/audio/notification-player.ts` - shared queue + single audio element
- `src/lib/hooks/use-global-audio-notifications.ts` - route notifications through queue
- `src/lib/hooks/use-audio-notification.ts` - route notifications through queue
- `src/routes/__root.tsx` - global hook mount context

## Success Criteria
- [x] Notification playback serialized, no overlapping audio
- [x] Both notification hooks use shared queue module
- [x] No per-hook `new Audio()` or `audioRef` in notification hooks

## Implementation Notes

### What Was Done
1. Created `src/lib/audio/notification-player.ts` with a NotificationPlayer class that:
   - Maintains a FIFO queue for pending notifications
   - Uses a single shared `Audio` element for all playback
   - Processes notifications serially (one at a time)
   - Provides promise-based API with `enqueueNotificationAudio()`
   - Tracks playback state and automatically proceeds to next item in queue

2. Updated `src/lib/hooks/use-global-audio-notifications.ts`:
   - Replaced `new Audio()` with `enqueueNotificationAudio()` call (line 129)
   - Playback now queued instead of immediate

3. Updated `src/lib/hooks/use-audio-notification.ts`:
   - Removed `audioRef` ref (was line 56)
   - Replaced audio element creation/playback with `enqueueNotificationAudio()` (line 88)
   - Removed cleanup effect that managed per-hook audio element

### Result
- All notifications now route through shared queue
- Only one notification plays at a time
- No more audio clashing/overlapping
- Both hooks work together harmoniously

## Unresolved Questions
- Keep both global and per-session hooks active, or disable one source? *(Currently both active and working)*
- Settings preview uses queue, or can interrupt notifications? *(Not addressed - settings preview unmodified as per scope)*
