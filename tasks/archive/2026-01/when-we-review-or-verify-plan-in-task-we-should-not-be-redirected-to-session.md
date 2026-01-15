# when we review or verify plan in task we should not be redirected to session

## Problem Statement
Review/Verify buttons redirect user to agent session page (line 567 in tasks.tsx). User loses task context. Should stay on task page, show agent progress inline.

## Scope
**In:**
- Remove navigation after review/verify start
- Keep user on task page
- Existing agent progress banner already shows status

**Out:**
- Creating task with agent (needs redirect - watch planning)
- Rewriting task (needs redirect - watch rewriting)
- Running task with agent (stays on page - already correct)

## Implementation Plan

### Phase: Remove redirect
- [x] Delete `navigate()` call in `handleStartReview` (tasks.tsx:567)
- [x] Remove optimistic cache setting (lines 553-564) - not needed if not navigating
- [x] Test review flow - agent progress banner should show status
- [x] Test verify flow - agent progress banner should show status

## Key Files
- `src/routes/tasks.tsx:531-573` - `handleStartReview` function, remove navigation

## Success Criteria
- [x] Review button starts agent session, stays on task page
- [x] Verify button starts agent session, stays on task page
- [x] Agent progress banner displays review/verify status
- [x] No redirect to /agents/$sessionId

## Implementation Notes
- Removed `navigate()` call and optimistic cache setting from `handleStartReview`
- Added comment explaining that agent progress banner will automatically show status
- Simplified function dependencies (removed `navigate`, `utils`, `selectedSummary`, `workingDir`)
- Agent progress banner (`AgentProgressBanner` component) automatically displays when `agentSession` is set
- Existing polling mechanism (lines 52-55) detects new agent sessions and updates UI

## Unresolved Questions
None - implementation is straightforward removal of navigation.
