# find all usages of switch/case and replace it with ts-pattern match

## Problem Statement
Switch/case blocks across agent, daemon, streams, UI code. Replace with `ts-pattern` `match` for consistent branching, exhaustiveness. Behavior parity.

## Scope
**In:**
- `src/lib/debate/synthesis.ts`
- `src/lib/agent/cerebras.ts`
- `src/lib/agent/cli-runner.ts`
- `src/lib/agent/tools.ts`
- `src/lib/agent/manager.ts`
- `src/lib/agent/git-service.ts`
- `src/lib/agent/opencode.ts`
- `src/lib/agent/metadata-analyzer.ts`
- `src/daemon/agent-daemon.ts`
- `src/streams/client.ts`
- `src/trpc/agent.ts`
- `src/components/git/file-list.tsx`
- `src/components/git/diff-panel.tsx`
- `src/components/agents/tool-result.tsx`
- `src/components/tasks/task-list-sidebar.tsx`
- `src/components/tasks/task-sessions.tsx`
- `src/components/stats/file-changes-table.tsx`
- `src/components/stats/hot-files-table.tsx`
- `src/components/stats/task-stats-table.tsx`

**Out:**
- `src/components/ui/switch.tsx`
- `src/lib/hooks/use-synchronize-agent-type.ts`
- `package-lock.json`
- `pnpm-lock.yaml`
- `tasks/archive/2026-01/selected-file-in-review-should-be-part-of-url.md`
- `tasks/archive/2026-01/remove-save-task-button-and-make-task-autosave.md`
- `tasks/archive/2026-01/4-manager-integration.md`
- `tasks/archive/2026-01/add-audio-notifications-when-agent-completed-work-audio-files-should-be-generated-via-eleven-labs-api-for-that-review-ispo-repo-and-use-elevenlabs-key-from-there.md`
- `tasks/archive/2026-01/add-qa-agent-using-mcporter-https-github-com-steipete-mcporter.md`

## Implementation Plan

### Phase: Prep
- [x] Confirm `ts-pattern` import style in `src/lib/stores/tasks-reducer.ts`
  - ✓ Verified: File uses `import { match } from 'ts-pattern'` at line 10, uses `.with()` and `.exhaustive()` pattern correctly
- [x] Capture current switch sites via `rg -n "switch \\(" src`
  - ✓ Verified: This was a preparatory step to identify locations

### Phase: Refactor
- [x] Replace switches in `src/lib/agent/cerebras.ts`, `src/lib/agent/cli-runner.ts`, `src/lib/agent/git-service.ts`, `src/lib/agent/manager.ts`, `src/lib/agent/metadata-analyzer.ts`, `src/lib/agent/opencode.ts`, `src/lib/agent/tools.ts`
  - ✓ Verified: All files import `match` from 'ts-pattern' and use the pattern correctly
- [x] Replace switches in `src/lib/debate/synthesis.ts`, `src/daemon/agent-daemon.ts`, `src/streams/client.ts`, `src/trpc/agent.ts`
  - ✓ Verified: All files have ts-pattern imports and use `match()` with `.with()` and `.exhaustive()` patterns
- [x] Replace switches in `src/components/git/file-list.tsx`, `src/components/git/diff-panel.tsx`, `src/components/agents/tool-result.tsx`, `src/components/tasks/task-list-sidebar.tsx`, `src/components/tasks/task-sessions.tsx`, `src/components/stats/file-changes-table.tsx`, `src/components/stats/hot-files-table.tsx`, `src/components/stats/task-stats-table.tsx`
  - ✓ Verified: All component files have ts-pattern imports and use `match()` correctly
  - ⚠ Note: `tool-result.tsx` is a re-export that points to `tool-result-v2.tsx`

### Phase: Verify
- [x] Run `npm run test:run` (no test files found in src/)
  - ✓ Verified: Build succeeds without TypeScript errors
- [ ] Re-run `rg -n "switch \\(" src` for zero hits (verified: no switch statements remain)
  - ✗ **FAILED**: A switch statement remains at `src/components/agents/tool-result-v2.tsx:52`

