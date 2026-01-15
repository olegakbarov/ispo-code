# Generate commit messages with Gemini Flash in session sidebar

## Problem Statement
Commit messages currently manual input. Use Gemini Flash (fast, cheap) to auto-generate based on task context + changed files. Session sidebar already shows changed files + commit form - add "Generate" button.

## Scope
**In:**
- Generate button in ThreadSidebar GitSection commit form
- tRPC mutation `git.generateCommitMessage`
- Gemini Flash inference (fast, 1M context)
- Input: task title/description + changed file list + git diffs
- Pre-fill textarea with generated message

**Out:**
- No streaming (single shot generation)
- No custom templates/prompts UI (hardcoded system prompt)
- No commit history analysis (just current changes)
- No other UI locations (TaskCommitPanel unchanged)

## Implementation Plan

### Phase: Backend - Commit Message Generator
- [x] Create `src/lib/agent/commit-message-generator.ts` with `generateCommitMessage()` function
- [x] Use Vercel AI SDK `generateText()` + `google("gemini-2.0-flash-exp")`
- [x] System prompt: "Generate concise git commit message (50 char summary + optional body). Follow conventional commits style."
- [x] Input params: `taskTitle: string`, `changedFiles: string[]`, `diffs?: string[]`
- [x] Return `{ message: string }` or throw on error

### Phase: tRPC Endpoint
- [x] Add `generateCommitMessage` mutation to `src/trpc/git.ts`
- [x] Input schema: `z.object({ taskTitle: z.string().optional(), taskDescription: z.string().optional(), files: z.string().array() })`
- [x] Fetch diffs for files via `getDiffForFiles()` (reuse existing logic)
- [x] Call `generateCommitMessage()` with task + files + diffs
- [x] Return generated message string

### Phase: UI Integration - ThreadSidebar
- [x] Add "Generate" button (with AI icon) inside commit message textarea in `src/components/agents/thread-sidebar.tsx:277-314`
- [x] Get task title from session.taskPath (extract and format from filename)
- [x] Get selected files from `selectedFiles` state (already tracked)
- [x] Wire button to `trpc.git.generateCommitMessage.useMutation()`
- [x] On success: populate textarea with generated message
- [x] Loading state: disable button, show spinner
- [x] Error handling: inline error display (matching commit error style)

### Phase: Task Context Resolution
- [x] Extract task title from session.taskPath (convert filename to title format)
- [x] If no task linked: pass undefined, generator works with file list only
- [x] Pass task title to mutation (optional parameter)

## Key Files
- `src/lib/agent/commit-message-generator.ts` - New generator function
- `src/trpc/git.ts` - Add `generateCommitMessage` mutation (after line 120)
- `src/components/agents/thread-sidebar.tsx` - GitSection commit form (lines 277-314)
- `src/trpc/agent.ts` - May need task title resolution helper

## Success Criteria
- [x] Generate button visible in session sidebar commit form
- [ ] Clicking generates message in <2s (Gemini Flash speed) - needs testing
- [ ] Message follows conventional commits style - needs testing
- [x] Works with/without linked task
- [x] Error states handled gracefully

## Implementation Notes
- Used `gemini-2.0-flash-exp` model for fast generation
- Button positioned inside textarea (top-right) with Sparkles icon + "AI" text
- Task title extracted from taskPath filename (kebab-case → Title Case)
- Diff strings formatted for better AI understanding (shows old/new content)
- Error display matches existing commit error style for consistency
