# remove brand color select and make it default to the selected theme

## Problem Statement
Brand color user-selectable in settings; remove control. Accent hue should follow selected theme preset. Avoid mismatch between preset and primary color.

## Scope
**In:**
- Remove brand color UI + handlers in `src/components/settings/appearance-section.tsx`
- Remove brand hue state/helpers in `src/lib/stores/settings.ts`
- Apply theme-provided brand hue in `src/lib/theme-variables.ts`
- Add per-theme brand hue values in `src/lib/theme-presets.ts`
- Align default `--brand-hue` fallback in `src/styles.css`
- Remove brand hue effect in `src/routes/__root.tsx`

**Out:**
- Custom brand color editor
- Theme preset redesign beyond brand hue mapping
- Light/dark toggle behavior changes

## Implementation Plan

### Phase: Theme Defaults
- [x] Add `brandHue` field to `ThemePreset` in `src/lib/theme-presets.ts`
- [x] Populate `brandHue` for each preset in `src/lib/theme-presets.ts`
- [x] Set `--brand-hue` from preset in `src/lib/theme-variables.ts`
- [x] Update default `--brand-hue` value in `src/styles.css`

### Phase: Settings Cleanup
- [x] Remove brand hue state and setters from `src/lib/stores/settings.ts`
- [x] Remove brand hue application effect in `src/routes/__root.tsx`
- [x] Delete brand color section and handlers in `src/components/settings/appearance-section.tsx`

## Key Files
- `src/components/settings/appearance-section.tsx` - remove brand color UI
- `src/lib/stores/settings.ts` - remove brand hue state
- `src/lib/theme-presets.ts` - add brand hue per preset
- `src/lib/theme-variables.ts` - apply `--brand-hue` from preset
- `src/styles.css` - default brand hue fallback
- `src/routes/__root.tsx` - drop brand hue effect

## Success Criteria
- [x] Settings page has no brand color controls
- [x] Primary/accent colors change with theme preset selection
- [x] Default theme loads with matching brand hue
