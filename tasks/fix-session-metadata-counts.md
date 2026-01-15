# Fix Session Metadata Duration and Message Counts

## Problem Statement
`MetadataAnalyzer` never updates duration or message counts, so the UI shows 0 duration and 0 message counts for active sessions.

## Scope
- In scope: track duration and message counts from output chunks.
- Out of scope: full redesign of the metadata schema.

## Implementation Plan
- [x] Record session start time in `MetadataAnalyzer`.
- [x] Update `duration` on each chunk or on completion.
- [x] Increment user and assistant message counts based on `user_message` and `text` chunk types.
- [x] Add counts for tool results if needed by the UI.

## Key Files
- `src/lib/agent/metadata-analyzer.ts`
- `src/components/agents/thread-sidebar.tsx`

## Implementation Details
- Added `sessionStartTime` field to track session start
- Duration is calculated as `Date.now() - sessionStartTime` on each chunk
- Added `isInAssistantMessage` flag to count only the first text chunk of each assistant response
- User messages increment count when `user_message` chunk is received
- Assistant messages increment count on first `text` chunk of each response
- Flag resets when new user message arrives to properly track conversation turns

## Testing
- [x] Build succeeds with no TypeScript errors
- [ ] Manual test: Run a session and verify duration increases over time
- [ ] Manual test: Send a follow-up message and verify user and assistant counts update

## Success Criteria
- [x] Code implementation complete
- [ ] Manual verification pending
