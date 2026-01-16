# Package as npx CLI with Interactive Mode

## Goal

Enable users to install and run ispo-code via:
```bash
npm install -g ispo-code
ispo
```

The CLI should start an interactive REPL that:
1. Boots the web server + streams infrastructure in the background
2. Provides a dashboard showing running agents and system status
3. Offers commands to spawn, monitor, and control agents
4. Streams real-time logs from any session

## Current State

### Existing Infrastructure
- **Process Monitor** (`src/daemon/process-monitor.ts`): Singleton tracking daemon PIDs, health checks, stats
- **Daemon Registry** (`src/daemon/daemon-registry.ts`): Persistent JSON file (`~/.ispo-code/data/daemon-registry.json`) tracking all daemons
- **Session Store** (`src/lib/agent/session-store.ts`): In-memory + file persistence for session state
- **Durable Streams** (`src/streams/`): Append-only event logs for real-time output and crash recovery
- **tRPC API** (`src/trpc/agent.ts`): Full CRUD + monitoring endpoints (list, get, spawn, cancel, stats)

### Build Output
- `npm run build` produces `dist/server/server.js` (SSR handler) and `dist/client/` (static assets)
- `npm run start` runs `vite preview` to serve the built app
- Streams worker currently runs separately via `tsx scripts/streams-worker.ts`

## Implementation Plan

### Phase 1: CLI Entry Point & Server Bootstrap

#### 1.1 Create bin entry point
```
bin/
  ispo.ts          # Main CLI entry, shebang, arg parsing
```

