# Handle Git Rename and Copy Status Correctly

## Problem Statement
`git status --porcelain` rename and copy entries are parsed as `old -> new` strings, so stage, diff, and discard use invalid file paths.

## Scope
- In scope: robust parsing of rename and copy entries and correct file paths for actions.
- Out of scope: custom diff UI changes.

## Implementation Plan
- [x] Switch to `git status --porcelain=v2 -z` and parse fields for `R` and `C`.
- [x] Ensure staged and modified lists use the new path for actions.
- [x] Update stage and unstage validation to accept rename targets.

## Key Files
- `src/lib/agent/git-service.ts`

## Testing
- [x] Rename a file and confirm status shows the new path.
- [x] Stage and unstage the renamed file and verify diff works.

## Success Criteria
- [x] Rename and copy operations work end-to-end in the git UI.

## Implementation Notes
- Switched from porcelain v1 to v2 format with null-byte delimiters
- Porcelain v2 provides structured entries for renames (type "2") and copies
- For rename entries: new path is at index 9, old path is in next null-delimited entry
- All validation logic automatically works since it validates against the new path
- Tested: status, stage, unstage, and diff operations all work correctly
