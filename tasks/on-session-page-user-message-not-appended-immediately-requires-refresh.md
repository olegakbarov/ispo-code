# on session page user message not appended immediately, requires refresh

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: On `/agents/$sessionId`, sending a follow-up message (resume) does not show the user message in the output stream until a manual refresh.
- **Immediate Cause**: `trpc.agent.sendMessage` only spawns a daemon and returns; the UI reads output from durable streams but stops polling when the session is in a terminal state, so the new output is never fetched.
- **Call Chain**: `src/routes/agents/$sessionId.tsx` `handleResume` -> `trpc.agent.sendMessage` mutation -> `src/trpc/agent.ts` `sendMessage` spawns daemon -> `src/daemon/agent-daemon.ts` publishes user_message/output later -> UI query stays stale because polling is disabled for terminal status in `src/lib/hooks/use-adaptive-polling.ts`.
- **Original Trigger**: Session status is `completed/failed/cancelled`, so `useAdaptivePolling` returns `refetchInterval: false`; `resumeMutation.onSuccess` does a single `refetch()` before the daemon writes stream events, leaving the cache stale until a manual refresh.
- **Evidence**: `src/routes/agents/$sessionId.tsx` uses `useAdaptivePolling` and only calls `refetch()` on resume; `src/trpc/agent.ts` `sendMessage` does not append to streams; `src/daemon/agent-daemon.ts` publishes user_message asynchronously; `src/lib/hooks/use-adaptive-polling.ts` disables polling on terminal status.

### Phase 2: Pattern Analysis
- **Working Examples**: TBD
- **Key Differences**: TBD
- **Dependencies**: TBD

### Phase 3: Hypothesis & Testing
- **Hypothesis**: TBD
- **Test Design**: TBD
- **Prediction**: TBD
- **Result**: TBD
- **Conclusion**: TBD

### Phase 4: Implementation
- **Root Cause**: TBD
- **Solution**: TBD
- **Test Case**: TBD
- **Verification**: TBD
- **Changes Made**: TBD

## Success Criteria
- [ ] Root cause identified and documented
- [ ] Fix addresses root cause (not symptoms)
- [ ] Test created reproducing bug
- [ ] All tests pass
