# Add Comprehensive Test Coverage

**Priority:** 🟡 Medium-High
**Estimated Effort:** 1 week
**Status:** Not Started
**Depends On:** Security and Reliability Hardening

## Overview

Currently the codebase has **zero test coverage**. This task adds comprehensive testing across unit, integration, and E2E layers to ensure reliability and prevent regressions.

## Testing Stack Setup

### Install Dependencies
```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  happy-dom \
  @types/node
```

### Configuration
- [ ] Create `vitest.config.ts`
- [ ] Add test scripts to `package.json`
- [ ] Configure test environment (happy-dom for React tests)
- [ ] Set up coverage reporting

## Phase 1: Critical Path Unit Tests (Priority 🔴)

### SessionStore Tests (`src/lib/agent/session-store.test.ts`)

**Why Critical:** Data corruption prevention, concurrency safety

Test Cases:
- [ ] Atomic writes (temp file + rename)
- [ ] Concurrent output appends don't lose data
- [ ] Buffer flushing works correctly
- [ ] Cleanup of completed session buffers
- [ ] Schema validation on load
- [ ] Recovery from corrupted data
- [ ] Lock prevents concurrent saves

**Example Test:**
```typescript
describe('SessionStore', () => {
  it('should not lose data during concurrent writes', async () => {
    const store = new SessionStore()
    const sessionId = 'test-session'

    // Simulate 100 concurrent output appends
    const promises = Array(100).fill(0).map((_, i) =>
      store.appendOutput(sessionId, {
        type: 'text',
        content: `chunk${i}`,
        timestamp: new Date().toISOString()
      })
    )

    await Promise.all(promises)
    const session = store.getSession(sessionId)
    expect(session.output.length).toBe(100)
  })
})
```

### AgentManager Tests (`src/lib/agent/manager.test.ts`)

**Why Critical:** Core orchestration logic

Test Cases:
- [ ] Spawn creates session and starts agent
- [ ] Max concurrent limit enforced (3 agents)
- [ ] Cancel terminates agent and updates status
- [ ] Delete removes session
- [ ] Events emitted correctly
- [ ] Agent type routing works
- [ ] Session not found errors handled

### MetadataAnalyzer Tests (`src/lib/agent/metadata-analyzer.test.ts`)

**Why Important:** Analytics accuracy

Test Cases:
- [ ] Token estimation accuracy
- [ ] File operation tracking
- [ ] Tool call categorization
- [ ] Context window calculation
- [ ] Duration computation

### Tool Tests (`src/lib/agent/tools.test.ts`)

**Why Critical:** Security (path traversal, command injection)

Test Cases:
- [ ] Path traversal blocked: `../../../etc/passwd`
- [ ] Paths normalized correctly
- [ ] Read/write/edit operations work
- [ ] Dangerous commands blocked
- [ ] Command timeout enforced
- [ ] Tool errors handled gracefully

**Example Test:**
```typescript
describe('Tools Security', () => {
  it('should block path traversal attempts', () => {
    expect(() => {
      read('../../../etc/passwd', '/home/user/project')
    }).toThrow('Path traversal detected')
  })

  it('should block dangerous commands', () => {
    expect(() => {
      exec('rm -rf /', '/home/user/project')
    }).toThrow('Dangerous command blocked')
  })
})
```

## Phase 2: Integration Tests (Priority 🟡)

### Agent Lifecycle Tests (`tests/integration/agent-lifecycle.test.ts`)

Test full agent execution flows:
- [ ] Cerebras: spawn → run → output → complete
- [ ] OpenCode: spawn → run → output → complete
- [ ] CLI (if available): spawn → run → output → complete
- [ ] Cancel during execution
- [ ] Error recovery
- [ ] Session persistence across restarts

**Example Test:**
```typescript
describe('Agent Lifecycle Integration', () => {
  it('should complete full Cerebras agent lifecycle', async () => {
    const manager = getAgentManager()
    const outputs: AgentOutputChunk[] = []

    manager.on('output', (event) => {
      if (event.sessionId === sessionId) {
        outputs.push(event.chunk)
      }
    })

    const sessionId = await manager.spawn(
      'What is 2 + 2?',
      'cerebras',
      'llama-3.3-70b'
    )

    await waitForStatus(manager, sessionId, 'completed', 30000)

    const session = manager.getSession(sessionId)
    expect(session.status).toBe('completed')
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs.some(c => c.type === 'text')).toBe(true)
  })
})
```

### tRPC Integration Tests (`tests/integration/trpc.test.ts`)

Test API layer:
- [ ] agent.spawn mutation
- [ ] agent.list query
- [ ] agent.get query with metadata
- [ ] agent.cancel mutation
- [ ] git.status query
- [ ] git.commit mutation
- [ ] tasks.list query
- [ ] tasks.createWithAgent mutation

### Git Service Tests (`tests/integration/git-service.test.ts`)

