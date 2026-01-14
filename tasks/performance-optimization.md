# Performance Optimization

**Priority:** 🟢 Low (After Core Features)
**Estimated Effort:** 3-5 days
**Status:** Not Started
**Depends On:** Test Coverage (to prevent regressions)

## Overview

Optimize performance bottlenecks and improve scalability of the Agentz application. Current performance is acceptable for small-scale use but needs improvement for production scale.

## Current Performance Profile

### What's Fast ✅
- Initial page load
- Component rendering
- tRPC query response times
- Small session file operations

### What's Slow ⚠️
- Large session file loading (>50 sessions)
- Markdown rendering with large outputs
- Frequent polling (every 1-3 seconds)
- Git operations on large repos

## Optimization Tasks

### 1. Replace File-Based Storage with Per-Session Files

**Current:** Single `sessions.json` file with all sessions
**Problem:** O(n) load time, full rewrite on every change
**Target:** Sub-100ms session loads at any scale

**Implementation:**
```
data/
  sessions/
    <session-id-1>.json
    <session-id-2>.json
    ...
  sessions-index.json  # Metadata only (id, status, timestamps)
```

**Tasks:**
- [ ] Create SessionStore refactor plan
- [ ] Implement one-file-per-session storage
- [ ] Create lightweight index file
- [ ] Add migration from old format
- [ ] Update all read/write operations
- [ ] Add cleanup for old sessions
- [ ] Benchmark: should be 10-100x faster for large datasets

**Benefits:**
- Constant-time single session loads
- Parallel session writes
- Smaller atomic operations
- Easier to implement sharding later

### 2. Implement Output Streaming to Disk

**Current:** Full output kept in memory and written on flush
**Problem:** Large outputs (>10MB) cause memory pressure
**Target:** Stream large outputs directly to files

**Implementation:**
```typescript
class SessionOutputWriter {
  private stream: WriteStream

  constructor(sessionId: string) {
    this.stream = createWriteStream(
      `data/sessions/${sessionId}.output.jsonl`,
      { flags: 'a' }
    )
  }

  append(chunk: AgentOutputChunk) {
    this.stream.write(JSON.stringify(chunk) + '\n')
  }
}
```

**Tasks:**
- [ ] Implement streaming output writer
- [ ] Use JSONL format (line-delimited JSON)
- [ ] Update session loader to read from separate file
- [ ] Add compression for completed sessions
- [ ] Benchmark memory usage (should reduce by 80%+)

### 3. Add WebSocket Support for Real-Time Updates

**Current:** HTTP polling every 1-3 seconds
**Problem:** Higher latency, more server load
**Target:** <100ms update latency

**Implementation:**
```typescript
// Server: ws-server.ts
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 4201 })

manager.on('output', (event) => {
  wss.clients.forEach(client => {
    if (client.sessionId === event.sessionId) {
      client.send(JSON.stringify(event))
    }
  })
})

// Client: use-session-stream.ts
export function useSessionStream(sessionId: string) {
  const [chunks, setChunks] = useState<AgentOutputChunk[]>([])

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4201')
    ws.onmessage = (event) => {
      const chunk = JSON.parse(event.data)
      setChunks(prev => [...prev, chunk])
    }
    return () => ws.close()
  }, [sessionId])

  return chunks
}
```

**Tasks:**
- [ ] Install `ws` package
- [ ] Create WebSocket server
- [ ] Add session subscription mechanism
- [ ] Create React hook for WebSocket connection
- [ ] Add fallback to polling (progressive enhancement)
- [ ] Handle reconnection logic
- [ ] Add heartbeat/keepalive
- [ ] Benchmark: 5-10x lower latency, 50% less server load

### 4. Optimize Markdown Rendering

**Current:** StreamingMarkdown re-renders on every update
**Problem:** Expensive for large outputs
**Target:** <16ms render time (60fps)

