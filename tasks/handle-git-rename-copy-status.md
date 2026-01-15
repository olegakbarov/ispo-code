# Handle Git Rename and Copy Status Correctly

## Problem Statement
`git status --porcelain` rename and copy entries are parsed as `old -> new` strings, so stage, diff, and discard use invalid file paths.

## Scope
- In scope: robust parsing of rename and copy entries and correct file paths for actions.
- Out of scope: custom diff UI changes.

## Implementation Plan
- [ ] Switch to `git status --porcelain=v2 -z` and parse fields for `R` and `C`.
- [ ] Ensure staged and modified lists use the new path for actions.
- [ ] Update stage and unstage validation to accept rename targets.

## Key Files
- `src/lib/agent/git-service.ts`

## Testing
- [ ] Rename a file and confirm status shows the new path.
- [ ] Stage and unstage the renamed file and verify diff works.

## Success Criteria
- [ ] Rename and copy operations work end-to-end in the git UI.
