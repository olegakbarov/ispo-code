# make dark mode less dark 10% ish

## Problem Statement
Dark mode baseline too dark; target ~10% lighter. Lift dark tokens for background/surfaces; keep hue. Avoid light-mode shifts.

## Scope
**In:**
- Dark token tweaks in `src/styles.css`
- Dark preset values in `src/lib/theme-presets.ts`
- Dark scrollbar colors in `src/styles.css`
**Out:**
- Light mode variables
- New themes or preset IDs
- Component-level color overrides

## Implementation Plan

### Phase: Audit
- [x] Identify dark token sources in `src/styles.css`
- [x] List dark values in `themePresets[].dark`

### Phase: Adjust
- [x] Raise dark L values ~10% in `src/styles.css`
- [x] Raise dark L values ~10% in `src/lib/theme-presets.ts`

### Phase: Verify
- [x] Toggle dark/light and scan core screens
- [x] Switch presets and confirm dark values applied

## Key Files
- `src/styles.css` - dark defaults, scrollbar colors
- `src/lib/theme-presets.ts` - dark preset token values

## Success Criteria
- [x] Dark `--background`/`--card`/`--secondary`/`--muted` L raised ~10%
- [x] Preset dark tokens adjusted consistently across all presets
- [x] Light mode tokens unchanged

## Open Questions
- None

## Implementation Notes

### Changes Made (styles.css)
Default dark theme `:root`:
- `--background`: 0 → 0.1
- `--card`/`--popover`: 0.08 → 0.18
- `--secondary`/`--muted`/`--border`: 0.18 → 0.28
- `--input`: 0.12 → 0.22

Scrollbars (dark):
- track: 0.05 → 0.15
- thumb: 0.25 → 0.35
- thumb:hover: 0.35 → 0.45

Tool containers (dark):
- `.tool-call-v2`: 0.06 → 0.16
- `.tool-result-v2`: 0.04 → 0.14

### Changes Made (theme-presets.ts)
All 11 presets updated consistently (+0.10 to dark surface L values):
- Harvard, Yale, Princeton, Columbia, Penn, Brown, Dartmouth, Cornell, Stanford
- High Contrast, Low Contrast

Light mode values remain unchanged.
