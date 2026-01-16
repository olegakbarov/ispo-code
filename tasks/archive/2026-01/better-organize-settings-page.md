# better organize settings page

## Problem Statement
Monolithic settings page; theme/audio/agents/account mixed. Hard scan, hard extend. Need grouped sections + reusable layout.

## Scope
**In:**
- Group controls in `src/routes/settings/index.tsx` into Appearance/Notifications/Agents/Account
- Extract sections into `src/components/settings/*`
- Standardize section headers + spacing in `src/routes/settings/index.tsx`
**Out:**
- New settings features
- Visual redesign beyond organization
- Changes to `src/lib/stores/settings.ts`

## Implementation Plan

### Phase: Structure
- [x] Audit controls in `src/routes/settings/index.tsx` for grouping
- [x] Add `src/components/settings/section.tsx`
- [x] Add `src/components/settings/appearance-section.tsx`
- [x] Add `src/components/settings/audio-section.tsx`
- [x] Add `src/components/settings/agent-defaults-section.tsx`
- [x] Add `src/components/settings/account-section.tsx`

### Phase: Wiring
- [x] Move theme/preset/brand UI from `src/routes/settings/index.tsx` to `src/components/settings/appearance-section.tsx`
- [x] Move audio UI from `src/routes/settings/index.tsx` to `src/components/settings/audio-section.tsx`
- [x] Move agent defaults UI from `src/routes/settings/index.tsx` to `src/components/settings/agent-defaults-section.tsx`
- [x] Move account UI from `src/routes/settings/index.tsx` to `src/components/settings/account-section.tsx`
- [x] Recompose `src/routes/settings/index.tsx` with section components

### Phase: Cleanup
- [x] Remove unused helpers/imports in `src/routes/settings/index.tsx`
- [x] Align container spacing in `src/routes/settings/index.tsx`

## Key Files
- `src/routes/settings/index.tsx` - compose sections, container layout
- `src/components/settings/section.tsx` - section wrapper
- `src/components/settings/appearance-section.tsx` - theme + brand controls
- `src/components/settings/audio-section.tsx` - audio notifications
- `src/components/settings/agent-defaults-section.tsx` - agent defaults
- `src/components/settings/account-section.tsx` - account controls

## Success Criteria
- [x] Settings page grouped under Appearance/Notifications/Agents/Account headings
- [x] All existing controls render and function
- [x] `src/routes/settings/index.tsx` only composes sections

## Open Questions
- None