**Responsibilities:**
- Parse CLI arguments (--port, --host, --no-open, --help, --version)
- Initialize streams server (embed, don't shell out)
- Start HTTP server serving the built app
- Launch interactive REPL or execute single command

**Key decision:** Don't use `vite preview` - instead, create a lightweight production server using `h3` or native `http` that:
- Serves static files from `dist/client/`
- Handles SSR via the exported fetch handler from `dist/server/server.js`
- Runs streams server in-process

#### 1.2 Production server module
```
src/cli/
  server.ts        # Production HTTP server (no vite dependency)
  streams.ts       # Embedded streams initialization
```

**server.ts approach:**
```typescript
import { createServer } from 'http'
import { createApp, toNodeListener, serveStatic } from 'h3'
import handler from '../dist/server/server.js'

const app = createApp()
app.use('/assets', serveStatic('dist/client/assets'))
app.use(handler.fetch) // SSR handler

createServer(toNodeListener(app)).listen(port)
```

### Phase 2: Interactive REPL

#### 2.1 REPL infrastructure
```
src/cli/
  repl.ts          # Main REPL loop using readline
  commands/
    index.ts       # Command registry
    status.ts      # Show dashboard/status
    list.ts        # List sessions
    logs.ts        # Stream session output
    spawn.ts       # Create new agent session
    kill.ts        # Cancel session
    open.ts        # Open web UI in browser
    help.ts        # Show available commands
```

#### 2.2 Command interface
```typescript
interface Command {
  name: string
  aliases?: string[]
  description: string
  usage: string
  execute(args: string[], ctx: CLIContext): Promise<void>
}

interface CLIContext {
  trpc: TRPCClient        // Direct tRPC caller (no HTTP)
  streams: StreamAPI      // For real-time log streaming
  config: { port: number; host: string }
}
```

#### 2.3 tRPC client for CLI
Create a direct tRPC caller that doesn't go through HTTP:
```typescript
// src/cli/trpc-client.ts
import { createCallerFactory } from '@trpc/server'
import { appRouter } from '../trpc/router'

const createCaller = createCallerFactory(appRouter)
export const trpc = createCaller(createContext())
```

### Phase 3: Commands Implementation

#### 3.1 `status` - Dashboard view
```
ispo> status

  ╭─────────────────────────────────────────────╮
  │  ispo-code v1.0.0                           │
  │  Web UI: http://localhost:4200              │
  ╰─────────────────────────────────────────────╯

  Processes: 3 running, 0 dead, 47 total
  Agents: claude (2), codex (1)
  Uptime: 2h 34m

  Recent Sessions:
  ┌──────────┬─────────┬───────────┬─────────────────────────┐
  │ ID       │ Agent   │ Status    │ Task                    │
  ├──────────┼─────────┼───────────┼─────────────────────────┤
  │ a7f3c... │ claude  │ ● running │ Fix auth bug in login   │
  │ b2e1d... │ codex   │ ○ idle    │ Add dark mode toggle    │
  │ c9a4f... │ gemini  │ ✓ done    │ Review PR #42           │
  └──────────┴─────────┴───────────┴─────────────────────────┘
```

**Data sources:**
- `trpc.agent.getProcessStats()` for process counts
- `trpc.agent.list()` for session table
- Package version from package.json

#### 3.2 `list` - Session list with filters
```
ispo> list                    # All sessions
ispo> list --running          # Only running
ispo> list --agent claude     # Filter by agent type
ispo> list --limit 20         # Limit results
```

#### 3.3 `logs <sessionId>` - Real-time output streaming
```
ispo> logs a7f3c
[2024-01-15 10:23:45] Starting session...
[2024-01-15 10:23:46] Reading file src/auth/login.ts
[2024-01-15 10:23:47] Found issue on line 42...
^C (Ctrl+C to stop streaming)
```

**Implementation:**
- Use `StreamAPI.read()` to get historical events
- Use `StreamAPI.subscribe()` or poll for new events
- Format output chunks with timestamps
- Handle Ctrl+C to return to REPL (don't exit process)

#### 3.4 `spawn <agent> <prompt>` - Create session
```
ispo> spawn claude "Add unit tests for auth module"
Spawning claude agent...
Session ID: e8f2a1b3
Status: running

Use 'logs e8f2a' to stream output
```

**Implementation:**
- Call `trpc.agent.spawn()` with config
- Use current working directory as workingDir
- Print session ID for reference

#### 3.5 `kill <sessionId>` - Cancel session
```
ispo> kill a7f3c
Cancelling session a7f3c...
Session cancelled.
```

#### 3.6 `open` - Launch web UI
```
ispo> open
Opening http://localhost:4200 in default browser...
```

Use `open` (macOS), `xdg-open` (Linux), or `start` (Windows).

#### 3.7 `help` - Command reference
```
ispo> help

Commands:
  status              Show dashboard with running agents
  list [options]      List all sessions
  logs <id>           Stream real-time output from session
  spawn <agent> <p>   Create new agent session
  kill <id>           Cancel running session
  open                Open web UI in browser
  clear               Clear terminal
  exit                Exit CLI (keeps server running)
  quit                Stop server and exit

Options:
  --port <n>          Server port (default: 4200)
  --no-open           Don't open browser on start
```

### Phase 4: Package Configuration

#### 4.1 Update package.json
```json
{
  "name": "ispo-code",
  "version": "1.0.0",
  "description": "Multi-agent control panel for AI coding agents",
  "type": "module",
  "bin": {
    "ispo": "./dist/cli/bin.js"
  },
  "files": [
    "dist",
    "bin"
  ],
  "scripts": {
    "build": "npm run build:app && npm run build:cli",
    "build:app": "vite build",
    "build:cli": "tsup src/cli/bin.ts --format esm --outDir dist/cli",
    "prepublishOnly": "npm run build"
  }
}
```

Remove `"private": true` when ready to publish.

#### 4.2 CLI build with tsup
Add tsup for bundling the CLI entry point:
```bash
npm install -D tsup
```

tsup config to bundle CLI with dependencies:
```typescript
// tsup.config.ts
export default {
  entry: ['src/cli/bin.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist/cli',
  clean: true,
  // Don't bundle these - they're runtime dependencies
  external: ['vite', '@tanstack/*']
}
```

### Phase 5: Startup Flow

#### 5.1 CLI startup sequence
```
1. Parse arguments (--port, --help, --version, etc.)
2. Check if server already running on port (reuse if so)
3. Initialize streams server (in-process)
4. Start HTTP server
5. Print banner with URL
6. If not --no-open, open browser
7. Enter REPL loop
8. On exit: optionally keep server running or shutdown
```

#### 5.2 Graceful shutdown
- `exit` command: Detach from REPL but keep server running (for web UI access)
- `quit` command: Full shutdown - kill server, cleanup daemons
- `Ctrl+C` in REPL: Same as `exit`
- `Ctrl+C` twice: Force quit

### Phase 6: Polish & UX

#### 6.1 Output formatting
- Use `chalk` for colors
- Use `cli-table3` for tables
- Use `ora` for spinners during async operations
- Clear, consistent status indicators: ● running, ○ idle, ✓ done, ✗ failed

#### 6.2 Auto-refresh option
```
ispo> status --watch
# Refreshes every 2 seconds, Ctrl+C to stop
```

#### 6.3 Session shortcuts
Allow partial ID matching:
```
ispo> logs a7f    # Matches a7f3c... if unique
ispo> kill b2     # Matches b2e1d... if unique
```

#### 6.4 Prompt customization
```
ispo>
ispo [3 running]>
ispo [a7f3c]>      # When "attached" to a session
```

## File Structure

```
bin/
  ispo.ts                    # Shebang entry point (thin wrapper)

src/cli/
  index.ts                   # Main CLI module
  bin.ts                     # Entry point for bundling
  server.ts                  # Production HTTP server
  repl.ts                    # Interactive REPL
  context.ts                 # CLI context (trpc, streams, config)
  formatter.ts               # Output formatting utilities
  commands/
    index.ts                 # Command registry
    status.ts
    list.ts
    logs.ts
    spawn.ts
    kill.ts
    open.ts
    help.ts
```

## Dependencies to Add

```json
{
  "dependencies": {
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.3",
    "ora": "^8.0.1",
    "open": "^10.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0"
  }
}
```

## Testing Strategy

1. **Unit tests** for command parsing and formatting
2. **Integration tests** for server startup/shutdown
3. **Manual testing** checklist:
   - Fresh install via `npm install -g .`
   - `ispo --help` shows usage
   - `ispo` starts server and REPL
   - All commands work as documented
   - Ctrl+C handling is correct
   - Works on macOS, Linux, Windows

## Open Questions

1. **Server persistence**: Should `exit` keep the server running? Useful for leaving agents running while closing terminal.

2. **Config file**: Should we support `~/.ispo-code/config.json` for default port, preferred agent, etc.?

3. **Multiple instances**: What happens if user runs `ispo` twice? Detect existing server and connect to it?

4. **Auth/security**: Any concerns about exposing tRPC endpoints? Currently no auth.

5. **Daemon mode**: Should we support `ispo --daemon` to run server in background without REPL?

## Success Criteria

- [x] `npm install -g ispo-code && ispo` works from any directory
- [x] Server starts and web UI is accessible
- [x] All REPL commands functional
- [x] Real-time log streaming works
- [x] Graceful shutdown without orphan processes
- [x] Works on macOS and Linux (Windows nice-to-have)

## Implementation Notes (2025-01-15)

### Files Created

```
src/cli/
  index.ts                   # Main CLI module with startup orchestration
  bin.ts                     # Entry point for bundling
  server.ts                  # Production HTTP server (native http, no vite)
  repl.ts                    # Interactive REPL using readline
  context.ts                 # CLI context with direct tRPC caller
  formatter.ts               # Output formatting (chalk, cli-table3)
  commands/
    index.ts                 # Command registry with dynamic imports
    status.ts                # Dashboard with --watch support
    list.ts                  # Session list with filters
    logs.ts                  # Log streaming with --follow
    spawn.ts                 # Create new agent sessions
    kill.ts                  # Cancel sessions
    open.ts                  # Open web UI in browser
    help.ts                  # Command reference
    clear.ts                 # Clear terminal

bin/
  ispo.ts                    # Development entry point (tsx)

tsup.config.ts               # CLI bundler configuration
```

### Package.json Updates

- Added `bin.ispo` pointing to `./dist/cli/bin.js`
- Added `files` array for npm publish
- Updated `build` to run both `build:app` and `build:cli`
- Added `build:cli` using tsup
- Added `dev:cli` for development testing
- Removed `private: true` (ready for publishing)

### Key Decisions

1. **Direct tRPC caller** instead of HTTP - uses `createCallerFactory` for zero-latency calls
2. **Native http server** - no vite dependency in production, serves static + SSR
3. **Dynamic command imports** - avoids circular dependency issues with registration
4. **Partial ID matching** - `logs a7f` finds session starting with `a7f`
5. **Port reuse detection** - connects to existing server if port in use
