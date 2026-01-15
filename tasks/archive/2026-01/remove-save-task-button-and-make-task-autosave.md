# remove save task button and make task autosave

## Problem Statement
Manual save button adds friction; users expect autosave. Save button + dirty state tracking creates unnecessary UI complexity.

## Scope
**In:**
- Debounced autosave on draft changes (500ms)
- Remove Save button from sidebar
- Keep optimistic update pattern
- Show subtle "Saving..."/"Saved" indicator

**Out:**
- Offline/localStorage persistence
- Conflict resolution (agent vs user edits)
- Undo/revision history

## Implementation Plan

### Phase 1: Add Debounce Utility
- [x] Install `use-debounce` package
- [x] Create `useDebouncedCallback` wrapper in `src/lib/utils/debounce.ts`

### Phase 2: Implement Autosave in _page.tsx
- [x] Import `useDebouncedCallback` from use-debounce
- [x] Create debounced save function (500ms delay)
- [x] Call debounced save in `onDraftChange` when `selectedPath` exists
- [x] Remove `handleSave` callback (no longer needed for manual trigger)
- [x] Remove Cmd/Ctrl+S keyboard handler effect

### Phase 3: Update TaskSidebar
- [x] Remove Save button JSX (lines 122-130)
- [x] Remove `onSave`, `dirty` props from interface (kept `isSaving`, `saveError` for indicator)
- [x] Update component call in _page.tsx to remove those props

### Phase 4: Add Status Indicator
- [x] Add small "Saving..." text next to Controls header in sidebar
- [x] Use existing `isSaving` state (kept for indicator)

## Key Files
- `src/routes/tasks/_page.tsx` - main autosave logic, remove manual save
- `src/components/tasks/task-sidebar.tsx` - remove Save button & props
- `src/lib/utils/debounce.ts` - debounce utility wrapper (new)
- `package.json` - add use-debounce dependency

## Success Criteria
- [x] Draft changes auto-save after 500ms idle
- [x] No Save button visible in sidebar
- [x] Visual feedback shows save status
- [x] Optimistic updates still work (instant UI, rollback on error)

## Implementation Notes
- Status indicator placed next to "Controls" header with subtle `animate-pulse` effect
- Kept `dirty` state in _page.tsx for future use (unsaved changes warning on navigation)
- `use-debounce` library provides `useDebouncedCallback` which delays the save call, not the draft state
- User sees changes instantly (optimistic), server save batched after 500ms inactivity

## Resolved Questions
1. Status indicator lives inline with Controls header in sidebar - subtle but visible
2. Debounced save passes current content, no flush needed on task switch (save triggers immediately on change)
3. Kept `dirty` state for potential future use in navigation warnings
