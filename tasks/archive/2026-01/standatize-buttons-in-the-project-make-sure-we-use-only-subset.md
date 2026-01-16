# standatize buttons in the project. make sure we use only subset

## Problem Statement
Mixed button styles; raw `<button>` usage across UI. No enforced subset of variants/sizes in `src/components/ui/button.tsx`; inconsistent look, harder maintenance.

## Scope
**In:**
- Subset definition in `src/components/ui/button.tsx`
- Adopt `Button` in `src/routes/settings/index.tsx`
- Adopt `Button` in `src/components/tasks/task-sidebar.tsx`
- Adopt `Button` in `src/components/git/diff-panel.tsx`

**Out:**
- Color token changes in `src/styles.css`
- Agent orchestration changes in `src/lib/agent/manager.ts`
- Router layout changes in `src/routes/__root.tsx`

## Implementation Plan

### Phase: Audit
- [x] Capture current variants/sizes in `src/components/ui/button.tsx`
  - Variants: default, destructive, outline, secondary, ghost, link, success (7 total)
  - Sizes: default, sm, lg, xs, icon, icon-sm, icon-xs (7 total)
- [x] List raw `<button>` patterns in `src/routes/settings/index.tsx`
  - L146-157: Theme toggle buttons (dark/light) with inline styles
  - L186-228: Theme preset buttons with inline styles
  - L250-269: Color preset buttons with inline styles
  - L317-333: Preview buttons with inline styles
  - L410-423: Audio toggle switch (custom implementation)
  - L462-487: Audio preview buttons with inline styles
  - L698-705: Sign out button with inline styles
- [x] List raw `<button>` patterns in `src/components/tasks/task-sidebar.tsx`
  - L124-135: Review button with inline styles
  - L137-144: Implement button with inline styles
  - L146-153: Verify button with inline styles
  - L158-166: Split from badge button
  - L192-200: Merge to Main button
  - L206-214: QA Pass button
  - L215-223: QA Fail button
  - L230-237: Revert Merge button
  - L244-246: Merge history toggle button
  - L337-344: Delete button
- [x] List raw `<button>` patterns in `src/components/git/diff-panel.tsx`
  - L630-637: Submit file button
  - L641-648: Submit all button
  - L687-700: Add comment button
  - L712-726: Edit comment button
  - L727-732: Delete comment button
  - L753-758: Cancel draft button
  - L759-766: Save draft button
  - L797-806: Close modal button
  - L858-876: Agent type selection buttons
  - L917-923: Cancel modal button
  - L924-936: Start Agent button

### Phase: Define Subset
- [x] Decide allowed `variant`/`size` values in `src/components/ui/button.tsx`
  - Variants: default, destructive, outline, ghost, success (5 allowed, 2 deprecated)
  - Sizes: default, sm, xs, icon-sm, icon-xs (5 allowed, 2 deprecated)
- [x] Export subset types/constants in `src/components/ui/button.tsx`
  - Exported ALLOWED_VARIANTS and AllowedVariant type
  - Exported ALLOWED_SIZES and AllowedSize type

### Phase: Refactor Usage
- [x] Replace raw `<button>` with `Button` in `src/routes/settings/index.tsx`
  - Replaced theme toggles, theme presets, color presets, audio previews, sign out
  - All now use Button with appropriate variant/size
- [x] Replace raw `<button>` with `Button` in `src/components/tasks/task-sidebar.tsx`
  - Replaced Review/Implement/Verify, Split From, Merge/QA/Revert, Delete buttons
  - All now use Button with appropriate variant/size
- [x] Replace raw `<button>` with `Button` in `src/components/git/diff-panel.tsx`
  - Replaced comment submission, add/edit/delete, draft cancel/save, modal controls, agent selection, view toggles
  - All now use Button with appropriate variant/size
- [x] Align wrappers to subset in `src/components/git/file-actions.tsx`
  - Removed custom ActionButton component, replaced with Button
  - Updated modal buttons to use Button with appropriate variant/size
- [x] Align wrappers to subset in `src/components/tasks/commit-action-button.tsx`
  - Replaced raw button with Button component
- [x] Align wrappers to subset in `src/components/ui/confirm-dialog.tsx`
  - Replaced raw buttons with Button component

## Key Files
- `src/components/ui/button.tsx` - subset definition, types
- `src/routes/settings/index.tsx` - raw button usage
- `src/components/tasks/task-sidebar.tsx` - raw button usage
- `src/components/git/diff-panel.tsx` - raw button usage
- `src/components/git/file-actions.tsx` - wrapper alignment
- `src/components/tasks/commit-action-button.tsx` - wrapper alignment

## Success Criteria
- [x] Only allowed `variant`/`size` values used from `src/components/ui/button.tsx`
  - Defined ALLOWED_VARIANTS: default, destructive, outline, ghost, success
  - Defined ALLOWED_SIZES: default, sm, xs, icon-sm, icon-xs
  - Deprecated secondary, link variants and lg, icon sizes
- [x] No raw `<button>` in `src/routes/settings/index.tsx`
- [x] No raw `<button>` in `src/components/tasks/task-sidebar.tsx`
- [x] No raw `<button>` in `src/components/git/diff-panel.tsx`
- [x] Wrapper components aligned to use Button component

## Resolved Questions
- ✅ `success` variant kept in subset - used for QA pass buttons and positive confirmations
- ✅ No exceptions for raw `<button>` - confirm-dialog.tsx now uses Button component