**Implementation:**
```typescript
// Memoize parsed markdown
const parsedMarkdown = useMemo(() => {
  return streamdown(content)
}, [content])

// Only update DOM if content changed
const MemoizedMarkdown = memo(StreamingMarkdown, (prev, next) => {
  return prev.content === next.content
})

// Virtual scrolling for very long outputs
import { VirtualList } from 'react-virtual'

<VirtualList
  height={600}
  itemCount={chunks.length}
  itemSize={50}
  renderItem={({ index }) => <Chunk data={chunks[index]} />}
/>
```

**Tasks:**
- [ ] Add `useMemo` for markdown parsing
- [ ] Add `React.memo` to StreamingMarkdown
- [ ] Implement virtual scrolling for >100 chunks
- [ ] Profile render times (DevTools)
- [ ] Benchmark: 80%+ reduction in render time

### 5. Implement Query Result Caching

**Current:** React Query default caching (5 minutes)
**Opportunity:** Aggressive caching for static data

**Implementation:**
```typescript
// Aggressive caching for slow queries
export const trpc = createTRPCReact<AppRouter>({
  overrides: {
    queries: {
      system: {
        getCodebaseMap: {
          staleTime: Infinity, // Never refetch
          cacheTime: Infinity,
        }
      },
      git: {
        branches: {
          staleTime: 60_000, // 1 minute
        }
      }
    }
  }
})
```

**Tasks:**
- [ ] Audit all queries for caching opportunities
- [ ] Add manual cache invalidation triggers
- [ ] Implement optimistic updates for mutations
- [ ] Add cache warming for predictable queries
- [ ] Benchmark: 50%+ reduction in redundant fetches

### 6. Optimize Git Operations

**Current:** Synchronous git commands block main thread
**Problem:** Large repos cause UI freezes
**Target:** Non-blocking git operations

**Implementation:**
```typescript
// Async git operations with caching
class GitService {
  private statusCache = new Map<string, { data: GitStatus, timestamp: number }>()

  async getStatus(invalidateCache = false): Promise<GitStatus> {
    const cached = this.statusCache.get('status')
    if (cached && Date.now() - cached.timestamp < 5000 && !invalidateCache) {
      return cached.data
    }

    // Run git in background
    const status = await this.runGitAsync('status --porcelain')
    this.statusCache.set('status', { data: status, timestamp: Date.now() })
    return status
  }

  private async runGitAsync(command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      exec(`git ${command}`, (err, stdout) => {
        if (err) reject(err)
        else resolve(this.parseGitOutput(stdout))
      })
    })
  }
}
```

**Tasks:**
- [ ] Convert sync git commands to async
- [ ] Add 5-second caching for status
- [ ] Use `git status -uno` (faster, excludes untracked files in subdirs)
- [ ] Implement git operation queue
- [ ] Add progress indicators for slow operations
- [ ] Benchmark: 70%+ improvement on large repos

### 7. Add Compression for Large Outputs

**Current:** Large outputs stored as plain JSON
**Problem:** High disk usage and slow loads
**Target:** 80%+ compression ratio for text outputs

**Implementation:**
```typescript
import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

class SessionStore {
  async saveCompressed(session: AgentSession): Promise<void> {
    if (session.output.length > 1000) {
      const json = JSON.stringify(session.output)
      const compressed = await gzipAsync(json)
      writeFileSync(`${sessionPath}.gz`, compressed)
    } else {
      writeFileSync(sessionPath, JSON.stringify(session))
    }
  }
}
```

**Tasks:**
- [ ] Add compression for sessions with >1000 chunks
- [ ] Use gzip for completed sessions
- [ ] Decompress on load
- [ ] Add `.gz` extension to compressed files
- [ ] Benchmark: 80%+ smaller files, 50% faster loads

### 8. Implement Lazy Loading for Session List

**Current:** All sessions loaded upfront
**Problem:** Slow with >50 sessions
**Target:** Load 20 sessions at a time

