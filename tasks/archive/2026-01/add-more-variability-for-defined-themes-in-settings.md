# Add more variability for defined themes in settings

## Problem Statement
Current 6 theme presets (Default, Midnight, Forest, Rose, Coffee, Slate) lack variety. Users want more color options and potentially different contrast/saturation levels.

## Scope
**In:**
- Add 6-10 more theme presets with unique hues/styles
- Cover missing hue ranges (purple, cyan, amber, etc.)
- Consider high-contrast variants

**Out:**
- Custom theme builder/editor
- Modifying existing presets
- Changing theme architecture

## Implementation Plan

### Phase: New Presets
- [x] Add "Ocean" preset (cyan/teal tint, hue ~195)
- [x] Add "Amethyst" preset (purple tint, hue ~280)
- [x] Add "Amber" preset (warm gold tint, hue ~45)
- [x] Add "Cherry" preset (deep red tint, hue ~15)
- [x] Add "Mint" preset (light green tint, hue ~160)
- [x] Add "Graphite" preset (warm neutral gray, hue ~30)

### Phase: Contrast Variants
- [x] Add "High Contrast" preset (increased lightness delta)
- [x] Add "Low Contrast" preset (reduced lightness delta, softer)

## Key Files
- `src/lib/theme-presets.ts` - add new ThemePreset entries

## Success Criteria
- [x] 12-14 total theme presets available in settings (now 14 total)
- [x] New presets visible and selectable in settings UI
- [x] Each new preset has both dark and light mode variants
- [x] No changes needed to settings UI (uses `themePresets.map()`)

## Unresolved Questions
- ~~Which specific hues/names preferred?~~ Implemented: Ocean, Amethyst, Amber, Cherry, Mint, Graphite
- ~~Should high-contrast be separate presets or a modifier toggle?~~ Implemented as separate presets for simplicity

## Implementation Notes
Added 8 new presets to `src/lib/theme-presets.ts`:
1. **Ocean** - Cool cyan/teal (hue 195)
2. **Amethyst** - Rich purple (hue 280)
3. **Amber** - Warm gold (hue 45)
4. **Cherry** - Deep red (hue 15)
5. **Mint** - Fresh light green (hue 160)
6. **Graphite** - Warm neutral gray (hue 30)
7. **High Contrast** - Maximum contrast for accessibility (pure black/white)
8. **Low Contrast** - Softer, reduced contrast for reduced eye strain

Total presets: 14 (6 original + 8 new)
