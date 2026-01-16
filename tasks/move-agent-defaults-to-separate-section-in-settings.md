# move agent defaults to separate section in settings

## Problem Statement
Agent defaults buried in General settings; low discoverability.
Need dedicated settings section/page for agent defaults.

## Scope
**In:**
- New settings subpage for agent defaults UI
- Settings nav link for agent defaults
- Remove agent defaults from General settings page

**Out:**
- Agent defaults behavior or persistence changes
- New agent types/models or default logic
- Non-settings UI redesign

## Implementation Plan

### Phase: Nav + Route
- [x] Add Agent Defaults nav link in `src/routes/settings.tsx`
- [x] Add route component in `src/routes/settings/agent-defaults.tsx`

### Phase: Wiring + Cleanup
- [x] Wire `useSettingsStore` + `AgentDefaultsSection` in `src/routes/settings/agent-defaults.tsx`
- [x] Remove agent defaults wiring from `src/routes/settings/index.tsx`

## Key Files
- `src/routes/settings.tsx` - add nav item
- `src/routes/settings/agent-defaults.tsx` - new page
- `src/routes/settings/index.tsx` - remove agent defaults from General
- `src/components/settings/agent-defaults-section.tsx` - reused UI

## Success Criteria
- [x] Settings nav shows Agent Defaults and routes to new page
- [x] General settings page no longer shows Agent Defaults
- [x] Agent defaults save and persist from new page

## Open Questions
- None
