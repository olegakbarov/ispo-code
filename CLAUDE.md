# Agentz

A full-stack multi-agent control panel for spawning and managing AI coding agents (Claude CLI, Codex CLI, OpenCode, Cerebras GLM). Features real-time session monitoring, AI-powered task planning, and integrated git workflows.

## Codebase Overview

**Stack**: React 19 + TanStack Router/Start + tRPC + Tailwind CSS + Vite

**Structure**:
- `src/lib/agent/` - Core agent system (AgentManager, agent implementations, tools)
- `src/trpc/` - Type-safe API layer (agent, git, tasks, system routers)
- `src/components/` - React components (agents, git, ui primitives)
- `src/routes/` - File-based routing (/, /agents/$sessionId, /git, /tasks)

**Key Files**:
- `src/lib/agent/manager.ts` - Agent orchestration singleton
- `src/lib/agent/tools.ts` - Tool framework (read, write, edit, bash, glob, grep)
- `src/routes/__root.tsx` - Root layout with sidebar navigation

For detailed architecture, module guides, and navigation instructions, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Quick Commands

```bash
# Development
npm run dev          # Start dev server on port 4200

# Build
npm run build        # Production build
npm run start        # Preview production build
```

## Agent Types

| Agent | SDK/CLI | Context | Requires |
|-------|---------|---------|----------|
| Cerebras | SDK | 8K-131K | CEREBRAS_API_KEY |
| OpenCode | Embedded | Varies | SDK installed |
| Claude | CLI | 200K | claude CLI installed |
| Codex | CLI | 128K | codex CLI installed |