## Key Files
- `src/lib/debate/synthesis.ts` - ✓ Verified: uses match() at line 128
- `src/lib/agent/cerebras.ts` - ✓ Verified: imports ts-pattern at line 16
- `src/lib/agent/cli-runner.ts` - ✓ Verified: imports ts-pattern at line 10
- `src/lib/agent/tools.ts` - ✓ Verified: imports ts-pattern at line 8
- `src/lib/agent/manager.ts` - ✓ Verified: imports ts-pattern at line 14
- `src/lib/agent/git-service.ts` - ✓ Verified: imports ts-pattern at line 9
- `src/lib/agent/opencode.ts` - ✓ Verified: imports ts-pattern at line 8
- `src/lib/agent/metadata-analyzer.ts` - ✓ Verified: imports ts-pattern at line 13
- `src/daemon/agent-daemon.ts` - ✓ Verified: imports ts-pattern at line 17, uses match() at line 279
- `src/streams/client.ts` - ✓ Verified: imports ts-pattern at line 10, uses match() at line 323
- `src/trpc/agent.ts` - ✓ Verified: imports ts-pattern at line 13, uses match() at lines 125 and 156
- `src/components/git/file-list.tsx` - ✓ Verified: imports ts-pattern at line 6, uses match() at line 53
- `src/components/git/diff-panel.tsx` - ✓ Verified: imports ts-pattern at line 8, uses match() at line 108
- `src/components/agents/tool-result.tsx` - ⚠ Re-exports from tool-result-v2.tsx which still has switch
- `src/components/tasks/task-list-sidebar.tsx` - ✓ Verified: imports ts-pattern at line 10, uses match() at lines 257-270
- `src/components/tasks/task-sessions.tsx` - ✓ Verified: imports ts-pattern at line 8, uses match() at line 102
- `src/components/stats/file-changes-table.tsx` - ✓ Verified: imports ts-pattern at line 9, uses match() at lines 43-48 and 57-60
- `src/components/stats/hot-files-table.tsx` - ✓ Verified: imports ts-pattern at line 9, uses match() at lines 61-65
- `src/components/stats/task-stats-table.tsx` - ✓ Verified: imports ts-pattern at line 9, uses match() at lines 47-54

## Success Criteria
- [ ] `rg -n "switch \\(" src` returns no results
  - ✗ **FAILED**: Switch found at `src/components/agents/tool-result-v2.tsx:52`
- [x] `ts-pattern` `match` in all in-scope files
  - ✓ Verified: All explicitly in-scope files use ts-pattern match

## Verification Results

### Summary
**Status: INCOMPLETE**

The task is 95% complete. All explicitly scoped files have been converted to use ts-pattern `match()`. However, there is one remaining switch statement that was missed:

### Remaining Issue
- **File:** `src/components/agents/tool-result-v2.tsx`
- **Line:** 52
- **Code:**
  ```typescript
  function getLanguageForContent(contentType: ContentType, filePath?: string, content?: string): SupportedLanguage {
    switch (contentType) {
      case "json": return "json"
      case "shell": return "bash"
      case "file": return detectLanguage(filePath, content)
      default: return "plain"
    }
  }
  ```

### Root Cause
The scope listed `src/components/agents/tool-result.tsx`, but this file is merely a re-export wrapper:
```typescript
export { ToolResultV2 as ToolResult } from "./tool-result-v2"
```

The actual implementation lives in `tool-result-v2.tsx`, which was not explicitly listed in scope and was not converted.

### Required Fix
Convert the switch in `src/components/agents/tool-result-v2.tsx:52` to ts-pattern match:

```typescript
import { match } from 'ts-pattern'

function getLanguageForContent(contentType: ContentType, filePath?: string, content?: string): SupportedLanguage {
  return match(contentType)
    .with('json', () => 'json' as const)
    .with('shell', () => 'bash' as const)
    .with('file', () => detectLanguage(filePath, content))
    .otherwise(() => 'plain' as const)
}
```

### Build Verification
- ✓ `npm run build` completes successfully with no TypeScript errors
- ✓ All in-scope files compile correctly with ts-pattern usage