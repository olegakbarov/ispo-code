# Fix Broken Optimistic Updates

## Problem Statement

Optimistic updates implemented but not working. Two root causes:
1. **Cache key mismatch** in session-scoped queries (git commit mutations)
2. **Empty cache handling** in task action mutations (implement, verify, rewrite)

## Scope

**In:**
- Fix cache key mismatches in git commit mutations
- Fix empty cache handling in task action mutations
- Verify all optimistic updates work end-to-end

**Out:**
- New optimistic update implementations
- UI changes

## Root Cause Analysis

### Issue 1: Session-scoped queries with context mismatch

In `sidebar-commit-panel.tsx` and `thread-sidebar.tsx`:

```typescript
// Query uses sessionTrpc context - creates cache key with sessionId
const { data: gitStatus } = trpc.git.status.useQuery(undefined, {
  ...sessionTrpc,  // includes { trpc: { context: { sessionId } } }
})

// But onMutate uses NO context - accesses DIFFERENT cache entry!
onMutate: async () => {
  await utils.git.status.cancel()           // ❌ wrong cache key
  const prev = utils.git.status.getData()   // ❌ wrong cache key
  utils.git.status.setData(undefined, ...)  // ❌ wrong cache key
}
```

**Fix:** Pass matching query key to all cache operations:
```typescript
onMutate: async () => {
  await utils.git.status.cancel(undefined, { context: { sessionId } })
  const prev = utils.git.status.getData(undefined, { context: { sessionId } })
  utils.git.status.setData(undefined, newData, { context: { sessionId } })
}
```

### Issue 2: Same problem with `agent.getChangedFiles`

```typescript
// Query
const { data: changedFiles } = trpc.agent.getChangedFiles.useQuery({ sessionId })

// onMutate - input matches but still need to ensure key alignment
await utils.agent.getChangedFiles.cancel({ sessionId })  // ✓ has input
```

This one may be OK since it uses input params, but need to verify.

### Issue 3: Empty cache in task action mutations (FIXED)

In `_page.tsx`, task actions (implement, verify, rewrite) had a bug where optimistic updates were skipped if the cache was empty:

```typescript
// BUG: If query hasn't resolved yet, previousSessions is undefined
// and setData is never called!
const previousSessions = utils.tasks.getActiveAgentSessions.getData()
if (previousSessions !== undefined) {  // ← Condition fails for empty cache
  utils.tasks.getActiveAgentSessions.setData(...)
}

// FIX: Always set data, even if cache is empty
utils.tasks.getActiveAgentSessions.setData(undefined, {
  ...(previousSessions ?? {}),  // ← Use empty object if undefined
  [path]: { sessionId: `pending-...`, status: 'pending' },
})
```

Also missing `onSettled` for consistent cache invalidation.

## Implementation Plan

### Phase 1: Fix sidebar-commit-panel.tsx

- [ ] Add sessionId to `utils.git.status.cancel()` context
- [ ] Add sessionId to `utils.git.status.getData()` context
- [ ] Add sessionId to `utils.git.status.setData()` context (in onMutate)
- [ ] Add sessionId to `utils.git.status.setData()` context (in onError)
- [ ] Add sessionId to `utils.git.status.invalidate()` context

### Phase 2: Fix thread-sidebar.tsx

- [ ] Add sessionId to `utils.git.status.cancel()` context
- [ ] Add sessionId to `utils.git.status.getData()` context
- [ ] Add sessionId to `utils.git.status.setData()` context (in onMutate)
- [ ] Add sessionId to `utils.git.status.setData()` context (in onError)
- [ ] Add sessionId to `utils.git.status.invalidate()` context

### Phase 3: Fix task action mutations in _page.tsx (DONE)

- [x] Fix `assignToAgentMutation` - handle empty cache + add onSettled
- [x] Fix `verifyWithAgentMutation` - handle empty cache + add onSettled
- [x] Fix `rewriteWithAgentMutation` - handle empty cache + add onSettled
- [x] Fix `cancelAgentMutation` - add onSettled for consistency

### Phase 4: Verify other mutations

- [ ] Check `tasks.save` in `_page.tsx` - uses input params, should be OK
- [ ] Check `tasks.create` - uses `undefined` input, should be OK
- [ ] Check `tasks.archive/restore` - uses `undefined` input, should be OK
- [ ] Check `agent.spawn` mutations - uses `undefined` input, should be OK

### Phase 5: Manual verification

- [ ] Test git commit in thread sidebar - files should disappear immediately
- [ ] Test git commit in sidebar panel - files should disappear immediately
- [ ] Test rollback on commit failure
- [x] Test task actions (implement/verify/rewrite) - should immediately show pending state

## Key Files

- `src/components/agents/sidebar-commit-panel.tsx:46-109` - broken optimistic update (Issue 1)
- `src/components/agents/thread-sidebar.tsx:200-263` - broken optimistic update (Issue 1)
- `src/routes/tasks/_page.tsx:470-620` - task action mutations (Issue 3 - FIXED)
- `src/lib/trpc-session.ts` - defines sessionTrpc context helper

## Success Criteria

- [ ] Committing files immediately removes them from UI (no wait for server)
- [ ] Failed commits restore files to UI
- [ ] No console errors about cache misses
- [ ] Polling doesn't overwrite optimistic state during mutation

## Technical Notes

### TanStack Query cache keys

For tRPC, cache key = `[procedure path, input, context]`. When using custom context:
- Query: `['git.status', undefined, { sessionId: 'abc' }]`
- Without context: `['git.status', undefined, undefined]`

These are **different cache entries**. Must match context in all operations.

### Correct pattern for session-scoped mutations

```typescript
const sessionTrpc = sessionTrpcOptions(sessionId)
const queryContext = { context: { sessionId } }

const mutation = trpc.git.commitScoped.useMutation({
  ...sessionTrpc,
  onMutate: async () => {
    await utils.git.status.cancel(undefined, queryContext)
    const prev = utils.git.status.getData(undefined, queryContext)
    utils.git.status.setData(undefined, newData, queryContext)
    return { prev }
  },
  onError: (_, __, ctx) => {
    utils.git.status.setData(undefined, ctx?.prev, queryContext)
  },
  onSettled: () => {
    utils.git.status.invalidate(undefined, queryContext)
  },
})
```
