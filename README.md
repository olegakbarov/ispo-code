# Ispo Code

A full-stack multi-agent control panel for spawning and managing AI coding agents. Features real-time session monitoring, AI-powered task planning, and integrated git workflows with worktree isolation.

## Overview

Ispo Code is a comprehensive web-based control panel that lets you orchestrate multiple AI coding agents (Claude, Codex, OpenCode, Cerebras, Gemini) to work on your codebase. It provides task management, real-time monitoring, git integration, and a complete workflow from planning to verification.

**Tech Stack**: React 19 + TanStack Router/Start + tRPC + Tailwind CSS + Vite

## Features

### Task Management (`src/routes/tasks/`)

- **Markdown-based tasks** - Tasks stored as `.md` files in `tasks/` directory
- **AI-powered task planning** - Auto-generate detailed task plans from brief descriptions
- **Task lifecycle** - Create → Plan → Implement → Verify → Review → Archive workflow
- **Subtasks** - Split large tasks into manageable subtasks with independent tracking
- **Multi-agent debugging** - Spawn multiple agents to debug the same issue concurrently
- **Debate mode** - Multiple agents debate approaches before implementation
- **Task orchestration** - Synthesize findings from multiple debug sessions
- **Auto-run** - Tasks can auto-execute implementation after planning completes
- **Task archiving** - Archive completed tasks with automatic dating (`tasks/archive/YYYY-MM/`)
- **Search & filters** - Find tasks by status, agent type, date range

### Agent Sessions (`src/routes/agents/`)

- **Multiple agent types**:
  - **Claude CLI** - Anthropic Claude Code CLI (200K context)
  - **Codex CLI** - OpenAI Codex agent (128K context)
  - **OpenCode** - Multi-provider embedded agent (configurable)
  - **Cerebras GLM** - GLM 4.7, 20x faster (8K-131K context)
  - **Gemini** - Google Gemini 2.0 (1M context)
  - **QA Agent (mcporter)** - MCP-powered QA tools
- **Real-time output streaming** - Live agent output via Server-Sent Events
- **Durable sessions** - Sessions survive server restarts via durable streams
- **Session resumption** - Continue conversations with follow-up messages
- **Multimodal input** - Attach images to prompts (for supported agents)
- **File change tracking** - See all files edited by each session
- **Process monitoring** - Track daemon processes, PIDs, and resource usage

### Git Integration (`src/lib/agent/git-worktree.ts`)

- **Worktree isolation** - Each agent session runs in isolated git worktree on unique branch
- **Branch management** - Automatic branch creation (`ispo-code/session-{id}`)
- **Commit workflows** - Stage, commit, and merge changes with generated messages
- **Git status** - View staged, modified, and untracked files per session
- **Diff preview** - Review file changes before committing
- **Merge to main** - Merge session branch to main with cleanup
- **Revert support** - Revert merges with automatic tracking
- **QA workflow** - Track merge status (pending/pass/fail) for quality assurance

### GitHub Integration (`src/components/github/`)

- **OAuth authentication** - Sign in with GitHub
- **Repository browser** - Browse your GitHub repositories
- **Clone & open** - Clone repos to `.ispo-code/repos/` and set as working directory
- **Session linking** - Associate agent sessions with GitHub repos for context

### Statistics & Analytics (`src/routes/stats.tsx`)

- **Session metrics** - Total sessions, success rate, avg duration, context utilization
- **Tool usage charts** - Visualize which tools agents use most
- **File change tracking** - See which files are modified most frequently ("hot files")
- **Task analytics** - Track task completion rates, agent performance
- **Daily stats** - Activity trends over time
- **Session breakdown** - Compare agent types and models

### Worktree Management (`src/routes/worktrees.tsx`)

- **Worktree browser** - View all git worktrees in the repository
- **Working directory switching** - Change active worktree for operations
- **Branch isolation** - See which branch each worktree is on
- **Session-worktree mapping** - Track which sessions use which worktrees

### Settings & Customization (`src/routes/settings.tsx`)

- **Theme selection** - Dark/light mode with multiple preset color schemes
- **Brand color** - Customize accent color with preset or custom hue slider
- **Audio notifications** - ElevenLabs TTS for task completion/failure (optional)
- **Agent defaults** - Set default agents/models for planning and verification
- **Voice selection** - Choose from ElevenLabs voices for notifications

### Review & Verification

- **Code review mode** - Visual diff view with syntax highlighting (Shiki)
- **File-by-file review** - Navigate changed files with prev/next
- **Verification agents** - Spawn agents to verify completed tasks
- **Spec review** - AI reviews task specifications for clarity and completeness
- **Test validation** - Agents can run tests to verify implementations

