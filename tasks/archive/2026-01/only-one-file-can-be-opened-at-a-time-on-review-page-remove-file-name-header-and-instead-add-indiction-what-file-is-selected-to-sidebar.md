# only one file can be opened at a time on review page. remove file name header and instead add indiction what file is selected to sidebar

## Problem Statement
Multiple files open on review; file name header redundant. Need single active file and sidebar selection indication.

## Scope
**In:**
- review page single-file open behavior
- remove diff file name header/tabs
- sidebar indicator for active file
**Out:**
- commit selection checkbox logic
- git diff views outside task review
- agent comment send flow

## Implementation Plan

### Phase: Single-File State
- [x] Replace open file append logic with single active file in `src/components/tasks/task-review-panel.tsx`
  - Verified: `handleFileClick` replaces openFiles with a single entry and updates active state (`src/components/tasks/task-review-panel.tsx:259`)
- [x] Align `src/components/git/diff-panel.tsx` props/state to single `activeFile`
  - Verified: DiffPanel gates rendering on activeFile and binds it to the diff viewer (`src/components/git/diff-panel.tsx:542`, `src/components/git/diff-panel.tsx:644`)

### Phase: Sidebar Indication
- [x] Add `activeFile` prop to `src/components/tasks/file-list-panel.tsx`
  - Verified: activeFile prop is defined and forwarded to SessionGroup, and wired from the review panel (`src/components/tasks/file-list-panel.tsx:22`, `src/components/tasks/file-list-panel.tsx:83`, `src/components/tasks/task-review-panel.tsx:371`)
- [x] Render active file indicator style in `src/components/tasks/file-list-panel.tsx`
  - Verified: active row styling uses isActive with highlight classes (`src/components/tasks/file-list-panel.tsx:151`, `src/components/tasks/file-list-panel.tsx:222`)

### Phase: Header Cleanup
- [x] Remove file tabs/header UI in `src/components/git/diff-panel.tsx`
  - Verified: DiffPanel render goes directly to content without DiffTabsHeader; header component only defined later (`src/components/git/diff-panel.tsx:542`, `src/components/git/diff-panel.tsx:934`)
- [x] Remove multi-file close handlers from review flow
  - Verified: close handlers now clear single-file state and diff data (`src/components/tasks/task-review-panel.tsx:303`, `src/components/tasks/task-review-panel.tsx:310`)

## Key Files
- `src/components/tasks/task-review-panel.tsx` - single-file state, prop wiring
- `src/components/tasks/file-list-panel.tsx` - active file indicator UI
- `src/components/git/diff-panel.tsx` - remove file name header

## Success Criteria
- [x] Clicking a file replaces the previous diff view
  - Verified: file click resets openFiles to a single file and sets activeFile (`src/components/tasks/task-review-panel.tsx:259`)
- [x] Diff panel shows no file name header
  - Verified: no DiffTabsHeader is rendered in the main DiffPanel return (`src/components/git/diff-panel.tsx:542`)
- [x] Sidebar marks the active file
  - Verified: activeFile comparison drives active row styling (`src/components/tasks/file-list-panel.tsx:151`, `src/components/tasks/file-list-panel.tsx:222`)

## Implementation Notes
- Modified `handleFileClick` in task-review-panel.tsx to replace files instead of appending (src/components/tasks/task-review-panel.tsx:255-277)
- Added `activeFile` prop to FileListPanel interface and passed through SessionGroup to FileListItem (src/components/tasks/file-list-panel.tsx:27,39,83,99,110,151,157,172,180)
- Added visual indicator for active file with `bg-primary/20` background and `border-l-2 border-primary` (src/components/tasks/file-list-panel.tsx:222-227)
- Removed `DiffTabsHeader` component rendering from DiffPanel (src/components/git/diff-panel.tsx:538)
- Updated close handlers to clear state in single-file mode (src/components/tasks/task-review-panel.tsx:301-313)

## Verification Results
- Tests: `npm test` failed (vitest) with 7 failing tests in `src/lib/agent/manager.test.ts` and `src/lib/agent/__tests__/git-service.test.ts`, plus worker fork EAGAIN/unhandled errors.
- Notes: vitest warned that `src/routes/tasks/_page.tsx` does not export a Route.