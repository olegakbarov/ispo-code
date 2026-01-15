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
- [ ] Add `searchArchivedTasks(cwd, query)` in `src/lib/agent/task-service.ts`
- [ ] Simple keyword match: title + content grep for keywords from bug title
- [ ] Return top 3-5 matches with title, path, snippets

### Phase: Context Extraction
- [ ] Add `extractBugContext(taskContent)` helper in task-service.ts
- [ ] Extract: root cause, fix description, key files from investigation findings
- [ ] Return structured summary (max 500 chars per task)

### Phase: Debug Prompt Integration
- [ ] Modify `buildTaskDebugPrompt()` in `src/trpc/tasks.ts`
- [ ] Call search before building prompt
- [ ] Add `## Related Archived Bugs` section with extracted context
- [ ] Include paths for agent to read full tasks if needed

## Key Files
- `src/lib/agent/task-service.ts` - add search + extract functions
- `src/trpc/tasks.ts:22-90` - modify buildTaskDebugPrompt()

## Success Criteria
- [ ] Bug tasks show "Related Archived Bugs" section when matches found
- [ ] Agents can reference past bug patterns before investigating
- [ ] No perf regression (glob archive + grep should be <100ms for ~30 tasks)
