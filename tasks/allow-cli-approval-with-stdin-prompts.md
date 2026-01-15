# Allow CLI Approvals When Prompt Uses STDIN

## Problem Statement
When prompts are passed via stdin, the CLI runner closes stdin immediately, preventing later approval or input responses.

## Scope
- In scope: preserve interactive stdin for approvals when needed.
- Out of scope: changing CLI UX or removing approval prompts.

## Implementation Plan
- [ ] Evaluate CLI-specific prompt options (args vs stdin vs file) for Claude and Codex.
- [ ] Keep stdin open when approvals may be required, or pipe prompt via file and keep stdin interactive.
- [ ] Ensure timeouts still apply.

## Key Files
- `src/lib/agent/cli-runner.ts`

## Testing
- [ ] Send a large prompt and trigger approval; verify approval is accepted.
- [ ] Confirm no regression for non-approval runs.

## Success Criteria
- [ ] Approval and input responses work even when prompt is sent via stdin.
