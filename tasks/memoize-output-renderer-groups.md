# Memoize OutputRenderer Groups and Chunks

**Priority**: Medium
**Category**: Performance
**Status**: Completed

## Problem

`src/components/agents/output-renderer.tsx` rebuilds grouped chunks and re-parses tool payloads on every parent render (lines 17-115). In `src/routes/agents/$sessionId.tsx`, input state updates cause re-renders even when output data is unchanged, so large output lists are recomputed and re-rendered unnecessarily.

## Impact

- Input lag for long-running sessions
- Extra JSON parsing and markdown rendering work
- Increased render time when typing or toggling UI state

## Fix

- [x] Wrap `OutputRenderer` and `OutputChunk` in `React.memo`
- [x] Use `useMemo` to build `groups` from `chunks`
- [x] Memoize parsed tool payloads (e.g., `useMemo` inside `OutputChunk`) to avoid repeated `JSON.parse`
- [x] Keep the `chunks` reference stable in the parent (`allOutput` already helps)

## Files

- `src/components/agents/output-renderer.tsx`
- `src/routes/agents/$sessionId.tsx`

## Implementation Notes

- `OutputRenderer` now uses `useMemo` for the groups array, only recomputing when `chunks` changes
- `OutputChunk` memoizes the parsed tool payload with `useMemo`, keyed on `type` and `content`
- Both components are wrapped in `React.memo` to skip re-renders when props are unchanged
- The parent already provides stable `chunks` reference via `useMemo` in `allOutput`
