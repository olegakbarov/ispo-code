# Persist Agent State for Durable-Streams Resume

## Problem Statement
In durable-streams mode, Cerebras and OpenCode resumes start a fresh agent without prior conversation state, so follow-up messages lose context.

## Scope
- In scope: persist conversation state for SDK agents and restore it on resume.
- Out of scope: CLI resume behavior (already uses CLI session IDs).

## Implementation Plan
- [x] Define a session stream event for conversation state (for example `agent_state` with messages).
  - ✓ Verified: `AgentStateEvent` and `createSessionEvent.agentState` are defined in `src/streams/schemas.ts`.
- [ ] Publish state updates from the daemon for Cerebras and OpenCode after each turn.
  - ✗ Not found for OpenCode: state publishing is gated by `agent.getMessages` in `src/daemon/agent-daemon.ts`, and `OpencodeAgent` has no `getMessages` in `src/lib/agent/opencode.ts`.
- [x] On resume, reconstruct state from stream events and pass it into agent constructors.
  - ✓ Verified: latest `agent_state` is extracted in `src/trpc/agent.ts` and passed into daemon config, then applied in `src/daemon/agent-daemon.ts`.
- [x] Ensure state persists across server restarts and is bounded in size.
  - ✓ Verified: durable streams use file-backed storage in `src/streams/server.ts` with session reconstruction in `src/trpc/agent.ts`, and message pruning bounds stored state in `src/lib/agent/cerebras.ts` and `src/lib/agent/gemini.ts`.

## Key Files
- `src/daemon/agent-daemon.ts`
- `src/streams/schemas.ts`
- `src/streams/client.ts`
- `src/lib/agent/cerebras.ts`
- `src/lib/agent/opencode.ts`
- `src/trpc/agent.ts`

## Testing
- [ ] Run a Cerebras session, then send a follow-up; verify prior context influences response.
- [ ] Restart server and send a follow-up; verify state is preserved.

## Success Criteria
- [ ] SDK agents resume with prior conversation context in durable-streams mode.

## Verification Results
- ❌ OpenCode state updates are not published; the related implementation item is unchecked.
- ⚠️ Bounded state relies on agent message pruning; stream retention is still append-only.
- Tests not run (no completed test items to verify).
- Success criteria not yet verified.
