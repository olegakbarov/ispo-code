# write a readme that explains all features this project offers

## Problem Statement
Need README covering full feature set; no unified feature doc now.
Align docs with current routes, agent flows, integrations for clarity.

## Scope
**In:** feature inventory across tasks, agents, stats, worktrees, settings, GitHub, debate
**In:** README sections for overview, features, quickstart, config
**In:** map features to concrete routes and services
**Out:** new product features or refactors
**Out:** deep architecture docs beyond feature descriptions
**Out:** marketing copy or screenshots

## Implementation Plan

### Phase: Feature Inventory
- [x] Review navigation in `src/components/layout/sidebar.tsx`
- [x] Review task workflow in `src/routes/tasks/_page.tsx` and `src/components/tasks/task-editor.tsx`
- [x] Review agent creation and sessions in `src/routes/agents/index.tsx` and `src/routes/agents/$sessionId.tsx`
- [x] Review stats and worktrees in `src/routes/stats.tsx` and `src/routes/worktrees.tsx`
- [x] Review settings and GitHub in `src/routes/settings.tsx` and `src/components/github/repos-list.tsx`
- [x] Review backend capabilities in `src/trpc/agent.ts` and `src/trpc/tasks.ts`

### Phase: README Draft
- [x] Outline sections in `README.md`
- [x] Write feature list grouped by page and capability
- [x] Add quickstart commands from `package.json` and `CLAUDE.md`
- [x] Add config notes for agent CLIs and API keys from `CLAUDE.md` and `src/lib/audio/elevenlabs-client.ts`

## Key Files
- `README.md` - create feature overview and usage
- `src/components/layout/sidebar.tsx` - top-level pages list
- `src/routes/tasks/_page.tsx` - task workflow and modals
- `src/routes/agents/index.tsx` - agent types and models
- `src/routes/stats.tsx` - analytics features
- `src/routes/settings.tsx` - theme/audio/defaults
- `src/routes/worktrees.tsx` - worktree selection

## Success Criteria
- [x] README lists all top-level features with route references
- [x] README includes quickstart commands and required config
- [x] No placeholder text in `README.md`

## Open Questions Resolution
- **Target audience**: Both users and contributors - README structured with quick start for users and architecture section for contributors
- **Features to omit**: All features included; worktree isolation clearly marked as optional/configurable
- **Screenshots**: Kept text-only per original scope; can be added later if needed
