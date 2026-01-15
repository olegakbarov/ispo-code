# Multi-Model Spec Review should not be opened in modal. it should be in the UI and survive refresh

## Problem Statement
Debate navigation broken—closing panel discards debate. Need separate "back" vs "discard" actions so users can navigate on/off debate tab without losing state.

## Scope
**In:**
- Separate navigation (back to edit) from destruction (discard debate)
- Add "Back" button that preserves debate
- Keep "Discard" as explicit destructive action

**Out:**
- Multi-debate per task
- Debate history/audit log
- Export/share debate results

## Implementation Plan

### Phase 1: Fix Navigation vs Discard (NEW)
- [x] Add `onBack` prop to DebatePanel - navigates without discarding
- [x] Header "x" button → calls `onBack` (preserve state, just navigate)
- [x] Add "← Back" text button in footer left side
- [x] Rename "Cancel" → "Discard" in config step, keep destructive behavior
- [x] Both Discard buttons call `onClose` (which discards via mutation)

### Phase 2: UX Polish (NEW)
- [x] Show "Active debate" badge on task when debate exists but not in debate mode
- [x] Sidebar Review button shows "Resume Review" when task has active debate

## Already Completed (Verified)

### Server-Side Persistence ✓
- `src/lib/debate/storage.ts` - file-backed storage
- `.agentz/debates/{taskSlug}.json` storage path
- `debate.getForTask` tRPC query
- `debate.start` creates/resumes
- Auto-cleanup on accept/discard

### URL State Integration ✓
- Mode in URL path segment (`/tasks/path/debate`)
- Debate loaded on mount
- Survives refresh

### Inline Panel ✓
- `src/components/debate/debate-panel.tsx` - config/running/complete views
- Replaces editor in debate mode
- Panel navigates via URL

## Key Files
- `src/components/debate/debate-panel.tsx` - add `onBack`, separate from `onClose`
- `src/routes/tasks/_page.tsx` - pass both handlers, debate exists badge
- `src/components/tasks/task-sidebar.tsx` - "Resume Review" label (not task-review-panel.tsx)

## Success Criteria
- [x] Navigate away from debate → debate preserved on return
- [x] "Back" button returns to edit without deleting
- [x] "Discard" explicitly deletes debate
- [x] Clear visual distinction between navigation and destruction
