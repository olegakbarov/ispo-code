# move github auth to bottom of sidebar

## Problem Statement
Auth controls in sidebar header; request move to bottom. Align layout with bottom actions.

## Scope
**In:** 
- Move GitHub auth UI in sidebar layout
- Update sidebar footer layout for new auth slot
**Out:** 
- Auth logic changes
- New auth features or styling redesign

## Implementation Plan

### Phase: Layout
- [x] Move auth block from header to footer in `src/components/layout/sidebar.tsx`
- [x] Adjust footer structure/classes so auth sits at bottom of sidebar

## Key Files
- `src/components/layout/sidebar.tsx` - move auth UI block, adjust layout

## Success Criteria
- [x] Header shows brand only; no auth controls
- [x] Auth control renders at bottom of sidebar in both states

## Open Questions
- Placement relative to footer links: above or below settings?
  - **Resolved:** Auth placed below Settings, separated by border-t for visual distinction