### Tool Calls Gallery (`src/routes/tool-calls.tsx`)

- **Tool execution history** - Browse all tool calls across sessions
- **Categorization** - Filter by tool type (read/write/bash/grep/glob)
- **Detailed view** - See tool inputs, outputs, and execution context

## Quick Start

### Prerequisites

Install CLI tools for agents you want to use:

- **Claude**: `npm install -g @anthropic-ai/claude-code` (requires `ANTHROPIC_API_KEY`)
- **Codex**: Install Codex CLI (requires OpenAI API key)
- **OpenCode**: `npm install -g @opencode-ai/sdk` (multi-provider)
- **Cerebras**: SDK embedded (requires `CEREBRAS_API_KEY`)
- **Gemini**: SDK embedded (requires `GOOGLE_GENERATIVE_AI_API_KEY`)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:4200
```

### Development Commands

```bash
npm run dev          # Start dev server (port 4200)
npm run build        # Production build
npm run start        # Preview production build
npm run test         # Run tests
npm run test:run     # Run tests once
```

### Environment Variables

**Required for specific features:**

```bash
# Agent API Keys
ANTHROPIC_API_KEY=...          # For Claude CLI
CEREBRAS_API_KEY=...           # For Cerebras GLM
GOOGLE_GENERATIVE_AI_API_KEY=...  # For Gemini

# Optional: Audio notifications
ELEVENLABS_API_KEY=...         # For TTS notifications

# Optional: GitHub integration
GITHUB_CLIENT_ID=...           # For OAuth
GITHUB_CLIENT_SECRET=...       # For OAuth

# Optional: Disable worktree isolation
DISABLE_WORKTREE_ISOLATION=true
```

## Configuration

### Agent Configuration (`src/lib/agent/config.ts`)

- Model selection per agent type
- Context window sizes
- Default models

### Theme Configuration (`src/lib/theme-presets.ts`)

- Color scheme presets
- Custom theme tokens
- Dark/light mode variants

## Architecture

### Core Components

- **AgentManager** (`src/lib/agent/manager.ts`) - Orchestrates all agent sessions
- **Tool Framework** (`src/lib/agent/tools.ts`) - File operations (read/write/edit/bash/glob/grep)
- **Task Service** (`src/lib/agent/task-service.ts`) - Task CRUD, parsing, sections, subtasks
- **Git Service** (`src/lib/agent/git-service.ts`) - Git operations (status/diff/commit)
- **Worktree Manager** (`src/lib/agent/git-worktree.ts`) - Worktree lifecycle
- **Durable Streams** (`src/streams/`) - Persistent state via append-only streams
- **Process Monitor** (`src/daemon/process-monitor.ts`) - Daemon process tracking

### tRPC Routers (`src/trpc/`)

- **agent.ts** - Agent session operations (spawn/list/cancel/delete)
- **tasks.ts** - Task operations (create/save/split/assign/verify/archive)
- **git.ts** - Git operations (status/diff/commit/merge)
- **github.ts** - GitHub API (repos/clone/auth)
- **stats.ts** - Analytics queries
- **system.ts** - System info (working dir, env)

### File Structure

```
src/
├── components/        # React components
│   ├── agents/       # Agent session UI
│   ├── tasks/        # Task management UI
│   ├── github/       # GitHub integration UI
│   ├── ui/           # Reusable UI primitives
│   └── layout/       # App layout (sidebar, etc)
├── routes/           # File-based routing
│   ├── tasks/        # Task pages
│   ├── agents/       # Agent pages
│   ├── stats.tsx     # Analytics
│   ├── settings.tsx  # Settings
│   └── worktrees.tsx # Worktree browser
├── lib/
│   ├── agent/        # Core agent system
│   ├── hooks/        # React hooks
│   └── stores/       # Zustand stores
├── trpc/             # tRPC API layer
└── streams/          # Durable streams
```

## Worktree Isolation

By default, each agent session runs in an isolated git worktree to prevent conflicts:

1. **Session spawn** - Creates `.ispo-code/worktrees/{sessionId}` on new branch
2. **Execution** - All file operations scoped to worktree
3. **Cleanup** - Worktree deleted on session deletion

**Benefits:**

- Concurrent agents don't conflict
- Clean commits per session
- No cross-session contamination

**Disable:** Set `DISABLE_WORKTREE_ISOLATION=true`

## Contributing

Contributions welcome! Key areas:

- Additional agent integrations
- New workflow features
- UI/UX improvements
- Performance optimizations

## License

MIT

## Support

- **Issues**: Report bugs at GitHub Issues
- **Docs**: See `CLAUDE.md` for codebase overview
- **Community**: [Add community link]

---

Built with ❤️ using React 19, TanStack, and tRPC
