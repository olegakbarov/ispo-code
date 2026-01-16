# add ability to change themes in settings. by changing the css variables

## Problem Statement
No theme preset selection; only light/dark + brand hue. Need settings-driven theme palettes via CSS variable updates and persistence.

## Scope
**In:**
- Theme preset data source + IDs
- Persisted theme selection in settings store
- Apply CSS variable set on load and on change
- Settings UI selector for theme

**Out:**
- Custom theme editor UI
- Server-side storage or syncing
- Replacing light/dark toggle

## Implementation Plan

### Phase: Theme Data
- [x] Add theme preset map in `src/lib/theme-presets.ts`
- [x] Add `themeId` + setter in `src/lib/stores/settings.ts`

### Phase: Apply Variables
- [x] Add `applyThemeVariables` helper in `src/lib/theme-variables.ts`
- [x] Apply theme variables in `src/components/theme.tsx`

### Phase: Settings UI
- [x] Add theme selector UI in `src/routes/settings.tsx`
- [x] Wire selector to `useSettingsStore` themeId setter in `src/routes/settings.tsx`

## Key Files
- `src/routes/settings.tsx` - add theme selector UI + wiring
- `src/lib/stores/settings.ts` - persist themeId
- `src/components/theme.tsx` - apply theme variables on mode change
- `src/lib/theme-presets.ts` - theme variable definitions
- `src/lib/theme-variables.ts` - DOM apply helper

## Success Criteria
- [x] Theme selection changes CSS variables live
- [x] Theme selection persists after reload
- [x] Light/dark toggle still works

## Unresolved Questions
- ~~Which theme presets and variable values~~ Added 6 presets: Default, Midnight, Forest, Rose, Coffee, Slate
- ~~Should theme selection be independent of light/dark or replace it~~ Independent - each preset has both light and dark variants
- ~~Need cookie/inline script for no-flash theme load~~ Theme preset uses localStorage (via Zustand persist), light/dark uses cookie with inline script (existing behavior preserved)

## Implementation Notes
- Created 6 theme presets using OKLCh color space for perceptually uniform colors
- Each theme has tinted backgrounds/surfaces for dark and light modes
- Theme selection works alongside existing light/dark toggle and brand hue slider
- CSS variables applied via inline styles on documentElement
- Zustand persist middleware handles localStorage persistence automatically