Test git operations:
- [ ] Status parsing
- [ ] Stage/unstage files
- [ ] Commit creation
- [ ] Branch operations
- [ ] Diff generation
- [ ] Error handling (not a repo, auth failures)

## Phase 3: Component Tests (Priority 🟢)

### UI Component Tests

**StreamingMarkdown** (`src/components/ui/streaming-markdown.test.tsx`)
- [ ] Renders markdown correctly
- [ ] XSS prevented (script tags stripped)
- [ ] Code blocks syntax highlighted
- [ ] Incremental updates work
- [ ] Performance with large content

**SessionView** (`tests/components/session-view.test.tsx`)
- [ ] Displays session output
- [ ] Status updates reflected
- [ ] Cancel button works
- [ ] Polling triggers refetch
- [ ] Error states shown

**GitWorkflow** (`tests/components/git-workflow.test.tsx`)
- [ ] File list renders
- [ ] Stage/unstage interactions
- [ ] Commit form submission
- [ ] Diff display
- [ ] Branch switching

## Phase 4: E2E Tests (Priority 🟢)

### User Workflows (`tests/e2e/workflows.test.ts`)

Test complete user journeys:
- [ ] Spawn agent and monitor to completion
- [ ] Create task with agent planner
- [ ] Assign task to agent executor
- [ ] Git workflow: stage → commit → push
- [ ] View codebase map
- [ ] Resume session with new message

**Example E2E Test:**
```typescript
describe('E2E: Agent Workflow', () => {
  it('should spawn, monitor, and complete agent task', async () => {
    // Navigate to spawn page
    await page.goto('http://localhost:4200')

    // Fill spawn form
    await page.fill('[name="prompt"]', 'What is 2 + 2?')
    await page.selectOption('[name="agentType"]', 'cerebras')
    await page.click('button[type="submit"]')

    // Should navigate to session page
    await page.waitForURL(/\/agents\/[a-f0-9]+/)

    // Wait for completion
    await page.waitForSelector('text=completed', { timeout: 30000 })

    // Verify output contains answer
    const content = await page.textContent('.session-output')
    expect(content).toContain('4')
  })
})
```

## Test Utilities to Create

### Mock Factories (`tests/utils/factories.ts`)
```typescript
export function createMockSession(overrides?: Partial<AgentSession>) {
  return {
    id: 'test-session-id',
    prompt: 'Test prompt',
    status: 'pending' as SessionStatus,
    startedAt: new Date().toISOString(),
    workingDir: '/test/dir',
    output: [],
    ...overrides
  }
}

export function createMockOutput(type: string, content: string) {
  return {
    type,
    content,
    timestamp: new Date().toISOString()
  }
}
```

### Test Helpers (`tests/utils/helpers.ts`)
```typescript
export async function waitForStatus(
  manager: AgentManager,
  sessionId: string,
  status: SessionStatus,
  timeout = 10000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const session = manager.getSession(sessionId)
    if (session?.status === status) return
    await sleep(100)
  }
  throw new Error(`Timeout waiting for status ${status}`)
}

export function createTestSessionStore(): SessionStore {
  // Returns isolated store for testing
}
```

## Coverage Goals

### Minimum Coverage Targets
- **Overall:** 70%
- **Critical Paths:** 90%
  - SessionStore: 95%
  - AgentManager: 90%
  - Tools (security): 95%
  - Git operations: 85%
- **UI Components:** 60%
- **Integration:** 70%

### Coverage Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.config.ts'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    }
  }
})
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run test:ci
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Test Documentation

Create `tests/README.md`:
- Overview of testing strategy
- How to run tests
- How to write new tests
- Common patterns and utilities
- Debugging test failures
- Continuous integration setup

## Success Criteria

- [ ] 70%+ overall code coverage
- [ ] 90%+ coverage on critical paths
- [ ] All security features tested
- [ ] CI pipeline runs tests on every PR
- [ ] Test suite runs in <2 minutes
- [ ] No flaky tests (95%+ reliability)
- [ ] Documentation for writing tests
- [ ] Examples of each test type

## Priority Order

1. **Week 1, Days 1-2:** Critical path unit tests
   - SessionStore (atomic writes, concurrency)
   - Tools (security: path traversal, command injection)
   - AgentManager (basic operations)

2. **Week 1, Days 3-4:** Integration tests
   - Agent lifecycle (Cerebras end-to-end)
   - tRPC procedures
   - Git service operations

3. **Week 1, Day 5:** Component tests
   - StreamingMarkdown (with XSS tests)
   - Key UI components

4. **Week 2:** E2E tests and polish
   - User workflow tests
   - CI/CD setup
   - Documentation
   - Coverage improvements

## Notes

- Start with security-critical tests (path traversal, XSS)
- Mock external dependencies (Cerebras API, CLI processes)
- Use real file system for integration tests (temp directories)
- Keep tests fast (<100ms per unit test)
- Isolate tests (no shared state)
- Use descriptive test names (BDD style: "should...")
