# custom themes should only change accents of base dark/light theme

<!-- autoRun: true -->

## Summary

Custom theme presets currently override **all** CSS variables (background, card, muted, border, etc.) with colored tints. This causes inconsistent UI where different themes have slightly different neutral colors.

The fix: themes should **only set `--brand-hue`** and let the base dark/light theme in `styles.css` handle all neutral colors. The accent colors (`--primary`, `--accent`, `--ring`, etc.) already use `var(--brand-hue)` dynamically.

## Current Architecture

- `styles.css` defines base dark (`:root`) and light (`.light`) themes with **neutral colors** (gray-scale using `oklch(L 0 0)`)
- Accent colors use `var(--brand-hue)`: `--primary: oklch(0.65 0.2 var(--brand-hue))`
- `theme-presets.ts` defines presets with `brandHue` + full `dark`/`light` variable overrides
- `theme-variables.ts` applies all preset variables + `--brand-hue` to DOM

## Implementation Plan

- [x] Update task file with implementation plan
- [x] Simplify `ThemePreset` interface - make `dark`/`light` optional
- [x] Remove color variables from all university preset definitions
- [x] Update `applyThemeVariables()` - only set `--brand-hue`, clear overrides first
- [x] Update `clearThemeVariables()` - clear both `--brand-hue` and any overrides
- [x] Update appearance section preview to show single accent color swatch

## Files to Modify

1. `src/lib/theme-presets.ts` - Simplify preset definitions
2. `src/lib/theme-variables.ts` - Simplify variable application
3. `src/components/settings/appearance-section.tsx` - Update preview swatches

## Notes

- High-contrast/low-contrast themes **do** need to override neutrals, so they should be treated differently
- University themes only need `brandHue` since their visual identity comes from accent colors
