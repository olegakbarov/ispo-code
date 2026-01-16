# audio notification should specify which task has been completed/failed: say first 5 words of task title

## Problem Statement
Generic audio notifications; no task identity.
Need spoken task context on completion/failure.
Use first 5 words of task title for brevity.

## Scope
**In:**
- Status + 5-word task title in notification text
- Client passes task title into notification request
- Preview plays with sample title

**Out:**
- Change when notifications fire
- Localization or new voices
- Non-task session audio

## Implementation Plan

### Phase: Server Text
- [x] Add first-5-words helper in `src/lib/utils/task-title.ts`
- [x] Extend `generateNotification` input with `taskTitle` in `src/trpc/audio.ts`
- [x] Build notification text using status + snippet in `src/trpc/audio.ts`

### Phase: Client Wiring
- [x] Build taskPath to title map in `src/lib/hooks/use-global-audio-notifications.ts`
- [x] Pass `taskTitle` to `generateNotification` in `src/lib/hooks/use-global-audio-notifications.ts`
- [x] Add `taskTitle` param in `src/lib/hooks/use-agent-session-tracking.ts`
- [x] Pass selected task title in `src/routes/tasks/_page.tsx`
- [x] Use `taskTitle` in `src/lib/hooks/use-audio-notification.ts`
- [x] Update preview payload in `src/routes/settings/index.tsx`

### Phase: Validation
- [x] Add unit test for title snippet helper in `src/lib/utils/task-title.test.ts`

## Key Files
- `src/trpc/audio.ts` - accept taskTitle, build text
- `src/lib/hooks/use-global-audio-notifications.ts` - resolve title, pass to TTS
- `src/lib/hooks/use-agent-session-tracking.ts` - accept taskTitle for audio hook
- `src/lib/hooks/use-audio-notification.ts` - include taskTitle in request
- `src/routes/tasks/_page.tsx` - pass selected task title
- `src/routes/settings/index.tsx` - preview payload
- `src/lib/utils/task-title.ts` - word-slice helper
- `src/lib/utils/task-title.test.ts` - unit test

## Success Criteria
- [x] Completion audio says status + first 5 words of task title
- [x] Failure audio says status + first 5 words of task title
- [x] Preview still plays with sample title

## Open Questions
- Use parent task title or subtask title for `taskPath#subtaskId`?
- Fallback text when title missing or unreadable?
