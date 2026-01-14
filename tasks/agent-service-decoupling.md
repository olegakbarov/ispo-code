# Agent Service Decoupling Spec

## Problem

Currently, `AgentManager` runs inside the web server process. When the server restarts (hot reload, crash, deploy), all running agent subprocesses are orphaned or killed. Session state persists to disk, but the actual processes are lost.

## Solution

Extract agent management into a separate long-lived service. The web server becomes a stateless API gateway that proxies requests to the agent service.

```
┌─────────────────┐         tRPC/HTTP          ┌─────────────────────┐
│   Web Server    │◄─────────────────────────►│    Agent Service     │
│     :4200       │       (reconnectable)      │        :4201         │
│                 │                            │                      │
│  - UI serving   │                            │  - AgentManager      │
│  - Git routes   │                            │  - SessionStore      │
│  - Task routes  │                            │  - Process spawning  │
│  - Proxy to     │                            │  - Output streaming  │
│    agent svc    │                            │                      │
└─────────────────┘                            └──────────────────────┘
```

## Architecture

### Agent Service (new)

**Location**: `src/agent-service/`

**Responsibilities**:
- Owns `AgentManager` singleton
- Owns `SessionStore` singleton
- Spawns and manages agent subprocesses
- Exposes tRPC router for agent operations
- Streams output via WebSocket/SSE

**Entry point**: `src/agent-service/index.ts`

```typescript
// Standalone Node server
import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { agentServiceRouter } from './router'

const server = createHTTPServer({
  router: agentServiceRouter,
  // WebSocket for streaming
})

server.listen(4201)
```

### Web Server (modified)

**Changes**:
- Remove direct `AgentManager` usage
- Add tRPC client to agent service
- Proxy agent routes to service
- Handle reconnection on service restart

**New client**: `src/lib/agent-service-client.ts`

```typescript
import { createTRPCClient } from '@trpc/client'
import type { AgentServiceRouter } from '../agent-service/router'

export const agentServiceClient = createTRPCClient<AgentServiceRouter>({
  links: [/* http + ws links */],
})
```

## API Design

### Agent Service tRPC Router

```typescript
// src/agent-service/router.ts

export const agentServiceRouter = router({
  // Session management
  spawn: procedure
    .input(spawnSchema)
    .mutation(({ input }) => agentManager.spawn(input)),

  cancel: procedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => agentManager.cancel(input.sessionId)),

  sendMessage: procedure
    .input(z.object({ sessionId: z.string(), message: z.string() }))
    .mutation(({ input }) => agentManager.sendMessage(input.sessionId, input.message)),

  approve: procedure
    .input(z.object({ sessionId: z.string(), approved: z.boolean() }))
    .mutation(({ input }) => agentManager.approve(input.sessionId, input.approved)),

  delete: procedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => agentManager.delete(input.sessionId)),

  // Queries
  getSession: procedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => agentManager.getSession(input.sessionId)),

  getAllSessions: procedure
    .query(() => agentManager.getAllSessions()),

  getActiveSessions: procedure
    .query(() => agentManager.getActiveSessions()),

  getAvailableAgentTypes: procedure
    .query(() => agentManager.getAvailableAgentTypes()),

  // Streaming (WebSocket subscription)
  onOutput: procedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(({ input }) => {
      return observable((emit) => {
        const handler = ({ sessionId, chunk }) => {
          if (sessionId === input.sessionId) {
            emit.next(chunk)
          }
        }
        agentManager.on('output', handler)
        return () => agentManager.off('output', handler)
      })
    }),

  onStatus: procedure
    .subscription(() => {
      return observable((emit) => {
        const handler = (data) => emit.next(data)
        agentManager.on('status', handler)
        return () => agentManager.off('status', handler)
      })
    }),
})
```

### Web Server Agent Router (modified)

```typescript
// src/trpc/agent.ts (simplified)

export const agentRouter = router({
  spawn: procedure
    .input(spawnSchema)
    .mutation(async ({ input }) => {
      // Proxy to agent service
      return agentServiceClient.spawn.mutate(input)
    }),

  // ... other routes proxy similarly

  onOutput: procedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(({ input }) => {
      // Forward subscription from agent service
      return agentServiceClient.onOutput.subscribe(input)
    }),
})
```

## File Structure

```
src/
├── agent-service/           # NEW - standalone service
│   ├── index.ts             # Entry point, HTTP server
│   ├── router.ts            # tRPC router
│   └── ws.ts                # WebSocket handler for subscriptions
│
├── lib/
│   ├── agent/               # MOVED here or kept, used by agent-service
│   │   ├── manager.ts
│   │   ├── session-store.ts
│   │   ├── cerebras.ts
│   │   ├── cli-runner.ts
│   │   └── ...
│   │
│   └── agent-client.ts      # NEW - tRPC client for web server
│
├── trpc/
│   └── agent.ts             # MODIFIED - proxies to agent service
│
└── ...
```

