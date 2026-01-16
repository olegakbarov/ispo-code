# add debounce for multiple audio notifications

## Problem
When multiple agent sessions complete in rapid succession (e.g., within seconds of each other), each triggers a separate `playNotification()` call. This can result in overlapping audio notifications that are confusing and annoying.

## Solution
Add debounce logic to `useGlobalAudioNotifications` so that if multiple sessions complete within a short time window, only one notification plays (with a count of how many completed).

## Plan

- [x] Define scope
  - Verified: Scope described in Problem/Solution sections in `tasks/add-debounce-for-multiple-audio-notifications.md:3` and `tasks/add-debounce-for-multiple-audio-notifications.md:6`.
- [x] Implement debounce in `useGlobalAudioNotifications`
  - Verified: Debounce queue/timer and flush logic present in `src/lib/hooks/use-global-audio-notifications.ts:54` and `src/lib/hooks/use-global-audio-notifications.ts:100`.
  - Updated: Notification audio includes completion/failure counts when batching; see `src/lib/hooks/use-global-audio-notifications.ts:90` and `src/trpc/audio.ts:90`.
- [x] Validate (build passes)
  - Verified: `npm run build` succeeded; warnings about missing Route export and chunk size limit were reported.

## Verification Results
- Resolved: Batched notifications now include a count in the generated audio message.
- Build: `npm run build` passed with warnings about route exports and chunk sizes.
- Tests: Not run (no test step listed in the plan).
