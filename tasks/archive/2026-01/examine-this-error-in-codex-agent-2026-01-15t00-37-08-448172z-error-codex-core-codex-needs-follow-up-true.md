# examine this error in codex agent - 2026-01-15T00:37:08.448172Z ERROR codex_core::codex: needs_follow_up: true

## Problem Statement
Codex CLI stderr line `ERROR codex_core::codex: needs_follow_up: true`; severity unclear
Error classifier only matches `error:`/`fatal:`/`exception:`; line likely routed as system text
Need source + handling so resumable UX accurate

## Scope
**In:**
- `src/lib/agent/cli-runner.ts` stderr parsing + codex output handling
- `src/lib/agent/manager.ts` resumable propagation
- `src/routes/agents/$sessionId.tsx` resume gating
- `src/trpc/agent.ts` resumable mapping for durable streams
**Out:**
- Codex CLI binary behavior
- Non-Codex agent flows
- UI redesign

## Implementation Plan

### Phase: Trace
- [x] Review Codex stderr handling in `src/lib/agent/cli-runner.ts`
- [x] Confirm `needs_follow_up` parsing in `src/lib/agent/cli-runner.ts`
- [x] Verify resumable updates in `src/lib/agent/manager.ts`
- [x] Verify resume gating in `src/routes/agents/$sessionId.tsx`
- [x] Check resumable mapping in `src/trpc/agent.ts`

### Phase: Resolve
- [x] Decide expected handling for `ERROR codex_core::codex` log line
- [x] ~~Update stderr classification in `src/lib/agent/cli-runner.ts`~~ (Not needed - current behavior correct)
- [x] ~~Add parsing test in `src/lib/agent/cli-runner.test.ts`~~ (Not needed - existing behavior validated)

## Investigation Findings

### Root Cause Identified
The line `2026-01-15T00:37:08.448172Z ERROR codex_core::codex: needs_follow_up: true` is **not an error** - it's a **diagnostic log line** from Codex CLI's internal Rust logging (using the `tracing` or `log` crate's ERROR level).

### How needs_follow_up Works
1. **JSON Output (src/lib/agent/cli-runner.ts:777-783)**: Codex emits `needs_follow_up` as a boolean field in JSON lines (e.g., `{"type":"thread.completed","needs_follow_up":true}`). This correctly updates `session.resumable`.

2. **Log Lines vs Structured Output**: The ERROR log is separate diagnostic output, not structured JSON. It passes through `isErrorMessage()` which only matches lowercase `error:` with colon (line 947-953), so it's classified as "system" text, not an error.

3. **Intentional Lenient Resume (src/lib/agent/manager.ts:45-47)**: The codebase deliberately allows resume attempts even when `needs_follow_up: false`. This is a design decision to let users retry rather than hard-blocking.

### Current Behavior Assessment
- ✅ JSON `needs_follow_up: false` → Updates `session.resumable = false` (correct)
- ✅ Manager allows resume attempts anyway (intentional design)
- ✅ ERROR log line → Classified as "system" text (doesn't trigger error state)
- ⚠️ ERROR log line with uppercase "ERROR" looks alarming but isn't harmful

### Recommendation: No Code Changes Required

**Why no changes?**
1. The log line is correctly classified as "system" text (not an error) because it lacks the `error:` pattern
2. The structured JSON `needs_follow_up` field is properly parsed and tracked
3. The lenient resume policy is intentional and documented
4. Making `isErrorMessage()` match uppercase "ERROR" would create false positives for legitimate log output

**Alternative: Suppress Diagnostic Logs**
If these log lines are visually distracting, consider:
- Setting `RUST_LOG=warn` or similar environment variable for Codex CLI to reduce log verbosity
- Filtering stderr lines that match the pattern `^\d{4}-\d{2}-\d{2}T.*?(ERROR|WARN|INFO|DEBUG|TRACE)` (timestamp + log level)
- Adding a separate log level classifier that routes DEBUG/INFO/WARN/ERROR logs to a "debug" output type instead of "system"

**Decision**: Current behavior is correct. No code changes needed unless UX feedback indicates log lines are confusing users.

## Key Files
- `src/lib/agent/cli-runner.ts` - codex stderr + output parsing
- `src/lib/agent/manager.ts` - resumable state updates
- `src/routes/agents/$sessionId.tsx` - resume gating logic
- `src/trpc/agent.ts` - resumable default for streams
- `src/lib/agent/cli-runner.test.ts` - new stderr parsing coverage

## Success Criteria
- [x] Root cause for `ERROR codex_core::codex: needs_follow_up: true` identified
- [x] Stderr handling reflects expected severity for codex logs (currently working as intended)
- [x] Resume UX consistent with codex `needs_follow_up` signals (intentionally lenient)

## Resolved Questions
- **Codex CLI version + flags**: Using `codex exec --json` or `codex resume <id> --json` (see cli-runner.ts:544-562)
- **Log source**: Stderr (line appears on stderr stream, see cli-runner.ts:432)
- **Expected UX**: `needs_follow_up: true` means session accepts more input; `false` means it's done. The ERROR log is just diagnostic output from Codex's internal logging and should be treated as informational, not an actual error.

## Summary

**Status**: ✅ Investigation complete - No action required

The "ERROR" log line is working as intended. The system correctly:
1. Parses structured JSON `needs_follow_up` field to track resumability (cli-runner.ts:777-783)
2. Routes Rust log lines to "system" output rather than error state (cli-runner.ts:947-953)
3. Allows resume attempts even when `needs_follow_up: false` (intentional lenient policy in manager.ts:45-47)

The log line may look alarming to users, but it's not causing any functional issues. If UX feedback indicates it's confusing, consider implementing the "Suppress Diagnostic Logs" alternatives mentioned above.

### Flow Diagram

```
Codex CLI Output (2 streams)
├─ stdout: JSON lines
│  └─ {"type":"thread.completed","needs_follow_up":true}
│     └─ parseCodexOutput() → emit("resumable", true)
│        └─ manager.ts: session.resumable = true
│
└─ stderr: Log lines
   └─ "2026-01-15T00:37:08.448172Z ERROR codex_core::codex: needs_follow_up: true"
      └─ isErrorMessage() → false (no "error:" pattern)
         └─ emit("system", line) ✅ Shown as info, not error

Resume UX Flow:
1. User clicks resume → isSessionResumable()
2. Check: status !== "cancelled" ✅
3. Check: session.cliSessionId exists ✅
4. Intentionally ignore session.resumable === false
5. Allow resume attempt (CLI will reject if truly impossible)
```
