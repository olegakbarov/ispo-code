# selected file in review should be part of url

## Problem Statement
Review diff selection not encoded in URL. Refresh/share loses active file. Deep link to specific diff missing.

## Scope
**In:**
- Review file in URL search params for /tasks/$
- Read/write active review file in review panel
- Preserve archive/sort search params on URL updates
**Out:**
- Staged/working view in URL
- Non-review screens or agent diff modals
- Route path changes beyond search params

## Implementation Plan

### Phase: Routing + Props
- [x] Add reviewFile search param in /tasks/$ schema
- [x] Pass reviewFile through TasksPage and TaskEditor
- [x] Include reviewFile in buildSearchParams when in review

### Phase: Review URL Sync
- [x] Initialize active/open file from reviewFile on load
- [x] Update reviewFile on file select and tab switch
- [x] Clear reviewFile when active file closes

## Key Files
- `src/routes/tasks/$.tsx` - add reviewFile search param
- `src/routes/tasks/_page.tsx` - plumb reviewFile, update search builder
- `src/components/tasks/task-editor.tsx` - pass reviewFile to review panel
- `src/components/tasks/task-review-panel.tsx` - URL sync for active file

## Success Criteria
- [x] Selecting a review file updates URL with reviewFile
- [x] Loading a review URL opens that file diff
- [x] Closing active file removes reviewFile

## Unresolved Questions
- Prefer search key name reviewFile or file - **Chose `reviewFile` for clarity**
- Include diff view in URL or keep working-only - **Kept working-only per scope**
- Clear reviewFile on mode switch to edit - **Yes, cleared via buildSearchParams(null)**
