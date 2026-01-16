# add global hotkeys provider and define a hotkeys for common operations

## Problem Statement
Missing app-wide hotkeys for frequent workflows.
Need central provider for consistent key handling.
Define default keymap for navigation + task actions.

## Scope
**In:**
- Global hotkeys provider + registration hook
- Default keymap for navigation and task actions
- Root wiring + task UI focus target
**Out:**
- User-configurable keybindings UI
- Command palette/omnibox
- Per-editor shortcuts beyond existing handlers

## Implementation Plan

### Phase: Hotkeys Core
- [x] Add provider in `src/components/hotkeys/global-hotkeys-provider.tsx`
- [x] Add registration hook in `src/lib/hooks/use-hotkeys.ts`
- [x] Define keymap in `src/lib/hotkeys/keymap.ts`

### Phase: Wire Common Operations
- [x] Mount provider in `src/routes/__root.tsx`
- [x] Wire navigation/filter handlers in `src/components/hotkeys/global-hotkeys-provider.tsx`
- [x] Add filter focus target in `src/components/tasks/task-list-sidebar.tsx`
- [x] Register task hotkeys in `src/routes/tasks/_page.tsx`

## Key Files
- `src/routes/__root.tsx` - mount provider
- `src/components/hotkeys/global-hotkeys-provider.tsx` - key handling + actions
- `src/lib/hooks/use-hotkeys.ts` - registration API
- `src/lib/hotkeys/keymap.ts` - key definitions
- `src/components/tasks/task-list-sidebar.tsx` - filter focus target
- `src/routes/tasks/_page.tsx` - task hotkey bindings

## Success Criteria
- [x] Defined hotkeys trigger common actions without typing conflicts
- [x] Global navigation hotkeys work across routes
- [x] Task hotkeys only active on tasks routes

## Implementation Notes

### Key Mappings
- **Cmd/Ctrl+F**: Focus task filter (works globally, even in inputs)
- **g t**: Go to tasks
- **c**: Create new task (only on /tasks routes)
- **i**: Implement selected task (only when task selected)
- **v**: Verify selected task (only when task selected)
- **r**: Review selected task (only when task selected)

### Technical Details
- Hotkeys automatically disabled when typing in inputs/textareas (except Cmd/Ctrl+F)
- Task action hotkeys check for active agent session (disabled if agent running)
- Route-based activation using regex patterns in keymap
- Platform-aware: Cmd on Mac, Ctrl on Windows/Linux

### Answered Questions
- ✓ Key combos selected for minimal conflicts with browser/system shortcuts
- ✓ Hotkeys automatically skip input/textarea elements (built into use-hotkeys)
- ✓ Cross-platform support via comma-separated alternatives (cmd+f,ctrl+f)
