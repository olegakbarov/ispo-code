# task component should allow commit changes related to session of this task

## Problem Statement
Task view shows task content but lacks git integration. When agent executes task, changed files tracked in session metadata not accessible for review/commit from task UI. TaskCommitPanel exists but disconnected from task-session relationship.

## Scope
**In:**
- Display TaskCommitPanel in task editor when session active/completed
- Wire session->files connection via `agent.getChangedFiles`
- Commit scoped to session's edited files
- Auto-populate message from task title
- Creating new commits UI (use existing git page)

**Out:**
- Manual file selection outside session scope
- Modifying commit history/amend

## Implementation Plan

### Phase: Wire Session to Task UI
- [x] Add sessionId prop to TaskEditor (from activeSessionInfo)
- [x] Import TaskCommitPanel in TaskEditor
- [x] Render panel below editor when sessionId present
- [x] Pass sessionId + taskTitle to TaskCommitPanel
- [x] Commit UI

### Phase: Test Integration
- [x] Verify panel shows files from active agent session
- [x] Verify commit creates scoped git commit
- [x] Panel clears after commit

## Implementation Notes
- TaskCommitPanel was already fully implemented with all required features
- Added sessionId prop to TaskEditor interface and component
- Passed activeSessionId from tasks.tsx to TaskEditor
- TaskCommitPanel rendered conditionally when sessionId exists
- Panel positioned below editor with border-t for visual separation
- Auto-population of commit message with task title handled by TaskCommitPanel's onFocus handler
- Build completed successfully with no TypeScript errors

## Key Files
- `src/routes/tasks.tsx` - pass sessionId from activeSessionInfo to TaskEditor
- `src/components/tasks/task-editor.tsx` - add sessionId prop, render TaskCommitPanel conditionally
- `src/components/tasks/task-commit-panel.tsx` - already implemented, reuse as-is

## Success Criteria
- [x] TaskCommitPanel visible in task view when session exists
- [x] Files from session metadata displayed for commit
- [x] Commit message auto-populated with task title
- [x] Scoped commit creates git commit with selected session files
