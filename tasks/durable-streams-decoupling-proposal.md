# Server/Agent Decoupling Proposal: Durable Streams Architecture

## Executive Summary

This proposal outlines options for decoupling the agentz server from agent processes, enabling agents to survive server restarts and improving system resilience. We analyze three approaches with a recommended path forward using durable streams.

---

## Current Architecture Problems

### 1. Tight Coupling (manager.ts:59)
```typescript
private agents = new Map<string, RunningAgent>()
```
Running agents exist only in memory. Server restart = all agents lost.

### 2. State Inconsistency (manager.ts:74-76)
```typescript
// Concurrency should be based on processes running in this server instance,
// not persisted session statuses (which may be stale after restarts).
```
The code explicitly acknowledges that persisted state diverges from reality after restarts.

### 3. CLI Subprocess Lifecycle
CLI agents (Claude, Codex) are spawned as child processes. When the Node server dies, so do all children.

### 4. Monolithic Design
The server is simultaneously:
- API endpoint (tRPC)
- Agent orchestrator (AgentManager)
- State persistence layer (SessionStore)
- Event emitter (real-time updates)

---

## Durable Streams Architecture 

Based on [claude-code-ui](https://github.com/KyleAMathews/claude-code-ui) patterns.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         UI (React)                          │
│  - Subscribes to streams via SSE                            │
│  - Stateless - can reconnect anytime                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ SSE / HTTP
┌─────────────────────────────────────────────────────────────┐
│                    Stream Server (HTTP)                     │
│  - Hosts durable streams                                    │
│  - Persists events to disk                                  │
│  - Supports replay and live subscriptions                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Agent Daemon  │    │ Agent Daemon  │    │ Agent Daemon  │
│  (Process 1)  │    │  (Process 2)  │    │  (Process N)  │
│               │    │               │    │               │
│ - Runs agent  │    │ - Runs agent  │    │ - Runs agent  │
│ - Publishes   │    │ - Publishes   │    │ - Publishes   │
│   to streams  │    │   to streams  │    │   to streams  │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Key Components

#### 1. Durable Streams Layer
Using `@durable-streams/*` packages:

```typescript
// Stream types
interface AgentStream {
  // Per-session stream: /sessions/{sessionId}
  // Contains all output chunks as they occur
  entries: AgentOutputChunk[]
}

interface RegistryStream {
  // Central registry: /__registry__
  // Contains session lifecycle events
  entries: RegistryEvent[]
}

type RegistryEvent =
  | { type: 'session_created'; sessionId: string; agentType: AgentType; prompt: string; timestamp: string }
  | { type: 'session_updated'; sessionId: string; status: SessionStatus; timestamp: string }
  | { type: 'session_completed'; sessionId: string; metadata: SessionMetadata; timestamp: string }
```

#### 2. Agent Daemon (Standalone Process)
```typescript
// daemon/agent-daemon.ts
class AgentDaemon {
  private streamClient: DurableStreamClient
  private agent: CerebrasAgent | CLIAgentRunner
  private sessionId: string

  async run(config: DaemonConfig) {
    // 1. Register with registry stream
    await this.streamClient.append('/__registry__', {
      type: 'session_created',
      sessionId: this.sessionId,
      agentType: config.agentType,
      prompt: config.prompt,
      timestamp: new Date().toISOString()
    })

    // 2. Run agent and publish output
    this.agent.on('output', async (chunk) => {
      await this.streamClient.append(`/sessions/${this.sessionId}`, chunk)
    })

    // 3. Update registry on completion
    this.agent.on('complete', async () => {
      await this.streamClient.append('/__registry__', {
        type: 'session_completed',
        sessionId: this.sessionId,
        metadata: this.analyzer.getMetadata(),
        timestamp: new Date().toISOString()
      })
    })

    await this.agent.run(config.prompt)
  }
}
```

#### 3. Thin API Layer
```typescript
// Updated tRPC router - stateless
export const agentRouter = router({
  spawn: publicProcedure
    .input(spawnSchema)
    .mutation(async ({ input }) => {
      const sessionId = generateId()

      // Spawn daemon as detached process
      spawn('node', ['daemon/agent-daemon.js', '--config', JSON.stringify({
        sessionId,
        agentType: input.agentType,
        prompt: input.prompt,
        workingDir: input.workingDir
      })], {
        detached: true,
        stdio: 'ignore'
      }).unref()

      return { sessionId }
    }),

  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const streamClient = getStreamClient()

      // Read session data from streams
      const output = await streamClient.read(`/sessions/${input.sessionId}`)
      const registry = await streamClient.read('/__registry__')

      const sessionEvents = registry.filter(e => e.sessionId === input.sessionId)
      const latestStatus = sessionEvents.at(-1)

      return {
        id: input.sessionId,
        output: output.entries,
        status: latestStatus?.status ?? 'running'
      }
    }),

  subscribe: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(async function* ({ input }) {
      const streamClient = getStreamClient()

      // SSE subscription to session stream
      for await (const chunk of streamClient.stream(`/sessions/${input.sessionId}`, { live: 'sse' })) {
        yield chunk
      }
    })
})
```

### Benefits

| Aspect | Current | With Durable Streams |
|--------|---------|---------------------|
| Server restart | Agents killed | Agents continue running |
| State persistence | JSON file, can corrupt | Append-only log, replayable |
| Real-time updates | EventEmitter (in-process) | SSE (cross-process) |
| Scalability | Single process | Multiple daemon processes |
| Recovery | Manual restart needed | Auto-recovery from streams |

### Implementation Phases

**Phase 1: Stream Infrastructure (2-3 days work)**
- Add durable-streams dependencies
- Create stream server configuration
- Define stream schemas (session, registry)

**Phase 2: Daemon Process (3-4 days work)**
- Extract agent running logic to standalone daemon
- Implement stream publishing
- Add process management (spawn/monitor)

**Phase 3: API Migration (2-3 days work)**
- Convert tRPC to read from streams
- Implement SSE subscriptions
- Remove AgentManager singleton

**Phase 4: UI Updates (1-2 days work)**
- Switch from polling to SSE subscriptions
- Handle reconnection gracefully

---


### Dependencies to Add

```json
{
  "dependencies": {
    "@durable-streams/client": "^0.1.5",
    "@durable-streams/server": "^0.1.6",
    "@durable-streams/state": "^0.1.5"
  }
}
```

### Migration Strategy

The migration can be done incrementally:

1. **Add streams alongside existing code** - both systems work in parallel
2. **New sessions use streams** - existing sessions continue with old system
3. **Deprecate old system** - once stable, remove SessionStore
4. **Clean up** - remove AgentManager singleton, in-memory maps

---

## File Structure After Migration

```
src/
├── daemon/
│   ├── agent-daemon.ts      # Standalone agent process
│   ├── stream-publisher.ts  # Stream writing logic
│   └── process-monitor.ts   # Health checks, restarts
├── streams/
│   ├── server.ts            # Durable stream server setup
│   ├── schemas.ts           # Stream event types
│   └── client.ts            # Client connection factory
├── lib/agent/
│   ├── cerebras.ts          # (unchanged)
│   ├── cli-runner.ts        # (unchanged)
│   └── types.ts             # (add stream-related types)
├── trpc/
│   └── agent.ts             # Rewritten to use streams
└── routes/
    └── agents/$sessionId.tsx # Use SSE subscriptions
```

---

## Questions for Consideration

1. **Storage backend**: File-based or SQLite for streams?
2. **Stream retention**: How long to keep session streams?
3. **Multi-machine**: Is distributed deployment a near-term need?
4. **Backward compatibility**: Support existing sessions during migration?

---

## Next Steps

1. Review this proposal and select approach
2. Spike: Set up basic durable-streams server
3. Prototype: Single agent daemon publishing to stream
4. Iterate: Full implementation based on learnings

---

## Implementation Progress

### ✅ Phase 1: Stream Infrastructure (COMPLETED)

**Files Created:**
- `src/streams/schemas.ts` - Stream event type definitions (RegistryEvent, SessionStreamEvent)
- `src/streams/server.ts` - Durable streams server setup using DurableStreamTestServer
- `src/streams/client.ts` - StreamAPI for reading/writing/subscribing to streams
- `src/streams/init.ts` - Auto-start streams server on app startup

**Key Implementation Notes:**
- Using `@durable-streams/*` packages (v0.1.5-0.1.6)
- File-backed storage with LMDB (via DurableStreamTestServer)
- Server runs on port 4201 by default
- Data persisted to `.streams/` directory

### ✅ Phase 2: Daemon Process (COMPLETED)

**Files Created:**
- `src/daemon/agent-daemon.ts` - Standalone agent process with stream publishing
- `src/daemon/stream-publisher.ts` - Buffered event publishing utility
- `src/daemon/process-monitor.ts` - Process spawning and health monitoring

**Key Implementation Notes:**
- Daemons spawn as detached processes (`detached: true`, `unref()`)
- All communication via streams (no stdio pipes)
- Supports all agent types (Cerebras, OpenCode, Claude, Codex)
- Graceful shutdown on SIGTERM/SIGINT

### ✅ Phase 3: API Migration (COMPLETED)

**Files Created:**
- `src/trpc/agent-streams.ts` - New tRPC router using streams

**Implementation:**
- `reconstructSessionFromStreams()` - Rebuilds AgentSession from stream events
- `spawn()` - Spawns daemon and returns immediately
- `cancel()` - Kills daemon and marks session cancelled
- `sendMessage()` - Resumes sessions by spawning new daemon

**Limitations:**
- `approve()` not yet implemented (requires IPC with daemon)
- No backward compatibility with old SessionStore sessions

### 🚧 Phase 4: UI Updates (NOT STARTED)

**Remaining Work:**
- Switch UI from polling to SSE subscriptions
- Update components to handle reconnection
- Test real-time updates from streams

### 📋 Migration Checklist

- [x] Install durable-streams dependencies
- [x] Create stream schemas
- [x] Set up stream server
- [x] Create stream client API
- [x] Implement agent daemon
- [x] Implement stream publisher
- [x] Implement process monitor
- [x] Create new tRPC router (agent-streams.ts)
- [ ] Build daemon scripts for production (`npm run build`)
- [ ] Update main tRPC router to use new streams router
- [ ] Add SSE subscription to UI
- [ ] Test session creation and output streaming
- [ ] Test session resumption
- [ ] Test server restart resilience
- [ ] Document migration path from old system
- [ ] Performance testing (concurrent sessions)

### 🔧 To Enable Streams Architecture

1. **Start streams server:**
   ```typescript
   import { initializeStreamsServer } from '@/streams/init'
   await initializeStreamsServer()
   ```

2. **Use new router in app:**
   ```typescript
   import { agentStreamsRouter } from '@/trpc/agent-streams'
   // Replace agentRouter with agentStreamsRouter
   ```

3. **Build daemon for production:**
   ```bash
   npm run build  # Compiles to dist/daemon/agent-daemon.js
   ```

### 🐛 Known Issues

1. **Approval mechanism** - Not implemented for stream-based daemons
2. **Mixed sessions** - Old SessionStore sessions won't appear in streams
3. **Process tracking** - ProcessMonitor is in-memory (lost on restart)

### 💡 Future Enhancements

1. **Distributed deployment** - Use network-based stream server
2. **Stream retention** - Add TTL for old session streams
3. **Process registry** - Persist daemon PIDs to streams for crash recovery
4. **Approval via streams** - Add approval request/response events
5. **Live metrics** - Real-time dashboard of running daemons

