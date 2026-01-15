# Persist Agent State for Durable-Streams Resume

## Problem Statement
In durable-streams mode, Cerebras and OpenCode resumes start a fresh agent without prior conversation state, so follow-up messages lose context.

## Scope
- In scope: persist conversation state for SDK agents and restore it on resume.
- Out of scope: CLI resume behavior (already uses CLI session IDs).

## Implementation Plan
- [ ] Define a session stream event for conversation state (for example `agent_state` with messages).
- [ ] Publish state updates from the daemon for Cerebras and OpenCode after each turn.
- [ ] On resume, reconstruct state from stream events and pass it into agent constructors.
- [ ] Ensure state persists across server restarts and is bounded in size.

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
