# Refactor __root.tsx

## Problem Statement
`__root.tsx` is 225 lines with mixed responsibilities: document structure, providers, error UI, and entire sidebar implementation. Should extract components for maintainability.

## Scope
**In:**
- Extract sidebar components to dedicated file
- Extract app error fallback to reusable component
- Keep route definition minimal (document, providers, layout shell)

**Out:**
- Changing provider hierarchy or logic
- Modifying sidebar behavior/features
- Restructuring other routes

## Implementation Plan

### Phase 1: Extract Error Fallback
- [x] Create `src/components/ui/app-error-fallback.tsx`
  - ✓ Verified: File exists at `src/components/ui/app-error-fallback.tsx`.
- [x] Move full-page error UI (lines 60-85) to new component
  - ✓ Verified: Full-page error UI present in `src/components/ui/app-error-fallback.tsx`.
- [x] Replace inline JSX with `<AppErrorFallback />` import
  - ✓ Verified: `AppErrorFallback` imported and used in `src/routes/__root.tsx`.

### Phase 2: Extract Sidebar
- [x] Create `src/components/layout/sidebar.tsx`
  - ✓ Verified: File exists at `src/components/layout/sidebar.tsx`.
- [x] Move `Sidebar`, `NavLink`, `TasksNavRow`, `ProjectIndicator` (lines 103-224)
  - ✓ Verified: Components defined in `src/components/layout/sidebar.tsx` and not in `src/routes/__root.tsx`.
- [x] Export only `Sidebar` from new file
  - ✓ Verified: Only `Sidebar` is exported from `src/components/layout/sidebar.tsx`.
- [x] Update `__root.tsx` import
  - ✓ Verified: `Sidebar` imported from `src/components/layout/sidebar.tsx` in `src/routes/__root.tsx`.

### Phase 3: Cleanup
- [x] Remove unused imports from `__root.tsx`
  - ✓ Verified: All imports in `src/routes/__root.tsx` are referenced.
- [ ] Verify no circular deps
  - ✗ Not verified: No circular-dependency tooling run; only direct imports reviewed.
- [ ] Test theme toggle, nav, project picker work
  - ✗ Not verified: Manual UI testing not run.

## Key Files
- `src/routes/__root.tsx` - Trimmed to 68 lines (doc structure + providers)
- `src/components/layout/sidebar.tsx` - New, 121 lines
- `src/components/ui/app-error-fallback.tsx` - New, 31 lines

## Success Criteria
- [ ] `__root.tsx` under 60 lines (achieved: 68 lines, close enough - remaining is providers/imports)
  - ✗ Not met: `src/routes/__root.tsx` is 68 lines.
- [ ] Sidebar renders correctly
  - ✗ Not verified: UI rendering not manually exercised.
- [x] Error boundary fallback works
  - ✓ Verified: `ErrorBoundary` uses `AppErrorFallback` in `src/routes/__root.tsx`.
- [ ] No type errors
  - ✗ Not verified: `npx tsc --noEmit` failed (missing `vitest` types in `src/lib/agent/manager.test.ts` and `src/lib/trpc-session.test.ts`).

## Notes
- Pre-existing type errors in `task-sidebar.tsx` (unrelated to this refactor)
- Created new `src/components/layout/` directory for layout components

## Verification Results
- `npx tsc --noEmit` fails: missing `vitest` types in `src/lib/agent/manager.test.ts` and `src/lib/trpc-session.test.ts`.
- No test script found in `package.json`; automated tests not run.
- Manual UI checks not performed for theme toggle/nav/project picker.
- Circular dependency analysis not run; no tooling invoked.
- `src/routes/__root.tsx` remains 68 lines, above the 60-line target.