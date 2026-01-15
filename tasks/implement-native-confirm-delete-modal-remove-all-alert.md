# implement native confirm delete modal. remove all alert()

## Problem Statement
Replace all `globalThis.confirm()` calls with native dialog component. Currently 4 confirm dialogs in tasks.tsx using browser native confirm. Need reusable confirmation modal for better UX/consistency.

## Scope
**In:**
- Reusable confirm dialog component
- Replace 4 confirm calls in tasks.tsx:
  - Delete task (line 439)
  - Archive task (line 449)
  - Discard unsaved changes (line 355)
  - Save before agent assignment (line 468)

**Out:**
- alert() calls (none found in codebase)
- Other browser native dialogs (prompt, etc)

## Implementation Plan

### Phase: Create Confirm Modal Component
- [x] Create `src/components/ui/confirm-dialog.tsx`
- [x] Extend existing Dialog component with confirm/cancel actions
- [x] Props: title, message, confirmText, cancelText, variant (danger/default), onConfirm, onCancel
- [x] Support destructive variant for delete/archive actions

### Phase: Replace Confirm Calls in Tasks Route
- [x] Add confirm dialog state to tasks.tsx
- [x] Replace delete confirm (line 439) with dialog
- [x] Replace archive confirm (line 449) with dialog
- [x] Replace unsaved changes confirm (line 355) with dialog
- [x] Replace save-before-agent confirm (line 468) with dialog

## Key Files
- `src/components/ui/confirm-dialog.tsx` - new reusable component
- `src/routes/tasks.tsx` - replace 4 confirm calls (lines 355, 439, 449, 468)
- `src/components/ui/dialog.tsx` - existing dialog primitives (already present)

## Success Criteria
- [x] No `globalThis.confirm()` calls remain in codebase
- [x] All 4 confirmation scenarios work identically
- [x] Dialog component matches existing UI design system
- [x] Destructive actions use danger styling
