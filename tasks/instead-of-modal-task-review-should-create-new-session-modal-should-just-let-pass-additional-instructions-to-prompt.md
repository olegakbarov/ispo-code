# instead of modal task review should create new session. modal should just let pass additional instructions to prompt

## Problem Statement

Currently, task review/verify operations show results in a modal (`ReviewModal`) that runs an agent and displays output inline. This approach:
- Limits visibility and interaction with the agent session
- Doesn't leverage existing agent session UI patterns
- Prevents user from easily navigating away and back

**Goal**: Change review/verify to spawn a new agent session and navigate to `/agents/$sessionId`, similar to how "Run with Agent" works. The modal should only collect configuration (agent type, optional instructions) and then navigate.

## Scope

**Included:**
- Convert `ReviewModal` to a simple configuration dialog
- Navigate to new agent session immediately after spawn
- Pass optional custom instructions through to review/verify prompts
- Maintain existing review vs verify modes
- Update tRPC mutations to return sessionId

**NOT Included:**
- Changes to review/verify prompt logic (keep existing prompts in `src/trpc/tasks.ts`)
- Changes to agent session display UI
- Backward compatibility for modal-based reviews

## Implementation Plan

### Phase 1: Update tRPC Mutations
- [x] Modify `reviewWithAgent` mutation to accept optional `instructions` parameter
- [x] Ensure both `reviewWithAgent` and `verifyWithAgent` return sessionId in response
- [x] Update `buildTaskSpecReviewPrompt` to accept and incorporate custom instructions (similar to verify)

### Phase 2: Simplify ReviewModal
- [x] Remove agent session polling logic from modal (`reviewSession`, `reviewAgentSession` state)
- [x] Remove results display phase (preview/edit, StreamingMarkdown, extraction logic)
- [x] Remove `extractMarkedContent` function and output display components
- [x] Keep only configuration phase: agent type selector + custom instructions textarea
- [x] Change "Start Review/Verification" button to immediately call mutation and close modal
- [x] Remove `onApply` callback from props (no longer needed)
- [x] Remove running/completed/error states from modal

### Phase 3: Update Tasks Page Logic
- [x] Remove `reviewSessionId` state from `tasks.tsx`
- [x] Remove `reviewSession` polling query
- [x] Remove `reviewAgentSession` memoized value
- [x] Modify `handleStartReview` to navigate to `/agents/$sessionId` after mutation succeeds
- [x] Remove `handleApplyReview` callback (no longer applies to editor)
- [x] Remove `handleCancelReview` callback (cancellation happens in agent session page)
- [x] Update `handleCloseReviewModal` to only close modal

### Phase 4: Update ReviewModal Props Interface
- [x] Change prop signature: remove `agentSession`, `onApply`, `onCancel`
- [x] Keep: `isOpen`, `mode`, `taskTitle`, `agentType`, `availableTypes`, `onClose`, `onStart`
- [x] Update `onStart` callback signature: `(agentType: AgentType, instructions?: string) => Promise<void>`

### Phase 5: Navigation Integration
- [x] Import `useNavigate` from TanStack Router in `tasks.tsx`
- [x] After mutation success in `handleStartReview`, navigate to `/agents/${result.sessionId}`
- [x] Close modal after navigation

### Phase 6: Clean up
- [x] Remove unused imports from `ReviewModal` (StreamingMarkdown, Switch, etc.)
- [x] Remove agent session display logic from modal
- [ ] Test both review and verify modes with and without custom instructions
- [ ] Verify navigation flow works correctly

## Key Files

- `src/components/tasks/review-modal.tsx` - Remove results display, keep only config phase
- `src/routes/tasks.tsx` - Remove review session state/polling, add navigation logic
- `src/trpc/tasks.ts` - Add `instructions` param to `reviewWithAgent`, update `buildTaskSpecReviewPrompt`
- `src/components/tasks/agent-types.ts` - May need to update types if modal interface changes significantly

## Testing

- [ ] Click "Review" button - modal opens with config
- [ ] Select agent type, optionally add instructions, click start
- [ ] Verify navigation to `/agents/$sessionId` with correct session
- [ ] Verify agent receives correct prompt with instructions appended
- [ ] Click "Verify" button - same flow as review
- [ ] Verify verify mode receives instructions correctly
- [ ] Cancel from modal before starting - modal closes, no agent spawned
- [ ] Navigate back to tasks page - can see task is unchanged

## Success Criteria

- [ ] Review/verify operations create new agent sessions visible at `/agents/$sessionId`
- [ ] ReviewModal is simplified to config-only (no agent execution display)
- [ ] Custom instructions flow through to both review and verify prompts
- [ ] Navigation happens immediately after session spawn
- [ ] User can navigate away from session and return using sidebar
- [ ] No modal-based result display or "Apply Changes" workflow

## Unresolved Questions

None - requirements are clear from existing patterns in the codebase.
