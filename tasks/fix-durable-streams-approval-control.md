# Fix Durable Streams Approval Control

## Problem Statement
Durable-streams sessions can enter waiting_approval or waiting_input but never recover because approval responses are written to a control stream that the daemon does not read, and the tRPC handler calls a missing StreamAPI method. This blocks CLI agents that require approvals.

## Scope
- In scope: control stream append API, daemon control loop, approval and input handling, status updates.
- Out of scope: replacing durable streams or redesigning the UI.

## Implementation Plan
- [ ] Add a control-stream append API in `StreamAPI` (or explicit `appendToControl`) and update `agent.approve` to use it.
- [ ] Implement control stream polling or subscription in `AgentDaemon` to consume `approval_response`, `input_response`, and `cancel` events.
- [ ] Wire control events to `CLIAgentRunner.sendApproval`, `sendInput`, and `abort`, and publish status updates back to streams.
- [ ] Add minimal retry or backoff for control stream reads to avoid losing approvals.

## Key Files
- `src/trpc/agent.ts`
- `src/streams/client.ts`
- `src/streams/schemas.ts`
- `src/daemon/agent-daemon.ts`
- `src/lib/agent/cli-runner.ts`

## Testing
- [ ] Run a CLI session that requires approval; verify approval unblocks the session.
- [ ] Trigger waiting_input and verify input is delivered.
- [ ] Send cancel via control stream and verify daemon exits and status updates.

## Success Criteria
- [ ] Approval and input actions work end-to-end in durable-streams mode.
- [ ] No calls to missing StreamAPI methods.
- [ ] Session status transitions back to running after approval.
