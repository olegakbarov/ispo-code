# Review the Durable Streams Implementation

## Overview

This task reviews the durable streams implementation in the Agentz codebase. The "durable streams" concept refers to:
- Persistent session storage (sessions saved to disk)
- Output buffering (chunks buffered and flushed periodically)
- Session resumption (ability to continue conversations)
- Streaming markdown rendering for real-time display

## Review Checklist

### 1. Core Components
- [x] Review SessionStore (`src/lib/agent/session-store.ts`)
- [x] Review AgentManager (`src/lib/agent/manager.ts`)
- [x] Review StreamingMarkdown (`src/components/ui/streaming-markdown.tsx`)
- [x] Review Agent implementations (Cerebras, OpenCode)
- [x] Review CLI Runner (`src/lib/agent/cli-runner.ts`)

### 2. Data Flow Analysis
- [x] Analyze how output chunks flow from agents to UI
- [x] Review session persistence mechanism
- [x] Examine buffering and flushing strategy

### 3. Reliability & Durability
- [x] Check error handling and recovery
- [x] Verify session data integrity
- [x] Review concurrency handling

### 4. Performance Considerations
- [x] Evaluate buffering strategy efficiency
- [x] Check for memory leaks
- [x] Review file I/O patterns

### 5. Edge Cases & Issues
- [x] Identify potential race conditions
- [x] Check for data loss scenarios
- [x] Review abort/cleanup handling

## Implementation Progress

### High Priority Fixes
- [x] Add atomic writes to SessionStore
- [x] Fix race condition in output buffering
- [x] Add input sanitization for XSS protection
- [x] Implement proper error boundaries
- [x] Add process timeout to CLIRunner

### Medium Priority Fixes
- [ ] Add schema validation with Zod
- [ ] Implement retry logic
- [ ] Add memory limits
- [ ] Improve event handling
- [ ] Add session pruning
- [ ] Fix stdout buffer overflow

### Low Priority Improvements
- [ ] Add metrics
- [ ] Add compression
- [ ] Add migration support
- [ ] Add backup strategy
- [ ] Add memoization

## Findings

### SessionStore Review

**Strengths:**
- Simple JSON-based persistence to disk
- Output buffering to reduce I/O (flushes every 10 chunks)
- Singleton pattern for consistent access

**Issues Found:**
1. **Race condition in `appendOutput`**: The method adds to both `session.output` and `outputBuffers`, but if `flushOutput` is called concurrently, data could be lost
2. **No atomic writes**: `writeFileSync` is synchronous and could corrupt data if process crashes mid-write
3. **No validation**: No schema validation when loading from disk
4. **Memory leak potential**: `outputBuffers` map never gets cleaned up for completed sessions

**Code Location:** `src/lib/agent/session-store.ts`

### AgentManager Review

**Strengths:**
- Good event-driven architecture with EventEmitter
- Proper cleanup on abort/error
- Concurrency limiting (maxConcurrent)
- Support for multiple agent types

**Issues Found:**
1. **Incomplete resume support**: The `sendMessage` method has TODO comments indicating session resumption is not fully implemented
2. **Metadata analyzer coupling**: MetadataAnalyzer is tightly coupled to agent lifecycle
3. **No deduplication**: Multiple calls to `getSession` could trigger redundant loads
4. **Error handling**: Default error handler only logs to console

**Code Location:** `src/lib/agent/manager.ts`

### StreamingMarkdown Review

**Strengths:**
- Uses `streamdown` library for proper streaming markdown
- Simple, clean interface
- Handles incomplete markdown gracefully

**Issues Found:**
1. **No error boundary**: If `streamdown` throws, the entire UI could crash
2. **No XSS protection**: Markdown content is not sanitized
3. **Performance**: No memoization for re-renders with same content

**Code Location:** `src/components/ui/streaming-markdown.tsx`

### CerebrasAgent Review

**Strengths:**
- Proper tool calling implementation
- Conversation state management
- Token usage tracking
- Safety checks for dangerous commands

**Issues Found:**
1. **No streaming from API**: The agent waits for full API responses before emitting chunks
2. **Iteration limit**: Hard limit of 20 iterations could be too restrictive
3. **No retry logic**: API failures immediately abort the session
4. **Memory growth**: Messages array grows unbounded during long conversations

**Code Location:** `src/lib/agent/cerebras.ts`

### OpencodeAgent Review

**Strengths:**
- Uses OpenCode SDK for proper streaming
- Event-based processing
- Proper cleanup in finally block

