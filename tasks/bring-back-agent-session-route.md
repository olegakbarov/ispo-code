# bring back agent session route

## Problem Statement
Missing /agents/$sessionId route; session detail view gone.
Need dedicated session page for output, metadata, git actions.

## Scope
**In:**
- `src/routes/agents.tsx` layout route
- `src/routes/agents/$sessionId.tsx` session page data + UI
- `src/routes/agents/$sessionId.tsx` actions: cancel/approve/resume + attachments
- `src/components/tasks/task-sessions.tsx` session card navigation
- `src/lib/hooks/use-adaptive-polling.ts` usage for session polling

**Out:**
- `src/routes/agents/index.tsx` list page
- `src/streams/schemas.ts` or daemon changes
- `src/trpc/agent.ts` new endpoints

## Implementation Plan

### Phase: Routes
- [x] Create layout route `src/routes/agents.tsx`
  - Verified: layout route uses `createFileRoute('/agents')` + `Outlet` in `src/routes/agents.tsx:8`.
- [x] Create session route `src/routes/agents/$sessionId.tsx` with param validation and empty/error states
  - Verified: param validation via zod in `src/routes/agents/$sessionId.tsx:31`; loading/error/not-found states in `src/routes/agents/$sessionId.tsx:120`.

### Phase: Data + UI
- [x] Fetch session via `trpc.agent.getSessionWithMetadata` in `src/routes/agents/$sessionId.tsx`
  - Verified: `getSessionWithMetadata.useQuery` in `src/routes/agents/$sessionId.tsx:44`.
- [x] Add adaptive polling with `useAdaptivePolling` in `src/routes/agents/$sessionId.tsx`
  - Verified: `useAdaptivePolling` + `refetchInterval` observer in `src/routes/agents/$sessionId.tsx:50`.
- [x] Render prompt + banner in `src/routes/agents/$sessionId.tsx`
  - Verified: `PromptDisplay` and `AgentProgressBanner` render in `src/routes/agents/$sessionId.tsx:203`.
- [x] Render output + sidebar in `src/routes/agents/$sessionId.tsx`
  - Verified: `OutputRenderer` + `ThreadSidebar` render in `src/routes/agents/$sessionId.tsx:246` and `src/routes/agents/$sessionId.tsx:306`.

### Phase: Actions + Entry Points
- [x] Wire cancel action in `src/routes/agents/$sessionId.tsx` via `trpc.agent.cancel`
  - Verified: `cancel.useMutation` + `handleCancel` + banner callback in `src/routes/agents/$sessionId.tsx:79` and `src/routes/agents/$sessionId.tsx:213`.
- [x] Wire approve action in `src/routes/agents/$sessionId.tsx` via `trpc.agent.approve`
  - Verified: `approve.useMutation` + approval buttons in `src/routes/agents/$sessionId.tsx:83` and `src/routes/agents/$sessionId.tsx:217`.
- [x] Wire resume action in `src/routes/agents/$sessionId.tsx` via `trpc.agent.sendMessage`
  - Verified: `sendMessage.useMutation` + resume input/attachments in `src/routes/agents/$sessionId.tsx:87` and `src/routes/agents/$sessionId.tsx:267`.
- [x] Add navigation to /agents/$sessionId from `src/components/tasks/task-sessions.tsx`
  - Verified: links to `/agents/$sessionId` in `src/components/tasks/task-sessions.tsx:145` and `src/components/tasks/task-sessions.tsx:225`.

## Key Files
- `src/routes/agents.tsx` - layout route
- `src/routes/agents/$sessionId.tsx` - session page UI, data, actions
- `src/components/tasks/task-sessions.tsx` - session card navigation

## Success Criteria
- [x] Visiting /agents/<sessionId> shows prompt, output, and sidebar for a real session
  - Verified: prompt/output/sidebar render when session exists in `src/routes/agents/$sessionId.tsx:203`, `src/routes/agents/$sessionId.tsx:246`, and `src/routes/agents/$sessionId.tsx:306`.
- [x] Session actions work: cancel for running, resume for resumable, approve when waiting_approval
  - Verified: cancel mutation + banner in `src/routes/agents/$sessionId.tsx:79`; approval banner gated by waiting_approval in `src/routes/agents/$sessionId.tsx:217`; resume input gated by `canResume || isWaitingInput` in `src/routes/agents/$sessionId.tsx:267`.
- [x] Task session cards navigate to /agents/<sessionId>
  - Verified: session card links in `src/components/tasks/task-sessions.tsx:145`.

## Unresolved Questions
- Should /agents/$sessionId support sending input for waiting_input state?
  - **Answer:** Yes, implemented! The `waiting_input` status shows a resume input area where users can send a response to the agent.

## Verification Results
Skill used: react-best-practices for React route/component verification.

### Test Results
FAIL: `npm run test:run` reported 8 failed tests, 185 passed (failed files: `src/lib/tasks/create-task-visibility.test.ts`, `src/lib/agent/manager.test.ts`). Verification incomplete until tests pass.

### Item Verification
- PASS: Create layout route `src/routes/agents.tsx`
- PASS: Create session route `src/routes/agents/$sessionId.tsx` with param validation and empty/error states
- PASS: Fetch session via `trpc.agent.getSessionWithMetadata`
- PASS: Add adaptive polling with `useAdaptivePolling`
- PASS: Render prompt + banner
- PASS: Render output + sidebar
- PASS: Wire cancel action via `trpc.agent.cancel`
- PASS: Wire approve action via `trpc.agent.approve`
- PASS: Wire resume action via `trpc.agent.sendMessage`
- PASS: Add navigation to /agents/$sessionId from task sessions
- PASS: Visiting /agents/<sessionId> shows prompt, output, and sidebar
- PASS: Session actions work: cancel/resume/approve
- PASS: Task session cards navigate to /agents/<sessionId>