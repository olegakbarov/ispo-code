# [Shiki] 20 instances have been created. Shiki is supposed to be used as a singleton, consider refactoring your code to cache your highlighter instance; Or call `highlighter.dispose()` to release unused instances.

## Problem Statement
Shiki warning: multiple highlighter instances created. Current singleton likely bypassed by module reloads or duplicate entry points. Need stable cache or dispose to prevent leaks/perf hit.

## Scope
**In:**
- `src/lib/utils/syntax-highlighter.ts` singleton lifecycle
- Shiki init call sites in app bootstrap and code renderers

**Out:**
- UI styling changes
- Language list changes
- Highlight cache policy changes

## Implementation Plan

### Phase: Singleton Hardening
- [x] Audit all imports/entry points to ensure single module path for highlighter
- [x] Cache highlighter promise on `globalThis` to survive HMR/module reloads
- [x] Add `disposeHighlighter` utility for teardown and HMR cleanup
- [x] Wire dispose call into dev HMR or app teardown hook

## Key Files
- `src/lib/utils/syntax-highlighter.ts` - cache and dispose lifecycle
- `src/routes/__root.tsx` - preload and teardown hook
- `src/components/agents/syntax-highlighted-code.tsx` - highlight usage verification

## Success Criteria
- [x] No "20 instances" Shiki warning after repeated highlighting/HMR
- [x] Single cached highlighter reused across code renders
- [x] Dispose path verified in dev or teardown
