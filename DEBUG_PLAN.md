# Debug Plan: Session Sidebar Changed Files Not Rendering

## Problem Statement
Files changed within a session are not correctly rendered in the session sidebar.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Layer (thread-sidebar.tsx)                                  │
│  - Polls getSessionWithMetadata every 2s                        │
│  - Reads metadata.editedFiles                                   │
│  - Groups by operation (create/edit/delete)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  tRPC Layer (agent.ts)                                          │
│  - getSessionWithMetadata: reconstructs from streams            │
│  - getChangedFiles: returns metadata.editedFiles                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Data Layer (durable streams)                                   │
│  - session_created: no metadata                                 │
│  - session_updated: status only (NO METADATA)  ← ROOT ISSUE     │
│  - session_completed/failed: includes metadata                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Agent Daemon (agent-daemon.ts)                                 │
│  - MetadataAnalyzer collects editedFiles in real-time           │
│  - Only publishes metadata at completion/failure                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hypotheses (Ordered by Likelihood)

### H1: Metadata Only Available After Session Completion
**Evidence**: `session_updated` events in streams schema don't include metadata field.
**Impact**: During "running" state, sidebar shows nothing because reconstruction returns `metadata: null`.
**Verify**: Check if completed sessions show files correctly but running ones don't.

### H2: Path Resolution Issues
**Evidence**: Complex path transformations in `toWorkingRelPath()` and `toRepoRelativePath()`.
**Impact**: Files exist in metadata but display incorrectly or links broken.
**Verify**: Console log raw `metadata.editedFiles` vs displayed paths.

### H3: Tool Call Detection Failures
**Evidence**: MetadataAnalyzer parses tool_use chunks, extracting path from specific fields.
**Impact**: Agent uses different tool names or path fields than expected.
**Verify**: Check analyzer logs for unrecognized tools or missing path fields.

### H4: Durable Streams Read Issues
**Evidence**: LMDB files show as modified in git status.
**Impact**: Stream reads returning stale/corrupt data.
**Verify**: Compare direct stream reads vs what UI receives.

### H5: Polling Race Condition
**Evidence**: 2s poll interval for session, 3s for git status.
**Impact**: Data arrives but UI doesn't re-render.
**Verify**: Check React query cache invalidation and refetch behavior.

---

## Debugging Steps

### Phase 1: Identify Scope of Issue

```bash
# 1.1 - Check if issue is runtime-only or also affects completed sessions
# Start a session, let it modify files, complete it, check sidebar
# Expected: Completed sessions should show files if H1 is correct

# 1.2 - Check DISABLE_DURABLE_STREAMS env var
# If true, legacy AgentManager is used (different code path)
echo $DISABLE_DURABLE_STREAMS
```

### Phase 2: Verify Data Flow

```typescript
// 2.1 - Add logging to thread-sidebar.tsx (lines 39-70)
console.log('[Sidebar] sessionWithMetadata:', sessionWithMetadata)
console.log('[Sidebar] metadata:', metadata)
console.log('[Sidebar] editedFiles:', metadata?.editedFiles)
console.log('[Sidebar] filesByOperation:', filesByOperation)

// 2.2 - Check tRPC response in browser DevTools
// Network tab → filter "getSessionWithMetadata" → inspect response
// Look for: metadata field presence, editedFiles array contents

// 2.3 - Verify daemon is publishing metadata on completion
// Check agent-daemon.ts console output for:
// "[AgentDaemon] Session {id} completed successfully"
```

### Phase 3: Test Individual Components

