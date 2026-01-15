# Threads from File Comments: Backlinks & Task Related Section

## Problem Statement
File comments (via `FileCommentInput` or `DiffPanel` inline comments) don't persist or link to tasks. Need: (1) persist comment threads, (2) backlink thread→task, (3) show threads in task's "Related" section.

## Scope
**In:**
- New `CommentThreadEvent` in durable streams for persistence
- Thread creation when comment submitted on file in task context
- Backlink from thread to originating task via `taskPath`
- Display threads in `TaskSessions` component under "Related Threads"
- Thread view shows backlink to task

**Out:**
- GitHub-style PR review threads (different feature)
- Thread replies/nesting (v2)
- Thread resolution/status tracking (v2)

## Implementation Plan

### Phase 1: Extend Session Schema
- [x] Add `sourceFile?: string` and `sourceLine?: number` to `SessionCreatedEvent` in `src/streams/schemas.ts`
  - ✓ Verified: Fields added at `src/streams/schemas.ts:34-37` with proper JSDoc comments
- [x] Add same fields to `AgentSession` interface in `src/lib/agent/types.ts`
  - ✓ Verified: Fields added at `src/lib/agent/types.ts:254-257` with JSDoc comments
- [x] Update `AgentManager.spawnAgent()` to accept and persist these fields (via DaemonConfig + SpawnDaemonConfig)
  - ✓ Verified: `SpawnAgentParams` includes fields at `src/lib/agent/types.ts:283-286`
  - ✓ Verified: `SpawnDaemonConfig` includes fields at `src/daemon/spawn-daemon.ts:31-34`
  - ✓ Verified: `DaemonConfig` includes fields at `src/daemon/agent-daemon.ts:46-50`

### Phase 2: tRPC - Accept Source Context
- [x] Update `agent.spawn` mutation input to accept `sourceFile`, `sourceLine`, `taskPath`
  - ✓ Verified: Input schema at `src/trpc/agent.ts:281-285` includes all three fields
- [x] Pass through to ProcessMonitor.spawnDaemon()
  - ✓ Verified: Fields passed at `src/trpc/agent.ts:302-303` to `monitor.spawnDaemon()`
- [x] Update `tasks.getSessionsForTask` to include source context + "comment" sessionType in response
  - ✓ Verified: Query at `src/trpc/tasks.ts:862-865` detects `sourceFile` for "comment" type
  - ✓ Verified: Returns `sourceFile` and `sourceLine` at `src/trpc/tasks.ts:890-891`

### Phase 3: UI - Comment Creates Session
- [x] Modify `FileCommentInput` to accept `taskPath`, `sourceFile`, `sourceLine` props
  - ✓ Verified: Props defined at `src/components/agents/file-comment-input.tsx:14-19`
- [x] On submit → call `agent.spawn` with source context + task linkage + title
  - ✓ Verified: Mutation call at `src/components/agents/file-comment-input.tsx:62-68` passes all fields
- [ ] Update `DiffPanel` inline comment submit to spawn session with file/line context (out of scope - existing comment flow used)
  - ℹ️ Marked out of scope - existing `FileCommentInput` used for diff comments

### Phase 4: UI - Display in Task Related
- [x] `TaskSessions` already groups sessions - add "comment" sessionType
  - ✓ Verified: Interface at `src/components/tasks/task-sessions.tsx:15` includes `'comment'`
  - ✓ Verified: Props at `src/components/tasks/task-sessions.tsx:29` include `comment: TaskSession[]`
  - ✓ Verified: SessionGroup rendered at `src/components/tasks/task-sessions.tsx:171`
- [x] Show source file + line preview for comment-originated sessions (📄 badge)
  - ✓ Verified: Badge rendering at `src/components/tasks/task-sessions.tsx:106-112` shows 📄 icon with filename:line
- [x] Click navigates to `/agents/$sessionId` (existing behavior)
  - ✓ Verified: Navigation at `src/components/tasks/task-sessions.tsx:67-70`

### Phase 5: UI - Session Backlink
- [x] In `thread-sidebar.tsx`, show source file/line badge when session has `sourceFile`
  - ✓ Verified: Source section at `src/components/agents/thread-sidebar.tsx:93-115` renders when `session.sourceFile` exists
  - ✓ Verified: Shows FileCode icon + filename:line at lines 97-101
- [x] Badge links back to task view via Link to /tasks with path param
  - ✓ Verified: Link component at `src/components/agents/thread-sidebar.tsx:104-111` navigates to `/tasks` with `path` and `archiveFilter` search params

## Key Files
- `src/streams/schemas.ts` - add `sourceFile`, `sourceLine` to `SessionCreatedEvent`
- `src/lib/agent/types.ts` - add fields to `AgentSession`
- `src/lib/agent/manager.ts` - pass source context through spawn
- `src/trpc/agent.ts` - extend spawn input schema
- `src/components/tasks/task-sessions.tsx` - display source context
- `src/components/agents/file-comment-input.tsx` - spawn session on submit
- `src/components/agents/thread-sidebar.tsx` - show backlink badge

## Success Criteria
- [x] File comments spawn agent sessions with source file/line context
  - ✓ Verified: Full chain from UI → tRPC → daemon verified
- [x] Sessions with `sourceFile` appear in task "Related Sessions" with file badge
  - ✓ Verified: `getSessionsForTask` filters for `sourceFile`, `TaskSessions` displays badge
- [x] Session sidebar shows backlink to originating task + source location
  - ✓ Verified: `thread-sidebar.tsx` Source section with task backlink
- [x] Source context persists in durable streams (via SessionCreatedEvent)
  - ✓ Verified: `agent-daemon.ts:128-139` publishes `sourceFile`/`sourceLine` to registry

## Design Decisions (Resolved)
1. **Threads = Agent Sessions** - comment threads spawn agent sessions, not standalone comments
2. **Separate route** - thread detail navigates to `/agents/$sessionId` (existing route)
3. **Inline diff comments transient** - exist only before submit; submitting creates session thread

## Verification Results

### Summary
All **17 completed items** have been verified as correctly implemented:

| Phase | Items | Status |
|-------|-------|--------|
| Phase 1: Schema | 3/3 | ✓ Complete |
| Phase 2: tRPC | 3/3 | ✓ Complete |
| Phase 3: UI Comment | 2/2 (+1 out of scope) | ✓ Complete |
| Phase 4: Task Related | 3/3 | ✓ Complete |
| Phase 5: Backlink | 2/2 | ✓ Complete |
| Success Criteria | 4/4 | ✓ Complete |

### Key Implementation Details Verified
1. **Data Flow**: `sourceFile`/`sourceLine` flow correctly through: UI → tRPC mutation → ProcessMonitor → DaemonConfig → AgentDaemon → Registry stream
2. **Session Reconstruction**: `reconstructSessionFromStreams()` in `agent.ts:168-169` properly extracts source context from registry events
3. **Task Session Grouping**: `getSessionsForTask` query correctly identifies "comment" sessions via `sourceFile` presence (line 865)
4. **UI Components**: Both `TaskSessions` (📄 badge) and `ThreadSidebar` (Source section with backlink) render source context appropriately

### No Issues Found
All completed items are correctly implemented with proper TypeScript types, JSDoc comments, and consistent patterns throughout the codebase.