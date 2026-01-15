# before fixing bug agent should search archived tasks for context

## Problem Statement
Bug-fixing agents receive only title + task path—no context from past bugs. Archived tasks contain valuable patterns, root causes, fixes. Agents should search archive before investigating.

## Scope
**In:**
- Search archived tasks for similar bugs before investigation
- Extract relevant context (symptoms, root causes, fixes)
- Inject context into debug prompt

**Out:**
- Full-text search UI (already deferred)
- Vector/semantic search (overkill for ~30 tasks)
- Modifying archive storage structure

## Implementation Plan

### Phase: Archive Search Function
- [x] Add `searchArchivedTasks(cwd, query)` in `src/lib/agent/task-service.ts`
  - Verified: `searchArchivedTasks` exported in `src/lib/agent/task-service.ts:480`.
- [x] Simple keyword match: title + content grep for keywords from bug title
  - Verified: keywords extracted from title and matched against title/content in `src/lib/agent/task-service.ts:451-517`.
- [x] Return top 3-5 matches with title, path, snippets
  - Verified: results sliced by `maxResults` and mapped to include `title`, `path`, `snippet` in `src/lib/agent/task-service.ts:528-542`.

### Phase: Context Extraction
- [x] Add `extractBugContext(taskContent)` helper in task-service.ts
  - Verified: `extractBugContext` exported in `src/lib/agent/task-service.ts:581`.
- [x] Extract: root cause, fix description, key files from investigation findings
  - Verified: root cause/solution sections parsed and key files collected in `src/lib/agent/task-service.ts:606-649`.
- [ ] Return structured summary (max 500 chars per task)
  - Not verified: no combined 500-char cap; only per-field truncation in `src/lib/agent/task-service.ts:591-660`.

### Phase: Debug Prompt Integration
- [x] Modify `buildTaskDebugPrompt()` in `src/trpc/tasks.ts`
  - Verified: related bug section added in `src/trpc/tasks.ts:23-74`.
- [x] Call search before building prompt
  - Verified: `searchArchivedTasks` called in `src/trpc/tasks.ts:28-29`.
- [x] Add `## Related Archived Bugs` section with extracted context
  - Verified: section and context fields included in `src/trpc/tasks.ts:54-61` and `src/trpc/tasks.ts:37-45`.
- [x] Include paths for agent to read full tasks if needed
  - Verified: `Path: \`...\`` included in `src/trpc/tasks.ts:35`.

## Key Files
- `src/lib/agent/task-service.ts:428-661` - searchArchivedTasks() + extractBugContext()
- `src/trpc/tasks.ts:22-128` - buildTaskDebugPrompt() with related bugs

## Success Criteria
- [x] Bug tasks show "Related Archived Bugs" section when matches found
  - Verified: section is conditional on `relatedBugs.length > 0` in `src/trpc/tasks.ts:31-63`.
- [x] Agents can reference past bug patterns before investigating
  - Verified: root cause/solution/key file context included in `src/trpc/tasks.ts:37-45`.
- [ ] No perf regression (glob archive + grep should be <100ms for ~30 tasks)
  - Not verified: no perf measurement found; search scans all archive files in `src/lib/agent/task-service.ts:488-526`.

## Verification Results
- Tests: `npm test` failed (missing `test` script in `package.json`).
- Unverified: 500-char summary cap not enforced; perf target not measured.
- Notes: Verification based on code inspection of `searchArchivedTasks` and `buildTaskDebugPrompt`.