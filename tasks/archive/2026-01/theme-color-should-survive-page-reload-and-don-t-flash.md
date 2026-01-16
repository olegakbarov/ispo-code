# theme color should survive page reload and don't flash

## Problem Statement
Preset theme color reset on reload; flash before preset CSS vars apply; early preset + mode restore.

## Scope
**In:**
- read saved preset from `localStorage` in `src/components/theme.tsx`
- apply preset CSS vars in `src/components/theme.tsx` head script
- prevent default preset apply in `src/components/theme.tsx` before settings hydrate

**Out:**
- new theme presets
- theme UI redesign
- storage changes beyond cookie/localStorage

## Implementation Plan

### Phase: Early Theme Apply
- [x] Parse `localStorage.ispo-code-settings` for `state.themeId` in `src/components/theme.tsx`
- [x] Inline preset map from `src/lib/theme-presets.ts` into `src/components/theme.tsx`
- [x] Apply preset vars + `--brand-hue` in `src/components/theme.tsx` head script
- [x] Use theme cookie/system mode in `src/components/theme.tsx` for dark vs light vars

### Phase: Hydration Alignment
- [x] Track settings hydration in `src/components/theme.tsx` via `useSettingsStore.persist`
- [x] Gate preset apply in `src/components/theme.tsx` until store hydrated
- [x] Reapply preset vars on themeId/theme change in `src/components/theme.tsx`

## Key Files
- `src/components/theme.tsx` - ThemeScript + provider init
- `src/lib/theme-presets.ts` - preset data for inline map
- `src/lib/stores/settings.ts` - storage key + hydration
- `src/routes/__root.tsx` - head script placement

## Success Criteria
- [x] Reload keeps selected preset colors, no flash
- [x] Light/dark/system still respected on reload
- [x] Theme preset change persists across refresh

## Open Questions
- None

## Implementation Notes
The solution uses a two-phase approach:
1. **Inline head script**: `ThemeScript` now generates a JSON preset map at render time and applies CSS variables synchronously before React hydrates
2. **Hydration-aware provider**: `ThemeProvider` tracks Zustand persist hydration via `onFinishHydration()` and skips redundant theme applies during initial load
