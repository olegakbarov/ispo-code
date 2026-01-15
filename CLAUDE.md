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

## Worktree Isolation

Each agent session runs in an isolated git worktree on a unique branch (`agentz/session-{id}`). This prevents:
- Concurrent agents conflicting on same files
- Mixed commits across sessions
- Cross-session contamination

**Enabled by default.** To disable: `export DISABLE_WORKTREE_ISOLATION=true`

### Architecture

**Session Lifecycle**:
1. **Spawn**: Creates `.agentz/worktrees/{sessionId}` on new branch
2. **Execution**: All agent file operations scoped to worktree
3. **Cleanup**: Deletes worktree and branch on session deletion

**Path Isolation**:
- All tools (read/write/edit) constrained to worktree via `validatePath()`
- Shell commands (`exec_command`) execute in worktree `cwd`
- Git operations automatically scoped to worktree context

**UI Integration**:
- Sidebar shows "WT" badge when session uses worktree
- Git status displays worktree branch name
- Commit operations scoped to session files

**Session-specific git operations** (via tRPC):
- Server automatically resolves `X-Session-Id` header to worktree path
- Git status, diffs, commits scoped to session worktree

### Implementation

**Key Files**:
- `src/lib/agent/git-worktree.ts` - Worktree lifecycle management
- `src/lib/agent/manager.ts` - Integrates worktree creation/cleanup
- `src/lib/agent/path-validator.ts` - Enforces worktree boundaries
- `src/routes/api/trpc/$.ts` - Resolves sessionId to worktree path

**Session Model**:
```ts
interface AgentSession {
  worktreePath?: string       // .agentz/worktrees/{sessionId}
  worktreeBranch?: string     // agentz/session-{sessionId}
  // ...
}
```

### Considerations

- **Disk Space**: Each worktree is full working copy (~repo size)
- **Cleanup**: Orphaned worktrees removed on server restart
- **Merging**: Manual merge from `agentz/session-*` branches to main
- **Performance**: Worktree creation adds ~1-2s to session spawn