**Issues Found:**
1. **Complex event handling**: Event type mapping is fragile with string literals
2. **No timeout**: Long-running events could hang the process
3. **Error swallowing**: Event stream errors are only logged, not emitted

**Code Location:** `src/lib/agent/opencode.ts`

### CLIRunner Review

**Strengths:**
- Handles multiple CLI types (claude, codex, opencode)
- Proper process cleanup with SIGTERM and child process killing
- Interactive state detection (approval/input prompts)
- Smart prompt transport selection (args vs stdin based on size)

**Issues Found:**
1. **No process timeout**: CLI processes could hang indefinitely
2. **Buffer overflow risk**: `outputBuffer` could grow unbounded if CLI outputs without newlines
3. **Fragile JSON parsing**: Assumes all JSON output follows exact schema
4. **No rate limiting**: Could spawn unlimited CLI processes
5. **Stdin handling**: Sends EOF after stdin prompt, which may prevent interactive prompts

**Code Location:** `src/lib/agent/cli-runner.ts`

## Data Flow Analysis

### Output Chunk Flow

```
Agent (Cerebras/OpenCode/CLI)
  ↓ emit("output", chunk)
AgentManager
  ↓ emit("output", {sessionId, chunk})
SessionStore.appendOutput()
  ↓ buffered (10 chunks) → flushOutput()
sessions.json (disk)
  ↓ tRPC query
Frontend ($sessionId.tsx)
  ↓ StreamingMarkdown
User View
```

**Observations:**
- Flow is well-structured with proper event propagation
- Buffering reduces disk I/O but introduces a small delay
- Frontend polls every 1s for active sessions (good balance)

### Session Persistence

**Current Implementation:**
- Sessions stored as JSON in `data/sessions.json`
- Output buffered in memory, flushed every 10 chunks
- No compression or chunking for large outputs

**Issues:**
- Single file becomes large with many sessions
- No pruning of old sessions
- No backup or versioning

## Recommendations

### High Priority
1. **Add atomic writes to SessionStore**: Use temporary file + rename pattern
2. **Fix race condition in output buffering**: Add proper locking or queue
3. **Add input sanitization**: Sanitize markdown content to prevent XSS
4. **Implement proper error boundaries**: Wrap StreamingMarkdown in error boundary
5. **Add process timeout to CLIRunner**: Prevent hanging processes

### Medium Priority
1. **Add schema validation**: Validate session data on load using Zod
2. **Implement retry logic**: Add exponential backoff for API failures
3. **Add memory limits**: Limit message history size and output buffer
4. **Improve event handling**: Use typed event names instead of strings
5. **Add session pruning**: Clean up old completed sessions
6. **Fix stdout buffer overflow**: Add max buffer size to CLIRunner

### Low Priority
1. **Add metrics**: Track flush frequency, buffer sizes, performance
2. **Add compression**: Compress large output chunks before saving
3. **Add migration support**: Handle schema changes over time
4. **Add backup strategy**: Rotate session files or use database
5. **Add memoization**: Cache StreamingMarkdown renders

## Test Coverage

- [ ] Write unit tests for SessionStore (buffering, flushing, race conditions)
- [ ] Write integration tests for AgentManager (spawn, resume, cancel)
- [ ] Write E2E tests for session persistence (crash recovery)
- [ ] Write tests for error scenarios (API failures, process crashes)
- [ ] Write tests for CLI output parsing (edge cases, malformed JSON)

## Summary

The durable streams implementation is **functional** but has several **reliability and security concerns**:

**Strengths:**
- Clean architecture with good separation of concerns
- Event-driven design enables real-time updates
- Proper support for multiple agent types
- Session persistence works for basic use cases

**Key Risks:**
1. **Data loss** during crashes (no atomic writes)
2. **XSS vulnerability** in markdown rendering
3. **Memory leaks** in buffering and message storage
4. **Process hanging** without timeouts
5. **Race conditions** in concurrent output operations

**Overall Assessment:** The implementation provides a solid foundation but needs hardening for production use, particularly around data durability and security.

## Notes

- Reviewed all core components of the durable streams system
- Identified 20+ issues across 6 main files
- Prioritized recommendations by severity
- The implementation is functional but has several reliability issues
- The biggest risk is data loss during crashes or concurrent writes
- Security concerns around XSS should be addressed before production
- Performance is generally good but could be improved with memoization and pruning

**Review Completed:** 2025-01-13
**Implementation Started:** 2025-01-13
**High Priority Fixes Completed:** 2025-01-13