```typescript
// 3.1 - Test MetadataAnalyzer directly
import { MetadataAnalyzer } from '@/lib/agent/metadata-analyzer'
const analyzer = new MetadataAnalyzer('claude', '/tmp/test')
// Feed it sample output chunks and verify editedFiles populated

// 3.2 - Test stream reconstruction
import { getStreamAPI } from '@/streams/client'
const api = getStreamAPI()
const registry = await api.readRegistry()
const session = await api.readSession('SESSION_ID')
console.log('Registry events:', registry.filter(e => e.sessionId === 'SESSION_ID'))
console.log('Session events:', session)

// 3.3 - Test path utilities
import { toWorkingRelPath, toRepoRelativePath } from somewhere
console.log(toWorkingRelPath('/abs/path/file.ts', '/abs/path', 'src'))
```

---

## QA Test Cases

### TC1: New File Creation
1. Start session with prompt "create a new file called test-file.txt"
2. Wait for file creation tool call
3. **Expected during run**: Sidebar shows "+1" in Changed Files section
4. **Expected after complete**: File appears with green "+" icon, "create" operation

### TC2: File Edit
1. Start session with prompt "add a comment to package.json"
2. Wait for edit tool call
3. **Expected**: Sidebar shows "~1", file appears with blue "~" icon

### TC3: File Delete
1. Start session with prompt "delete DEBUG_PLAN.md"
2. Wait for delete tool call
3. **Expected**: Sidebar shows "-1", file appears with red "−" icon

### TC4: Multiple Operations Same File
1. Start session with prompt "create foo.txt, then edit it twice"
2. **Expected**: File shows latest operation, count shows "3×"

### TC5: Worktree Isolation
1. Start session with worktree enabled
2. Modify files
3. **Expected**: Paths resolve correctly relative to worktree, not main repo

### TC6: Path Display
1. Modify deeply nested file like `src/components/agents/thread-sidebar.tsx`
2. **Expected**: Path truncated reasonably in sidebar, full path on hover

### TC7: Git Link Integration
1. Click on changed file in sidebar
2. **Expected**: Navigates to `/git?file={repoPath}&view=working`

---

## Potential Fixes (If Hypotheses Confirmed)

### Fix for H1 (No Runtime Metadata)
**Option A**: Periodic metadata snapshots
- Daemon publishes `session_updated` with metadata every N seconds
- Requires schema change + daemon modification

**Option B**: Fallback to process monitor
- Query running daemon process for live metadata
- Add IPC channel between daemon and server

**Option C**: Parse session output stream on-demand
- Reconstruct metadata from output chunks at query time
- Higher latency but no daemon changes

### Fix for H2 (Path Issues)
- Add comprehensive path normalization tests
- Handle edge cases: Windows paths, symlinks, trailing slashes

### Fix for H3 (Tool Detection)
- Log unrecognized tool calls
- Expand tool name patterns in analyzer

---

## Files to Investigate

| Priority | File | Focus |
|----------|------|-------|
| 1 | `src/components/agents/thread-sidebar.tsx` | UI rendering, data extraction |
| 2 | `src/trpc/agent.ts` | `getSessionWithMetadata`, reconstruction |
| 3 | `src/daemon/agent-daemon.ts` | Metadata publishing timing |
| 4 | `src/lib/agent/metadata-analyzer.ts` | Tool detection, path extraction |
| 5 | `src/streams/schemas.ts` | Event shapes, metadata fields |
| 6 | `src/streams/client.ts` | Stream read reliability |

---

## Quick Smoke Test

```bash
# Start dev server
npm run dev

# In another terminal, watch for sidebar requests
# Open browser DevTools → Network → filter "trpc"

# Trigger a session that modifies files
# Watch for getSessionWithMetadata responses
# Check if metadata.editedFiles is populated
```

---

## Unresolved Questions

1. **Runtime vs completion**: Is it acceptable that files only show after session completes? Or must they show in real-time?

2. **Performance**: If we add periodic metadata publishing, what interval? Too frequent = overhead, too infrequent = stale UI.

3. **Worktree edge cases**: Are paths being resolved correctly when session runs in a worktree subdirectory?

4. **Stream corruption**: The LMDB files are modified in git status - is this normal operation or indicating a problem?
