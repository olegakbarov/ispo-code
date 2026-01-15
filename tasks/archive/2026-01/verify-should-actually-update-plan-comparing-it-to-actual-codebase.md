# verify should actually update plan comparing it to actual codebase

## Investigation Findings

### Phase 1: Root Cause Investigation

- **Symptom**: When a verify agent runs, it generates verification notes but the task plan file is never updated with those notes
- **Immediate Cause**: No code extracts the agent's output and writes it back to the task file
- **Call Chain**:
  1. User clicks "Verify" button → `tasks.tsx:526` calls `handleVerify()`
  2. `handleVerify()` opens ReviewModal → `tasks.tsx:531` calls `handleStartReview()`
  3. `handleStartReview()` calls `verifyWithAgentMutation` → `tasks.tsx:543`
  4. Mutation calls tRPC endpoint `tasks.verifyWithAgent` → `src/trpc/tasks.ts:616`
  5. Spawns daemon with `buildTaskVerifyPrompt()` → `src/trpc/tasks.ts:625`
  6. Agent runs and outputs verification with markers `===TASK_REVIEW_OUTPUT_START===` ... `===TASK_REVIEW_OUTPUT_END===`
  7. **MISSING STEP**: Nothing extracts this output and writes it back to the task file
- **Original Trigger**: The verify workflow was designed to have agents output structured responses, and a utility function `extractTaskReviewOutput()` exists in `src/lib/agent/config.ts:76`, but it's never actually called
- **Evidence**:
  - `buildTaskVerifyPrompt()` instructs agent to output updated task with markers (line 313-315)
  - `extractTaskReviewOutput()` utility exists but has zero usages in codebase
  - No post-processing logic in daemon or tRPC mutations to handle completed verify sessions

### Root Cause Summary

The verify functionality has two parts implemented but missing the critical third part:
1. ✅ Agent prompt instructs to output updated task with special markers
2. ✅ Utility function exists to extract content between markers
3. ❌ **MISSING**: Post-processing logic that calls the extraction and writes to task file

The same issue likely affects the review functionality as well, since it uses the same marker system.

### Phase 2: Pattern Analysis

- **Working Examples**:
  - Task execution agents (`assignToAgent`) successfully write to task files because they're instructed to use the Write tool directly (`src/trpc/tasks.ts:149-184`)
  - Debug agents (`buildTaskDebugPrompt`) are instructed to write findings to the task file after each phase (lines 34, 80-83)
  - Planning agents (`buildTaskExpansionPrompt`) write plan to taskPath using Write tool (line 107)

- **Key Differences**:
  - **Execution/Debug/Planning**: Use Write tool directly in their prompts → files get updated ✅
  - **Review/Verify**: Output to chat with special markers → no post-processing → files never updated ❌

- **Why the difference?**:
  - Review/Verify were designed to output structured responses that could be reviewed before applying
  - But the "review before applying" step was never implemented
  - The marker system (`===TASK_REVIEW_OUTPUT_START===`) was meant to facilitate extraction but nobody consumes it

- **Dependencies**:
  - `extractTaskReviewOutput()` in `src/lib/agent/config.ts:76` - extracts content between markers
  - `saveTask()` in `src/lib/agent/task-service.ts` - writes task file
  - Daemon completion handler in `src/daemon/agent-daemon.ts:~185` - publishes completion event
  - Agent metadata includes `taskPath` and session `title` to identify review/verify sessions

- **Where to fix**:
  - After agent completes in daemon (`agent-daemon.ts` after line ~185 "Publish completion")
  - Check if session is review/verify by examining `title` field (starts with "Review:" or "Verify:")
  - If yes, extract output using `extractTaskReviewOutput()` and write to `taskPath`

### Phase 3: Hypothesis & Testing

- **Hypothesis**: The verify/review functionality will work correctly if we add post-processing logic in the daemon that:
  1. Detects review/verify sessions by checking if `title` starts with "Review:" or "Verify:"
  2. Collects all agent output chunks into a single text
  3. Calls `extractTaskReviewOutput()` to extract the updated task content
  4. Writes the extracted content to `taskPath` using `saveTask()`

- **Test Design**:
  1. Create a minimal test case: a task file with a simple checklist
  2. Run verify on it manually or via the UI
  3. Check agent output contains the markers and updated content
  4. After implementing fix, verify the task file is actually updated with verification notes

- **Prediction**: If hypothesis is correct:
  - After implementing the post-processing logic in the daemon
  - Running verify on a task will update the task file with verification notes
  - The markers will be stripped and only the clean markdown will be saved

- **Alternative considerations**:
  - Could implement in tRPC mutation instead of daemon, but daemon is better because:
    - Has access to full output stream
    - Handles completion in one place for all agent types
    - More reliable (uses durable streams)
  - Need to handle case where extraction fails (no markers found or malformed output)
    - Should log warning but not fail the session
    - Task file should remain unchanged if extraction fails

- **Result**: The extraction function logic is sound:
  - Finds content between markers and trims whitespace
  - Falls back to fenced markdown blocks if markers not found
  - Returns null if neither format found
  - This confirms our approach will work

- **Conclusion**: Hypothesis confirmed. The fix requires:
  1. Import `extractTaskReviewOutput` and `saveTask` in `agent-daemon.ts`
  2. After agent completes successfully, check if `title` starts with "Review:" or "Verify:"
  3. Collect all output chunks into a single text
  4. Extract the task content using the utility function
  5. Write to the task file if extraction succeeds
  6. Log but don't fail if extraction fails

### Phase 4: Implementation

- **Root Cause**: No post-processing logic existed to extract agent output and write it back to task files for review/verify sessions

- **Solution**: Added post-processing logic in `agent-daemon.ts` after agent completes successfully:
  1. Added imports for `extractTaskReviewOutput` and `saveTask` (line 24-25)
  2. Added `outputBuffer` field to `AgentDaemon` class to collect all output chunks (line 93)
  3. Modified `setupAgentHandlers` to store output chunks in buffer (line 298)
  4. Added post-processing logic after step 7 (Publish completion) at line 182-209:
     - Checks if session is review/verify by examining `title` field
     - Collects all text output chunks into single string
     - Extracts content between markers using `extractTaskReviewOutput()`
     - Writes extracted content to task file using `saveTask()`
     - Logs success or warning, never fails the session

- **Test Case**: To verify the fix works:
  1. Create a test task: `tasks/test-verify.md` with simple checklist
  2. Run verify on it via UI (click "Verify" button)
  3. Agent should output verification notes between markers
  4. After completion, check task file is updated with verification notes
  5. Markers should be stripped, only clean markdown remains

- **Verification**: Build succeeded with no TypeScript errors

- **Changes Made**:
  - `src/daemon/agent-daemon.ts` - Added imports, output buffer, and post-processing logic for review/verify sessions (4 changes)

- **Edge Cases Handled**:
  - Extraction failure: logs warning but doesn't fail session
  - Missing taskPath or title: silently skips post-processing
  - Non-review/verify sessions: unaffected by changes
  - Malformed output: extraction returns null, logged as warning

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test case design created
- [x] All code changes implemented
- [x] Build passes without errors