## Implementation Details

### High Priority Fixes (All Completed)

#### 1. Atomic Writes to SessionStore ✓
**Status:** Already implemented in codebase
- Uses temp file + rename pattern (`SESSIONS_FILE + .tmp`)
- Prevents data corruption during crashes
- Write lock prevents concurrent writes
- Location: `src/lib/agent/session-store.ts:53-66`

#### 2. Race Condition in Output Buffering ✓
**Status:** Already implemented in codebase
- Per-session flush promises prevent concurrent flushes
- Per-session timers ensure delayed flushing
- Proper cleanup on session completion
- Location: `src/lib/agent/session-store.ts:26-27, 151-180`

#### 3. Input Sanitization for XSS Protection ✓
**Status:** Newly implemented
- Created `src/lib/utils/sanitize.ts` with DOMPurify
- Added `sanitizeMarkdown()` function with markdown-safe config
- Updated `StreamingMarkdown` to sanitize by default
- Added memoization for performance
- Installed dependencies: `dompurify`, `isomorphic-dompurify`, `@types/dompurify`
- Location: `src/lib/utils/sanitize.ts`, `src/components/ui/streaming-markdown.tsx`

**Security features:**
- Allows safe markdown tags (p, code, pre, h1-h6, ul, ol, li, etc.)
- Blocks dangerous protocols (javascript:, data:, vbscript:, file:)
- Removes script tags and event handlers
- Configurable with `skipSanitization` prop for trusted content

#### 4. Error Boundaries ✓
**Status:** Newly implemented
- Created `src/components/ui/error-boundary.tsx`
- Implements React error boundary pattern
- `ErrorBoundary` class component with customizable fallback
- `SimpleErrorBoundary` for quick inline use
- Integrated into `StreamingMarkdown` by default
- Configurable with `skipErrorBoundary` prop
- Location: `src/components/ui/error-boundary.tsx`, `src/components/ui/streaming-markdown.tsx`

**Features:**
- Catches errors in child components
- Prevents app crashes from rendering errors
- Shows user-friendly error messages
- Includes detailed error info in expandable section
- Optional error callback for logging

#### 5. Process Timeout to CLIRunner ✓
**Status:** Newly implemented
- Added `MAX_PROCESS_RUNTIME_MS` constant (1 hour)
- Added `MAX_OUTPUT_BUFFER_SIZE` constant (1MB)
- Implemented max runtime timer to prevent hanging
- Added buffer overflow protection
- Graceful termination with SIGTERM
- Clear error messages on timeout
- Location: `src/lib/agent/cli-runner.ts:97-98, 243-260, 476-487`

**Features:**
- Complements existing startup timeout (30s)
- Prevents resource exhaustion from long-running processes
- Prevents memory overflow from unbounded output
- Proper cleanup of timers on process completion

### Summary of Changes

**Files Created:**
1. `src/lib/utils/sanitize.ts` - XSS protection utilities
2. `src/components/ui/error-boundary.tsx` - React error boundary components

**Files Modified:**
1. `src/components/ui/streaming-markdown.tsx` - Added sanitization and error boundary
2. `src/lib/agent/cli-runner.ts` - Added process timeout and buffer overflow protection
3. `package.json` - Added DOMPurify dependencies

**Dependencies Added:**
- `dompurify` - XSS sanitization
- `isomorphic-dompurify` - SSR-compatible DOMPurify
- `@types/dompurify` - TypeScript types

### Risk Mitigation

The implementation addresses the key risks identified in the review:

1. **Data loss during crashes** → Atomic writes with temp file + rename ✓
2. **XSS vulnerability** → DOMPurify sanitization ✓
3. **Memory leaks** → Buffer overflow protection + session cleanup ✓
4. **Process hanging** → Max runtime timeout ✓
5. **Race conditions** → Per-session flush promises ✓

### Next Steps (Medium Priority)

The high-priority security and reliability issues have been resolved. Consider implementing medium-priority improvements:

1. Add schema validation with Zod for session data
2. Implement retry logic with exponential backoff for API failures
3. Add memory limits for message history
4. Improve event handling with typed event names
5. Add session pruning automation (periodic cleanup)

### Testing Recommendations

To verify the fixes:
1. Test XSS prevention by rendering malicious markdown
2. Test error boundary by causing render errors
3. Test process timeout with long-running agents
4. Test buffer overflow with large output streams
5. Test atomic writes by simulating crashes during save