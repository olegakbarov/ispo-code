# changed files on preview page are extremely slow to load. lets systematically address this issue

<!-- autoRun: true -->

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: Changed files list on the preview/review page takes a long time to appear.
- **Immediate Cause**: `tasks.getReviewData` fans out to `agent.getChangedFiles` per session, and `getChangedFiles` always reads the full session stream (via `reconstructSessionFromStreams`) even when the registry already contains `metadata.editedFiles`.
- **Call Chain**: `TaskReviewPanel` → `trpc.tasks.getReviewData` → `agentRouter.getChangedFiles` → `streamAPI.readRegistry` + `streamAPI.readSession` → `reconstructSessionFromStreams` → `reconstructEditedFilesFromChunks`.
- **Original Trigger**: `getChangedFiles` requires a full session reconstruction to access metadata, which forces a full session stream read for every session on review/preview load.
- **Evidence**: `src/trpc/agent.ts` reads `readSession()` before it checks `session.metadata.editedFiles`, and `src/trpc/tasks.ts` calls `getChangedFiles` in parallel for each task session.

### Phase 2: Pattern Analysis
- **Working Examples**:
  - `src/trpc/stats.ts` aggregates `metadata.editedFiles` from registry events without reading session streams.
  - `src/daemon/agent-daemon.ts` publishes session metadata (including `editedFiles`) on completion/failure.
- **Key Differences**:
  - `getChangedFiles` always reads `readSession()` and reconstructs output; stats/metrics avoid session reads by using registry metadata.
  - Review data path is optimized for parallelism but still pays full session stream cost per session.
- **Dependencies**:
  - Registry events (`SessionCreatedEvent`, `SessionCompletedEvent`, `SessionFailedEvent`) for metadata and workingDir.
  - Session stream only needed when metadata is absent (running sessions).
  - `calculateRelativePaths` for `relativePath`/`repoRelativePath` reconstruction when parsing tool_use chunks.

### Phase 3: Hypothesis & Testing
- **Hypothesis**: The slow preview/review load occurs because `agent.getChangedFiles` always reads full session streams even when registry metadata already contains `editedFiles`.
- **Test Design**: Add a unit test that stubs `getStreamAPI` so `readSession` throws; when registry includes `session_completed.metadata.editedFiles`, `getChangedFiles` should return metadata without calling `readSession`. Include a second test to verify the fallback path when metadata is missing.
- **Prediction**: The new test will fail on current code because `readSession` is still called; after adding a metadata fast path it will pass.
- **Result**: The test failed with `readSession should not be called`, confirming the current implementation always reads session streams.
- **Conclusion**: Hypothesis confirmed; a metadata fast path is required.

### Phase 4: Implementation
- **Root Cause**: `agent.getChangedFiles` always read full session streams to reach metadata, forcing heavy parsing per session on preview/review load.
- **Solution**: Add a metadata fast path in `getChangedFiles` that returns `SessionCompletedEvent`/`SessionFailedEvent` `metadata.editedFiles` without reading the session stream; only fall back to parsing output chunks when metadata is absent.
- **Test Case**: `src/trpc/__tests__/agent-get-changed-files.test.ts` covers the metadata fast path and fallback tool_use parsing.
- **Verification**: `npm run test -- --run src/trpc/__tests__/agent-get-changed-files.test.ts`
- **Changes Made**:
  - `src/trpc/agent.ts` now avoids `readSession()` when metadata is present.
  - `src/trpc/__tests__/agent-get-changed-files.test.ts` adds coverage for the new behavior.

## Success Criteria
- [x] Root cause identified and documented
- [x] Fix addresses root cause (not symptoms)
- [x] Test created reproducing bug
- [x] All tests pass
