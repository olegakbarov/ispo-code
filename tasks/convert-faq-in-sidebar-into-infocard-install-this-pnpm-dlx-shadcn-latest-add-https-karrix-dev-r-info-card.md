# Convert FAQ Link to InfoCard in Sidebar

<!-- taskId: tfHVupJhqU -->

<!-- autoRun: true -->

## Problem Statement
Replace static FAQ link in sidebar footer with interactive InfoCard component from karrix.dev registry. Adds callout-style UI with optional dismiss.

## Scope
**In:**
- Install info-card from karrix.dev registry
- Replace FAQ Link in sidebar with InfoCard
- Show brief FAQ teaser with link to full page

**Out:**
- Changing FAQ page itself (`/docs/faq`)
- Modifying FAQ.md content
- Other sidebar elements

## Implementation Plan

### Phase: Install Component
- [x] ~~Run `pnpm dlx shadcn@latest add 'https://karrix.dev/r/info-card'`~~ (shadcn CLI not configured, manually created component)
- [x] Component created at `src/components/ui/info-card.tsx`
- [x] ~~**TODO**: Run `pnpm add motion`~~ - `framer-motion` already installed; component uses CSS transitions instead

### Phase: Update Sidebar
- [x] Import InfoCard components in `src/components/layout/sidebar.tsx`
- [x] Replace FAQ Link with InfoCard containing:
  - InfoCardTitle: "FAQ" with HelpCircle icon
  - InfoCardDescription: "Common questions answered"
  - InfoCardFooter with Link to `/docs/faq`
  - dismissType="once" for dismissible behavior
- [x] Kept `HelpCircle` import (used in InfoCardTitle)

### Phase: Verify
- [x] TypeScript compiles without new errors
- [x] InfoCard component properly structured
- [x] Link to `/docs/faq` preserved in InfoCardFooter

## Key Files
- `src/components/layout/sidebar.tsx` - replaced FAQ Link with InfoCard
- `src/components/ui/info-card.tsx` - new component (manually created)

## Success Criteria
- [x] InfoCard displays in sidebar footer
- [x] Can navigate to FAQ page from InfoCard
- [x] Component styling consistent with app theme (uses `bg-card`, `border-border`, `text-muted-foreground`)

## Notes
- The project doesn't have `components.json` for shadcn CLI, so component was manually created
- Removed media-related features from original component (not needed for FAQ card)
- Adapted styling to use existing Tailwind theme variables (`bg-card`, `border-border`, etc.)
