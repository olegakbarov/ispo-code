# create a page with all tool call components to improve their design

## Problem Statement
Sandbox page for all tool-call UI states. Faster design iteration, regression spotting.

## Scope
**In:**
- New route page for tool-call component gallery
- Sample data for tool_use, tool_result, AskUserQuestion variants
- Sidebar link to reach page

**Out:**
- Tool execution behavior changes
- Non-tool-call UI redesign

## Implementation Plan

### Phase: Route + Navigation
- [x] Add `src/routes/tool-calls.tsx`
- [x] Add nav link in `src/components/layout/sidebar.tsx`

### Phase: Fixtures + Rendering
- [x] Define sample tool payloads in `src/routes/tool-calls.tsx`
- [x] Render ToolCall, ToolParamDisplay, ToolResult, AskUserQuestionDisplay variants

## Key Files
- `src/routes/tool-calls.tsx` - new gallery route
- `src/components/layout/sidebar.tsx` - nav link for gallery

## Success Criteria
- [x] `/tool-calls` renders all tool-call components with varied states
- [x] Page reachable from sidebar

## Unresolved Questions
- None
