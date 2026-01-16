# specify what task has been completed - planning, implementation or verfifcation

## Problem Statement
Audio notifications only say task completed/failed; phase missing. Can't tell planning vs implementation vs verification without opening UI.

## Scope
**In:**
- phase inference from session title (Plan/Debug/Run/Verify)
- pass phase to audio notification generator (global + task page)
- notification text includes phase + task snippet for single-task events
- preview sample uses phase context

**Out:**
- change session type grouping beyond notifications
- new UI badges or progress banners
- new behavior for multi-task batch summaries

## Implementation Plan

### Phase: Phase Context
- [x] Add helper to map session title to phase label
- [x] Capture session title/phase in audio snapshot logic
- [x] Wire phase into global notification queue payload

### Phase: Notification Text
- [x] Extend audio generateNotification input to accept phase
- [x] Format audio text to include phase when count <= 1
- [x] Update settings preview to pass sample phase
- [x] Add tests for phase mapping and notification text

## Key Files
- `src/lib/utils/session-phase.ts` - infer phase label from session title
- `src/lib/hooks/use-agent-session-tracking.ts` - include phase in audio snapshot
- `src/lib/hooks/use-audio-notification.ts` - pass phase to audio API
- `src/lib/hooks/use-global-audio-notifications.ts` - queue phase with task title
- `src/trpc/audio.ts` - accept phase and build notification text
- `src/routes/settings/index.tsx` - preview uses phase sample

## Success Criteria
- [x] Single completed session audio says "Planning/Implementation/Verification completed" + snippet
- [x] No phase available falls back to current generic text
- [x] Existing batch notifications still play

## Resolved Questions
- **Include phase for failed notifications?** Yes, phase is included for both completed and failed notifications.
- **How to label Review/Rewrite/Orchestrator sessions?** Review sessions use "Review" phase. Rewrite/Orchestrator without recognized prefix fall back to generic "Task completed/failed".
- **If batch is same phase, include phase or keep generic?** Keep generic for batches (count > 1).