## Startup

### Development

```bash
# Option 1: Single command (recommended)
npm run dev  # Starts both via concurrently

# Option 2: Separate terminals
npm run dev:server   # Web server on :4200
npm run dev:agent    # Agent service on :4201
```

### Production

```bash
npm run build
npm run start  # Starts both services
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:agent\"",
    "dev:server": "vinxi dev",
    "dev:agent": "tsx watch src/agent-service/index.ts",
    "build": "vinxi build && tsx src/agent-service/build.ts",
    "start": "concurrently \"npm:start:server\" \"npm:start:agent\"",
    "start:server": "vinxi start",
    "start:agent": "node dist/agent-service/index.js"
  }
}
```

## Connection Handling

### Web Server → Agent Service

```typescript
// src/lib/agent-client.ts

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4201'

let client: ReturnType<typeof createTRPCClient> | null = null

export function getAgentClient() {
  if (!client) {
    client = createTRPCClient<AgentServiceRouter>({
      links: [
        httpBatchLink({ url: `${AGENT_SERVICE_URL}/trpc` }),
      ],
    })
  }
  return client
}

// For subscriptions (WebSocket)
export function getAgentWSClient() {
  return createWSClient({
    url: `ws://localhost:4201/ws`,
    retryDelayMs: () => 1000,  // Auto-reconnect
  })
}
```

### Reconnection Behavior

| Scenario | Behavior |
|----------|----------|
| Web server restarts | Reconnects to agent service, sessions continue |
| Agent service restarts | Web server retries connection, sessions lost (rare case) |
| Network blip | Auto-reconnect with backoff |

## State Management

### What Stays in Agent Service
- `SessionStore` (disk persistence)
- `AgentManager` (process management)
- All agent subprocess handles
- Output streaming sources

### What Stays in Web Server
- UI routes
- Git routes (no change)
- Task routes (no change)
- tRPC client to agent service

## Migration Steps

### Phase 1: Extract Agent Service
1. Create `src/agent-service/` directory
2. Create standalone tRPC server with agent router
3. Move `getAgentManager()` usage to service
4. Keep `SessionStore` in `src/lib/agent/` (shared code)

### Phase 2: Update Web Server
1. Create `src/lib/agent-client.ts`
2. Modify `src/trpc/agent.ts` to proxy calls
3. Update subscription handling for WebSocket forwarding

### Phase 3: Startup Scripts
1. Add `concurrently` dependency
2. Update `package.json` scripts
3. Test hot reload behavior

### Phase 4: Cleanup
1. Remove unused direct imports
2. Update any remaining `getAgentManager()` calls
3. Documentation

## Error Handling

### Agent Service Unavailable

```typescript
// In web server agent router
spawn: procedure.mutation(async ({ input }) => {
  try {
    return await agentServiceClient.spawn.mutate(input)
  } catch (err) {
    if (isConnectionError(err)) {
      throw new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Agent service is not available. Please try again.',
      })
    }
    throw err
  }
})
```

### Health Check

```typescript
// Agent service exposes health endpoint
health: procedure.query(() => ({
  status: 'ok',
  activeAgents: agentManager.getActiveCount(),
  uptime: process.uptime(),
}))
```

## Configuration

```typescript
// src/agent-service/config.ts
export const config = {
  port: parseInt(process.env.AGENT_SERVICE_PORT || '4201'),
  host: process.env.AGENT_SERVICE_HOST || 'localhost',
  maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '3'),
}
```

## Testing

### Unit Tests
- Agent service router (existing manager tests apply)
- Client reconnection logic

### Integration Tests
- Spawn agent via web server → verify proxied to service
- Web server restart → verify agent continues
- Output streaming across service boundary

## Open Questions

1. **Shared SessionStore?** Should web server have read-only access to sessions.json for faster queries, or always proxy through service?
   - Recommendation: Always proxy for consistency

2. **WebSocket vs SSE for streaming?** tRPC subscriptions work best with WebSocket, but SSE is simpler.
   - Recommendation: WebSocket (tRPC native support)

3. **Service discovery?** Hardcoded port vs dynamic?
   - Recommendation: Hardcoded for simplicity, env var for flexibility

## Success Criteria

- [ ] Web server can restart without killing running agents
- [ ] Output streaming works across service boundary
- [ ] `npm run dev` starts both services
- [ ] Existing UI works without changes
- [ ] Session persistence unchanged
