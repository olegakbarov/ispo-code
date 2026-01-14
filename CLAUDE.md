# Agentz

A full-stack multi-agent control panel for spawning and managing AI coding agents (Claude CLI, Codex CLI, OpenCode, Cerebras GLM). Features real-time session monitoring, AI-powered task planning, and integrated git workflows.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

- do not spawn processes on port 4200, use other ports for your 'tests'

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

## Quick Commands

```bash
# Development
npm run dev          # Start dev server on port 4200

# Build
npm run build        # Production build
npm run start        # Preview production build
```

## Agent Types

| Agent    | SDK/CLI  | Context | Requires             |
| -------- | -------- | ------- | -------------------- |
| Cerebras | SDK      | 8K-131K | CEREBRAS_API_KEY     |
| OpenCode | Embedded | Varies  | SDK installed        |
| Claude   | CLI      | 200K    | claude CLI installed |
| Codex    | CLI      | 128K    | codex CLI installed  |
