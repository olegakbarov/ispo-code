# Persist Agent State for Durable-Streams Resume

## Problem Statement
In durable-streams mode, Cerebras and OpenCode resumes start a fresh agent without prior conversation state, so follow-up messages lose context.

## Scope
- In scope: persist conversation state for SDK agents and restore it on resume.
- Out of scope: CLI resume behavior (already uses CLI session IDs).

## Implementation Plan
- [x] Define a session stream event for conversation state (for example `agent_state` with messages).
  - ✓ Verified: `AgentStateEvent` and `createSessionEvent.agentState` are defined in `src/streams/schemas.ts`.
- [x] Publish state updates from the daemon for Cerebras and OpenCode after each turn.
  - ✓ Implemented: Added `getMessages()` method to `OpencodeAgent` in `src/lib/agent/opencode.ts` that tracks conversation history locally. State publishing logic in `src/daemon/agent-daemon.ts:394-404` now works for all SDK agents (Cerebras, Gemini, OpenCode).
  - ✓ Added `OpencodeMessageData` type to `src/lib/agent/types.ts` for type safety.
  - ✓ Updated agent constructor in `src/daemon/agent-daemon.ts:302-309` to pass `reconstructedMessages` to OpenCode.
- [x] On resume, reconstruct state from stream events and pass it into agent constructors.
  - ✓ Verified: latest `agent_state` is extracted in `src/trpc/agent.ts` and passed into daemon config, then applied in `src/daemon/agent-daemon.ts`.
- [x] Ensure state persists across server restarts and is bounded in size.
  - ✓ Verified: durable streams use file-backed storage in `src/streams/server.ts` with session reconstruction in `src/trpc/agent.ts`, and message pruning bounds stored state in `src/lib/agent/cerebras.ts` and `src/lib/agent/gemini.ts`.
  - ⚠️ Note: OpenCode does not have built-in message pruning yet (unlike Cerebras/Gemini), but it tracks messages locally for resume support.

## Key Files
- `src/daemon/agent-daemon.ts`
- `src/streams/schemas.ts`
- `src/streams/client.ts`
- `src/lib/agent/cerebras.ts`
- `src/lib/agent/opencode.ts`
- `src/trpc/agent.ts`

## Testing
**Status**: Ready for manual testing. All implementation is complete and build passes.

To test:
- [ ] Run a Cerebras session, then send a follow-up; verify prior context influences response.
- [ ] Restart server and send a follow-up; verify state is preserved.
- [ ] Run an OpenCode session, then send a follow-up; verify prior context influences response.

**How to test**:
1. Start dev server: `npm run dev`
2. Create a Cerebras/OpenCode session with initial prompt: "Remember this number: 42"
3. Send follow-up in same session: "What number did I tell you to remember?"
4. Verify response references "42" (proves conversation context preserved)
5. For server restart test: Stop server, restart, then send follow-up

## Success Criteria
- [x] SDK agents resume with prior conversation context in durable-streams mode.
  - ✓ All SDK agents (Cerebras, Gemini, OpenCode) now implement `getMessages()` method.
  - ✓ State publishing logic publishes conversation state after each turn completion.
  - ✓ State reconstruction logic passes messages to agent constructors on resume.
  - ✓ Build succeeds with no TypeScript errors.

## Implementation Summary

### Changes Made
1. **Added message tracking to OpencodeAgent** (`src/lib/agent/opencode.ts`):
   - Added `messages` and `currentAssistantMessage` properties to track conversation history
   - Modified `run()` method to append user messages to history
   - Modified event processing to accumulate assistant text responses
   - Added `getMessages()` method to return conversation history for state publishing
   - Updated constructor to accept `messages` parameter for resume support

2. **Added OpencodeMessageData type** (`src/lib/agent/types.ts`):
   - Defined simple message format with `role` and `content` fields
   - Exported for use in daemon and agent implementations

3. **Updated agent daemon** (`src/daemon/agent-daemon.ts`):
   - Imported `OpencodeMessageData` type
   - Updated `SDKAgentLike` interface to include `OpencodeMessageData[]` in return type
   - Modified OpenCode agent creation to pass `reconstructedMessages` parameter

### How It Works
1. **During execution**: When OpenCode agent runs, it tracks all user/assistant messages locally
2. **On completion**: The daemon's `complete` event handler checks for `getMessages()` and publishes the conversation state to the session stream
3. **On resume**: The tRPC layer reconstructs the latest agent state from stream events and passes it to the daemon config
4. **On next execution**: The agent constructor receives the reconstructed messages and continues from where it left off

### Testing Notes
- Manual testing recommended to verify:
  - Cerebras/OpenCode sessions maintain context across resume
  - Server restarts preserve conversation state
  - Follow-up messages have access to prior conversation history

## Verification Summary (2026-01-15)

### Code Review
✅ **All implementation steps completed**:
- OpencodeAgent tracks conversation history locally via `messages` array
- Constructor accepts `messages` parameter for resume support
- `getMessages()` method returns conversation state
- Daemon publishes agent state after each turn completion
- tRPC reconstructs state from stream events and passes to agent constructors
- Build succeeds with no TypeScript errors

### Architecture Verification
✅ **Message flow confirmed**:
1. **Execution**: Agent tracks user/assistant messages in local array
2. **Completion**: Daemon calls `agent.getMessages()` and publishes to session stream
3. **Storage**: Durable streams persist events to disk (`.agentz/streams/`)
4. **Resume**: tRPC reads latest `agent_state` event from stream
5. **Initialization**: Daemon passes reconstructed messages to agent constructor

### Type Safety
✅ **Type consistency verified**:
- `OpencodeMessageData` defined in `src/lib/agent/types.ts:234-237`
- Used in OpencodeAgent constructor, getMessages(), and daemon
- Matches Cerebras/Gemini pattern for agent-specific message formats

### Next Steps
**Ready for user acceptance testing**. Implementation is complete, type-safe, and follows established patterns. Manual testing required to verify runtime behavior.
