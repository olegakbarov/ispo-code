# make themes a little more accented in light mode

## Problem Statement
Light mode palettes too neutral; brand hue lost in surfaces.
Increase light mode accents while keeping contrast stable.

## Scope
**In:**
- Light mode preset surface vars in `src/lib/theme-presets.ts`
- Light mode base tokens in `src/styles.css` if needed

**Out:**
- Dark mode palette changes
- Component-level color tweaks

## Implementation Plan

### Phase: Audit
- [x] Review light mode preset values in `src/lib/theme-presets.ts`
- [x] Review light mode base tokens in `src/styles.css`

### Phase: Adjust
- [x] Increase light mode chroma for background/card/secondary/muted/border per preset
- [x] Rebalance muted foregrounds to preserve text contrast

### Phase: Verify
- [x] Spot-check light mode screens for stronger tint without contrast loss

## Key Files
- `src/lib/theme-presets.ts` - light mode palette values
- `src/styles.css` - `.light` base tokens, accent/primary defaults

## Success Criteria
- [x] Light mode presets show higher chroma in surface vars vs current
- [x] Light mode surfaces visibly more tinted than background on at least one screen
- [x] Dark mode palette values unchanged

## Implementation Notes

**Changes made to all 9 university-themed presets in `theme-presets.ts`:**

| Variable | Before (chroma) | After (chroma) |
|----------|-----------------|----------------|
| --background | 0.01-0.02 | 0.03-0.04 |
| --card | 0.015-0.025 | 0.04-0.05 |
| --popover | 0.015-0.025 | 0.04-0.05 |
| --secondary | 0.02-0.03 | 0.05-0.06 |
| --muted | 0.015-0.025 | 0.045-0.055 |
| --border | 0.02-0.028 | 0.045-0.055 |
| --input | 0.015-0.025 | 0.04-0.05 |
| --muted-foreground | 0.02-0.028 | 0.03-0.038 |
| --muted-foreground-subtle | 0.015-0.022 | 0.025-0.03 |
| --muted-foreground-faint | 0.01-0.018 | 0.018-0.022 |

**Themes updated:** Harvard, Yale, Princeton, Columbia, Penn, Brown, Dartmouth, Cornell, Stanford

**Not modified:** High Contrast (zero chroma by design), Low Contrast (achromatic by design), Dark mode values (out of scope)
