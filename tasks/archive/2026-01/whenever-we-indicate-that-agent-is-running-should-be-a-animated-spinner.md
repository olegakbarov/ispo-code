# Animated Spinner for Running Agent Indicators

## Problem Statement
Running agent indicators use inconsistent animations: some use `animate-pulse` (fade), some use static emojis (`▶`, `⚙`), some have proper `animate-spin`. Need unified spinning animation for all "running" states.

## Scope
**In:**
- Replace pulse/static icons with spinners for running/working states
- `StatusDot` component
- `task-sessions.tsx` status icons
- Any other running indicators

**Out:**
- Progress banners (already have spinners)
- Non-running states (completed, failed, etc.)
- Debate modal pulsing dot (different UX purpose)

## Implementation Plan

### Phase 1: Create Reusable Spinner Component
- [x] Add `Spinner` component to `src/components/ui/spinner.tsx`
  - ✓ Verified: Component exists at `src/components/ui/spinner.tsx:21-31`
- [x] Support sizes: `xs` (1.5), `sm` (3), `md` (4)
  - ✓ Verified: `sizeClasses` at lines 10-14 defines xs=w-1.5, sm=w-3, md=w-4
- [x] Use existing pattern: `border-2 border-current border-t-transparent rounded-full animate-spin`
  - ✓ Verified: Pattern used at line 25 (xs uses `border` for thinner stroke)

### Phase 2: Update StatusDot
- [x] Import `Spinner` in `session-primitives.tsx`
  - ✓ Verified: Import at `session-primitives.tsx:8`
- [x] Replace pulsing dot with spinner for `running`/`working` states
  - ✓ Verified: `statusDotConfig` at lines 111, 118 sets `spin: true` for these states; conditional render at lines 127-131
- [x] Keep pulse for `waiting_approval` (different semantic)
  - ✓ Verified: `waiting_approval` at line 112 has `pulse: true`, not `spin`

### Phase 3: Update Task Sessions
- [x] Replace `▶`/`⚙` emoji with `Spinner` for `running`/`working` in `task-sessions.tsx`
  - ✓ Verified: `STATUS_ICONS` at lines 47-48 sets `null` for running/working; `SPINNER_STATUSES` array at line 58; conditional render at lines 107-113
- [x] Keep other status emojis unchanged
  - ✓ Verified: Other statuses (pending, waiting_approval, idle, completed, failed, cancelled) retain their emojis at lines 46-54

### Phase 4: Update Status Constants
- [x] Update `statusColors` in `status.ts` to remove `animate-pulse` from running/working
  - ✓ Verified: `status.ts:59,64` - running/working use `text-accent` (no animate-pulse); only `waiting_approval` at line 60 retains `animate-pulse`
- [x] Add new constant for spinner-based statuses (`SPINNER_STATUSES`, `isSpinnerStatus()`)
  - ✓ Verified: `SPINNER_STATUSES` at line 45, `isSpinnerStatus()` at lines 50-52

## Key Files
- `src/components/ui/spinner.tsx` - new component
- `src/components/agents/session-primitives.tsx` - StatusDot update
- `src/components/tasks/task-sessions.tsx` - session card icons
- `src/lib/agent/status.ts` - status config update

## Success Criteria
- [x] Running/working states show animated spinner (not pulse)
  - ✓ Verified: Both `StatusDot` and `TaskSessions` render `<Spinner>` for running/working statuses
- [x] Spinner consistent across all agent status displays
  - ✓ Verified: Both components use the same `Spinner` component with `animate-spin`
- [x] No visual regression in other states
  - ✓ Verified: Non-spinner statuses (pending, waiting_approval, idle, completed, failed, cancelled) retain original dot/emoji rendering

## Verification Results

**Summary**: ✅ All 13 checklist items verified as complete.

| Phase | Items | Status |
|-------|-------|--------|
| Phase 1: Spinner Component | 3/3 | ✅ Complete |
| Phase 2: StatusDot | 3/3 | ✅ Complete |
| Phase 3: Task Sessions | 2/2 | ✅ Complete |
| Phase 4: Status Constants | 2/2 | ✅ Complete |
| Success Criteria | 3/3 | ✅ Complete |

**Notes:**
- Implementation follows clean separation: central `Spinner` component used by multiple consumers
- Color inheritance works correctly via `border-current` + `text-*` classes
- `waiting_approval` correctly excluded from spinner treatment (retains pulse per scope)
- Debate modal's pulsing dot correctly excluded per scope