# based on docs/faq create a documentation page and place a link in sidebar

## Problem Statement
FAQ page not scrollable due to missing overflow styles on container. Root layout uses `overflow-hidden` on main; child routes must handle own scrolling.

## Scope
**In:**
- Fix FAQ page scroll by adding `h-full overflow-y-auto` to container
**Out:**
- FAQ content edits
- Layout system changes

## Implementation Plan

### Phase: Fix Scroll
- [x] Update `src/routes/docs/faq.tsx` container: add `h-full overflow-y-auto` classes

## Key Files
- `src/routes/docs/faq.tsx` - fix container scroll styles

## Success Criteria
- [x] /docs/faq scrolls when content exceeds viewport

## Notes
- Added `h-full overflow-y-auto` to the container div in `FAQPage` component
- This allows the FAQ content to scroll independently when it exceeds the viewport height
