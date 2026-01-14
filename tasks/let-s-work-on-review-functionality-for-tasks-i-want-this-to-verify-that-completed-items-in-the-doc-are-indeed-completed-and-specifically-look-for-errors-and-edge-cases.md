# Task Review Verification System

## Problem Statement

The task system currently tracks completion status via GFM checkboxes (`- [x]`), but there's no verification mechanism to ensure that checked items are actually completed correctly. Agents may mark items as done without proper validation, tests might be failing, or edge cases might be missed. We need a review system that:

1. Verifies that completed checklist items are truly finished
2. Identifies errors, bugs, and edge cases in completed work
3. Provides actionable feedback on what needs fixing
4. Integrates seamlessly with the existing task UI

## Proposed solution

on click 'review' from task UI (currently a stud) we need to launch agent instructed to verify all statements in the document and return custom review result component that would be essentially editable document that can be in on click passed to agent to fix the issues

## Implementation

### Completed Items

- [x] Created ReviewModal component (`src/routes/tasks/-review-modal.tsx`)
  - Modal dialog with agent type selection
  - Optional custom review instructions input
  - Real-time agent progress display with status banner
  - Edit/Preview toggle for reviewed content
  - Apply/Reject buttons for accepting or discarding changes
  - Content extraction from agent output markers (`===TASK_REVIEW_OUTPUT_START===` / `===TASK_REVIEW_OUTPUT_END===`)

- [x] Integrated review functionality into tasks page (`src/routes/tasks.tsx`)
  - Added `reviewWithAgent` mutation calling tRPC endpoint
  - Implemented review session state management and live polling
  - Created handlers for start review, apply, reject, and cancel operations
  - Connected Review button to open modal

- [x] Backend support (already existed in `src/trpc/tasks.ts`)
  - `reviewWithAgent` procedure for spawning review agents
  - `buildTaskReviewPrompt` function generates review instructions
  - Agent outputs reviewed content between markers for parsing

- [x] **Full Verification Mode** (added 2026-01-14)
  - Updated `buildTaskReviewPrompt` to enable tool access for actual verification
  - Agent can now: read files, run tests, search code patterns, execute bash commands
  - Verification annotations added as sub-items under each completed checkbox
  - Items that fail verification are automatically unchecked with explanation
  - Updated UI labels: "Verify Task", "Start Verification", "Verification results"

- [x] Fixed React hooks error in ReviewModal
  - Moved `useMemo` hooks before early return to fix "Rendered more hooks than during the previous render" error

### How It Works

1. **User clicks "Review" button** → Opens ReviewModal (now titled "Verify Task")
2. **User selects agent type** (cerebras, opencode, claude, codex) and optionally adds custom instructions
3. **User clicks "Start Verification"** → Spawns agent with verification prompt
4. **Agent VERIFIES each completed item** → Reads files, runs tests, searches for evidence
5. **Agent annotates results** → Adds ✓/✗ sub-items, unchecks items that aren't actually done
6. **Agent outputs verified content** → Between `===TASK_REVIEW_OUTPUT_START===` and `===TASK_REVIEW_OUTPUT_END===` markers
7. **Modal displays results** → Shows verification results with edit/preview mode
8. **User applies or rejects** → Apply replaces draft content, Reject closes modal

### Key Features

- **Actual verification**: Agent reads files, runs tests, checks code exists
- **Non-destructive**: Verified content is only applied when user clicks "Apply Changes"
- **Real-time progress**: Shows agent status, operation count, and live output
- **Verification annotations**: Each checked item gets ✓ Verified or ✗ Not found notes
- **Auto-uncheck failures**: Items that fail verification are unchecked with explanation
- **Multi-agent support**: Works with all available agent types (cerebras, opencode, claude, codex)
- **Edit/Preview toggle**: View verified content as markdown or raw text
- **Reopen capability**: Session persists so user can reopen and review results