# Redesign Tool Calls UI

## Problem Statement
Current tool call display is functional but generic—left borders + VCR font headers. Lacks visual hierarchy, motion, and memorable character. Needs distinctive aesthetic that communicates tool execution state without sacrificing density.

## Scope
**In:**
- `ToolCall` component complete redesign
- `ToolResult` component complete redesign
- `ToolParamDisplay` enhancement
- Motion/animation on state transitions
- New CSS variables for tool theming

**Out:**
- Tool metadata registry changes
- Backend/tRPC changes
- Syntax highlighting system
- AskUserQuestion display (separate component)

## Design Direction

**Aesthetic**: Industrial-utilitarian meets CRT terminal. Think: aerospace control panel, SCADA interface, brutalist data readout.

**Key Principles:**
- Monochrome base with category color as signal accent
- Scanline/CRT texture on active tools
- Staggered reveal animations for parameters
- Typewriter effect on tool names
- Sharp corners, no border-radius
- Dense information display

## Implementation Plan

### Phase 1: Component Structure
- [x] Create `tool-call-v2.tsx` with new structure
- [x] Add tool execution state: idle → executing → complete
- [x] Implement collapsible sections with CSS-only accordion
- [x] Add tool icon container with glow effect on category color

### Phase 2: Visual Treatment
- [x] Replace left-border with full-width header bar
- [x] Add scanline overlay CSS (repeating-linear-gradient)
- [x] Create CRT flicker animation for "executing" state
- [x] Implement tool name typewriter effect (JS-based interval animation)
- [ ] Add noise texture background via SVG filter (deferred - adds complexity)

### Phase 3: Parameters Display
- [x] Redesign as monospace grid: key | value columns
- [x] Add staggered fade-in for each parameter row
- [x] Implement syntax coloring for values (paths=cyan, commands=amber)
- [x] Add copy-on-hover for individual params

### Phase 4: Result Display
- [x] Create distinct success/error visual states
- [x] Add progress indicator for streaming results
- [x] Implement "data received" pulse animation
- [x] Add byte count / line count metadata display

### Phase 5: Integration & Polish
- [x] Replace old components with v2 versions
- [x] Add CSS custom properties for tool theme
- [x] Implement reduced-motion fallbacks
- [x] Test dark/light mode contrast (CSS supports both)

### Phase 6: Read Tool Density
- [x] Add compact line-height for Read tool file content (~1.2)
- [x] Apply via `.syntax-highlighted-with-lines .shiki code > .line` in CSS
- [x] Also update fallback rendering in `SyntaxHighlightedCode` component

## Key Files
- `src/components/agents/tool-call-v2.tsx` - new component
- `src/components/agents/tool-result-v2.tsx` - new component
- `src/components/agents/tool-param-display-v2.tsx` - new component
- `src/components/agents/tool-call.tsx` - re-exports v2
- `src/components/agents/tool-result.tsx` - re-exports v2
- `src/components/agents/tool-param-display.tsx` - re-exports v2
- `src/components/agents/syntax-highlighted-code.tsx` - line-height for file content
- `src/styles.css` - new tool animations, scanline/CRT effects

## New CSS Additions
```css
/* Scanline overlay */
.tool-scanlines {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    oklch(0 0 0 / 0.03) 2px,
    oklch(0 0 0 / 0.03) 4px
  );
}

/* CRT flicker for active state */
@keyframes crt-flicker {
  0%, 100% { opacity: 1; }
  92% { opacity: 1; }
  93% { opacity: 0.8; }
  94% { opacity: 1; }
}

/* Typewriter cursor blink */
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Data pulse */
@keyframes data-pulse {
  0% { box-shadow: inset 0 0 0 1px var(--tool-color); }
  50% { box-shadow: inset 0 0 8px 1px var(--tool-color); }
  100% { box-shadow: inset 0 0 0 1px var(--tool-color); }
}

/* Parameter value type colors */
.tool-value-path { color: oklch(0.75 0.15 180); }     /* Cyan */
.tool-value-command { color: oklch(0.8 0.15 85); }   /* Amber */
.tool-value-pattern { color: oklch(0.75 0.18 280); } /* Purple */
.tool-value-number { color: oklch(0.75 0.15 140); }  /* Green */
.tool-value-boolean { color: oklch(0.75 0.18 35); }  /* Orange */

/* Compact line height for Read tool file content */
.syntax-highlighted-with-lines .shiki code > .line {
  line-height: 1.2;
}
```

## Success Criteria
- [x] Tool calls visually distinct from regular text output
- [x] Clear state indication: pending/executing/complete
- [x] Category colors used as meaningful accents
- [x] Animations feel industrial/mechanical, not bubbly
- [x] No accessibility regressions (reduced-motion support)
- [x] Works in both dark/light themes
- [x] Read tool results have compact line height (~1.2)

## Resolved Questions
1. **Typewriter vs instant reveal**: Implemented typewriter with 25ms interval - fast enough not to feel slow
2. **Expand/collapse**: Kept expand/collapse for large inputs, shows preview when collapsed
3. **Streaming results**: Buffer then show with pulse animation on new data
4. **Sound effects**: Deferred - not implemented in this iteration

## Implementation Notes
- Created v2 versions of all components to allow gradual rollout
- Original component files now re-export v2 for backwards compatibility
- Gallery page at `/tool-calls` demonstrates all states and variations
- Typewriter effect uses JS interval (not CSS) for better control
- Staggered parameter reveal uses CSS transitions with dynamic delay
- Compact line-height (1.2) applied to both highlighted code and fallback rendering for improved density
