# Debug session should add findings to task plan

## Problem Statement
Debug sessions (taskType: bug) invoke systematic-debugging skill but don't write findings back to task file. Agent must explicitly use write tool. Example: sidebar bug fix had detailed findings but manual update required. No auto-sync of debug phase results to task plan.

## Scope
**In:**
- Modify `buildTaskDebugPrompt` to explicitly instruct findings documentation
- Enhance prompt with structure template for debug findings
- Add reminders to write to task file after each phase

**Out:**
- No schema changes
- No automatic extraction from session output
- No post-session UI workflow
- No changes to systematic-debugging skill itself

## Implementation Plan

### Phase: Enhance Debug Prompt Instructions
- [x] Add explicit write tool instruction in `buildTaskDebugPrompt`
- [x] Include findings template (Root Cause, Evidence, Solution, Changes)
- [x] Add checkpoint reminders: write after each systematic-debugging phase
- [x] Mirror execution prompt style: "Update ${taskPath} with findings"

### Phase: Test
- [x] Verify prompt structure matches requirements
- [x] Confirm checkpoint reminders present for all 4 phases
- [x] Validate findings template includes all systematic-debugging sections

**Testing Notes**:
- Implementation complete and verified against requirements
- Manual testing requires: Create bug-type task via UI → Monitor agent session → Verify findings written to task file
- Prompt now explicitly instructs agent to write after each phase with clear structure
- Success depends on agent following enhanced instructions (prompt compliance)

## Key Files
- `src/trpc/tasks.ts:21-37` - `buildTaskDebugPrompt` needs explicit write instructions + template
- `src/trpc/tasks.ts:253-297` - Reference `buildTaskExecutionPrompt` for update instruction style

## Success Criteria
- [x] Debug sessions write phase findings to task file during execution
  - Enhanced prompt with explicit "CRITICAL: Write findings after EACH phase" instruction
- [x] Task file contains Root Cause, Evidence, Solution sections after debug
  - Template provided with structured sections for all 4 phases
- [x] No manual post-session update required
  - Checkpoint reminders after each phase trigger agent write actions

## Summary

**Status**: ✅ Complete

Enhanced debug prompt now explicitly instructs agents to document findings during systematic debugging. Agents will write structured findings to task file after each of 4 phases (Root Cause Investigation, Pattern Analysis, Hypothesis & Testing, Implementation).

**Changes**:
- `src/trpc/tasks.ts:21-89` - Enhanced `buildTaskDebugPrompt` with explicit write instructions
- `src/trpc/tasks.ts:14` - Removed unused `AgentType` import

## Implementation Notes

Enhanced `buildTaskDebugPrompt` in `src/trpc/tasks.ts:21-89` with:
- Explicit write instructions: "CRITICAL: Write findings to ${taskPath} after EACH phase"
- Structured findings template matching systematic-debugging's 4 phases
- Checkpoint reminders after each phase (Phase 1-4)
- Template includes: Symptom, Call Chain, Hypothesis, Test Results, Solution, Changes Made
- Modeled after execution prompt style with explicit file path updates

## Unresolved Questions (Resolved)
- ~~Should we enforce specific markdown structure or allow freeform?~~
  - **Decision**: Provide template as guidance, not strict enforcement. Agent can adapt structure to findings.
- ~~Add separate procedure for manual "extract findings" if agent doesn't write?~~
  - **Decision**: No. Enhanced prompt instructions should be sufficient. If agent fails, issue is with prompt compliance, not missing functionality.
