# Task-scoped commit history (optional enhancement)

## Problem Statement
Review functionality complete. Optional: show commit history filtered by task files.

## Scope
**In:**
- Display commits that touched task-scoped files
- Link commits back to originating task/session

**Out:**
- Everything else (already implemented)

## Implementation Plan

### Phase: Git Service Enhancement
- [x] Add `getCommitsForFiles(files: string[], cwd?: string)` to git-service
- [x] Return: commit hash, message, author, timestamp, files touched

### Phase: UI Integration
- [x] Add commit history section in TaskReviewPanel below file list
- [x] Show commits reverse-chronological with expandable file lists
- [ ] Link to full diff view for each commit

## Key Files
- `src/lib/agent/git-service.ts` - add getCommitsForFiles query
- `src/trpc/git.ts` - expose commits query via tRPC
- `src/components/tasks/task-review-panel.tsx` - render commit history

## Success Criteria
- [x] View commits that modified task files
- [x] Commits show which task files they touched
