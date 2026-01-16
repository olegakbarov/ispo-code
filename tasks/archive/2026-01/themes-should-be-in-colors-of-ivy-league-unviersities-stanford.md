# themes should be in colors of ivy league unviersities + stanford

## Problem Statement
Theme presets not aligned to Ivy League + Stanford colors. Update presets so UI themes reflect those school palettes.

## Scope
**In:**
- Theme preset palette definitions for Ivy League + Stanford
- Theme preset names/descriptions in settings UI
- Default theme id alignment
**Out:**
- Full rework of brand hue picker or accent system
- Non-theme UI color refactors

## Implementation Plan

### Phase: Palette Mapping
- [x] Inventory current theme presets and default theme id
  - Current: 14 presets (default, midnight, forest, rose, coffee, slate, ocean, amethyst, amber, cherry, mint, graphite, high-contrast, low-contrast)
  - Default theme ID: "default"
  - Verified: inventory list is documented in this task file.
- [x] Select official school primary colors (hex)
  - Harvard: #A51C30 (Crimson) → hue ~15
  - Yale: #00356B (Yale Blue) → hue ~250
  - Princeton: #FF8F00 (Orange) → hue ~55
  - Columbia: #1D4F91 (Navy) → hue ~230
  - Penn: #011F5B (Penn Blue) → hue ~240
  - Brown: #4E3629 (Seal Brown) → hue ~30
  - Dartmouth: #00693E (Dartmouth Green) → hue ~155
  - Cornell: #B31B1B (Carnelian) → hue ~25
  - Stanford: #8C1515 (Cardinal Red) → hue ~20
  - Verified: hex palette documented in this task file.
- [x] Convert school colors to oklch tokens for dark/light presets
  - Verified: school presets include oklch tokens for dark/light surfaces in `src/lib/theme-presets.ts:21`.

### Phase: Preset Updates
- [x] Replace/add school-based presets in theme preset registry
  - 9 school presets: harvard, yale, princeton, columbia, penn, brown, dartmouth, cornell, stanford
  - Kept high-contrast and low-contrast for accessibility
  - Verified: preset IDs and accessibility variants defined in `src/lib/theme-presets.ts:21`.
- [x] Update settings theme preset list labels (auto-rendered from themePresets array)
  - Verified: settings UI maps `themePresets` for labels in `src/components/settings/appearance-section.tsx:82`.
- [x] Set default theme id to a school preset (yale)
  - Verified: default theme ID set to Yale in `src/lib/theme-presets.ts:441` and used in `src/lib/stores/settings.ts:55`.

## Key Files
- `src/lib/theme-presets.ts` - add/replace Ivy League + Stanford presets
- `src/components/settings/appearance-section.tsx` - preset labels/ordering display
- `src/lib/stores/settings.ts` - default theme id alignment

## Success Criteria
- [x] Theme preset list includes 9 school themes (8 Ivy League + Stanford)
  - Verified: nine school presets present in `src/lib/theme-presets.ts:21`.
- [x] Each preset uses school-color-derived background/card/secondary tokens
  - Verified: each school preset defines `--background`, `--card`, and `--secondary` for light/dark in `src/lib/theme-presets.ts:27`.
- [x] Settings preset grid renders and selects new themes
  - Verified: preset grid renders via `themePresets.map` with selection handler in `src/components/settings/appearance-section.tsx:82`.

## Resolved Questions
- Primary colors only used (hue tinting surface colors)
- Replaced generic presets; kept high-contrast/low-contrast for accessibility
- Yale set as default theme (classic academic blue)

## Verification Results

### Test Results
FAIL: 8 tests failed (npm run test:run). Failures in `src/lib/tasks/create-task-visibility.test.ts` and `src/lib/agent/manager.test.ts`.

### Item Verification
- Inventory current theme presets and default theme id: Verified (documented in task file).
- Select official school primary colors (hex): Verified (documented in task file).
- Convert school colors to oklch tokens for dark/light presets: Verified in `src/lib/theme-presets.ts:21`.
- Replace/add school-based presets in theme preset registry: Verified in `src/lib/theme-presets.ts:21`.
- Update settings theme preset list labels (auto-rendered from themePresets array): Verified in `src/components/settings/appearance-section.tsx:82`.
- Set default theme id to a school preset (yale): Verified in `src/lib/theme-presets.ts:441` and `src/lib/stores/settings.ts:55`.
- Theme preset list includes 9 school themes (8 Ivy League + Stanford): Verified in `src/lib/theme-presets.ts:21`.
- Each preset uses school-color-derived background/card/secondary tokens: Verified in `src/lib/theme-presets.ts:27`.
- Settings preset grid renders and selects new themes: Verified in `src/components/settings/appearance-section.tsx:82`.