**Implementation:**
```typescript
// tRPC procedure with pagination
list: protectedProcedure
  .input(
    z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
      status: z.enum(['all', 'active', 'completed']).default('all'),
    })
  )
  .query(async ({ input }) => {
    const sessions = manager.listSessions()
    const filtered = input.status === 'all'
      ? sessions
      : sessions.filter(s => s.status === input.status)

    return {
      sessions: filtered.slice(input.offset, input.offset + input.limit),
      total: filtered.length,
      hasMore: input.offset + input.limit < filtered.length,
    }
  })

// UI: Infinite scroll
import { useInfiniteQuery } from '@tanstack/react-query'

const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['sessions'],
  queryFn: ({ pageParam = 0 }) =>
    trpc.agent.list.query({ offset: pageParam, limit: 20 }),
  getNextPageParam: (lastPage) =>
    lastPage.hasMore ? lastPage.offset + 20 : undefined,
})
```

**Tasks:**
- [ ] Add pagination to list query
- [ ] Implement infinite scroll in UI
- [ ] Add loading states
- [ ] Optimize index queries
- [ ] Benchmark: 10x faster initial load with >100 sessions

### 9. Add Request Debouncing

**Current:** Every keystroke triggers query
**Problem:** Excessive API calls
**Target:** Single request per user pause

**Implementation:**
```typescript
import { useDebouncedValue } from '@mantine/hooks'

function SearchComponent() {
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)

  const { data } = trpc.search.useQuery(debouncedSearch)

  return <input onChange={(e) => setSearch(e.target.value)} />
}
```

**Tasks:**
- [ ] Install debounce utility
- [ ] Add to search inputs
- [ ] Add to filter controls
- [ ] Benchmark: 90%+ reduction in queries during typing

## Performance Monitoring

### Add Performance Metrics

**Implementation:**
```typescript
// lib/monitoring/metrics.ts
export class PerformanceMonitor {
  static measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    return fn().finally(() => {
      const duration = Date.now() - start
      console.log(`[Perf] ${name}: ${duration}ms`)
      // Send to analytics
    })
  }
}

// Usage
const session = await PerformanceMonitor.measureAsync(
  'loadSession',
  () => store.getSession(id)
)
```

**Tasks:**
- [ ] Add timing to critical operations
- [ ] Log slow operations (>1s)
- [ ] Create performance dashboard
- [ ] Set up alerts for regressions

## Benchmarking Suite

### Create Performance Tests

**Implementation:**
```typescript
// tests/performance/benchmarks.test.ts
describe('Performance Benchmarks', () => {
  it('should load 100 sessions in <500ms', async () => {
    const start = Date.now()
    await store.listSessions({ limit: 100 })
    const duration = Date.now() - start

    expect(duration).toBeLessThan(500)
  })

  it('should handle 1000 concurrent output appends', async () => {
    const promises = Array(1000).fill(0).map(() =>
      store.appendOutput(sessionId, mockChunk)
    )

    const start = Date.now()
    await Promise.all(promises)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(1000) // 1 second
  })
})
```

## Success Criteria

- [ ] Session list loads in <200ms with 100+ sessions
- [ ] Single session loads in <50ms regardless of output size
- [ ] Markdown rendering <16ms per frame (60fps)
- [ ] Real-time updates <100ms latency (with WebSockets)
- [ ] Memory usage <500MB with 50 active sessions
- [ ] Git operations non-blocking on large repos
- [ ] 80%+ reduction in API calls (caching + debouncing)
- [ ] All optimizations have benchmark tests
- [ ] No performance regressions in CI

## Priority Order

1. **Day 1:** Per-session file storage (biggest impact)
2. **Day 2:** Output streaming to disk
3. **Day 3:** WebSocket implementation
4. **Day 4:** Markdown + query optimization
5. **Day 5:** Git operations + compression
6. **Monitoring:** Performance metrics and dashboards

## Notes

- Run benchmarks before and after each change
- Profile with Chrome DevTools
- Test with realistic data sizes (100+ sessions, 10MB outputs)
- Don't over-optimize early (measure first)
- Document performance characteristics in code
