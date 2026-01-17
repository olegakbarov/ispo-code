# Add Ralph Agent Type

<!-- taskId: HOLneAUPMC -->

## Problem Statement
Ralph (https://github.com/ky-zo/ralph) is an autonomous AI dev loop orchestrator that converts PRDs to tasks and executes them via Claude Code. Integrating ralph would enable autonomous multi-task workflows with built-in rate limiting and circuit breakers.

## Ralph Overview
- **What**: Orchestration system that iteratively implements features from written requirements
- **How**: PRD → JSON tasks → Claude Code execution loop → progress tracking
- **CLI**: Shell scripts (`new.sh`, `convert.sh`, `start.sh`, `monitor.sh`)
- **Features**: Rate limiting (100 calls/hr), circuit breaker, branch isolation, tmux monitoring

## Scope
**In:**
- `src/lib/agent/types.ts` - add `ralph` to AgentType
- `src/lib/agent/cli-runner.ts` - add ralph CLI detection + availability
- `src/lib/agent/ralph.ts` - new agent implementation
- `src/lib/agent/model-registry.ts` - register ralph (uses Claude under hood)
- `src/lib/agent/config.ts` - add label + config
- `src/lib/agent/manager.ts` - wire ralph agent factory
- `src/daemon/agent-daemon.ts` - wire daemon spawn
- `src/components/tasks/implement-modal.tsx` - add to agent config
- `src/components/tasks/create-task-form.tsx` - add to planner candidates
- `src/components/settings/agent-defaults-section.tsx` - add to defaults
- `.env.example` - document RALPH_PATH if needed
- `CLAUDE.md` - document ralph in agent types table

**Out:**
- ralph installation/setup scripts
- PRD template files
- tmux integration (out of scope for initial impl)

## Implementation Plan

### Phase 1: Understand Ralph CLI
- [ ] Clone ralph repo locally and examine shell script interfaces
- [ ] Document ralph CLI args, output format, exit codes
- [ ] Identify how ralph reports progress/completion
- [ ] Determine if ralph can run without tmux (headless mode)

### Phase 2: Core Agent
- [ ] Add `ralph` to `AGENT_TYPES` in `src/lib/agent/types.ts`
- [ ] Add ralph CLI path detection in `src/lib/agent/cli-runner.ts`
- [ ] Create `src/lib/agent/ralph.ts` with:
  - PRD-to-prompt conversion (or direct prompt mode)
  - Process spawning for ralph start.sh
  - Output parsing (ralph uses Claude Code, may output JSON)
  - Progress/completion event handling
- [ ] Register ralph in `src/lib/agent/model-registry.ts` (note: model is Claude)
- [ ] Add ralph label in `src/lib/agent/config.ts`
- [ ] Wire ralph in `src/lib/agent/manager.ts` spawn logic
- [ ] Wire ralph in `src/daemon/agent-daemon.ts`

### Phase 3: UI Integration
- [ ] Add ralph entry in `src/components/tasks/implement-modal.tsx`
- [ ] Add ralph to planner candidates in `src/components/tasks/create-task-form.tsx`
- [ ] Add ralph to defaults in `src/components/settings/agent-defaults-section.tsx`

### Phase 4: Docs
- [ ] Add `RALPH_PATH` to `.env.example` if custom path needed
- [ ] Update `CLAUDE.md` agent types table with ralph entry

## Key Files
- `src/lib/agent/types.ts` - agent type union (line 6)
- `src/lib/agent/cli-runner.ts` - CLI detection (getCLIPath, getAvailableAgentTypes)
- `src/lib/agent/ralph.ts` - new file for ralph orchestration
- `src/lib/agent/manager.ts` - agent factory switch (spawnAgent method)
- `src/daemon/agent-daemon.ts` - daemon spawn switch

## Technical Considerations

### Ralph vs Direct Claude CLI
| Aspect | Claude CLI | Ralph |
|--------|-----------|-------|
| Input | Single prompt | PRD file or prompt |
| Execution | Single task | Multi-task loop |
| Rate Limit | None (API) | Built-in (100/hr) |
| Isolation | Worktree | Branch per feature |
| Progress | Stream output | Task completion status |

### Integration Approach Options
1. **Wrap start.sh** - Spawn ralph's shell script, parse output
2. **Import ralph logic** - Extract core loop into TypeScript
3. **Hybrid** - Use ralph for PRD→tasks, run tasks via existing Claude agent

Recommended: Start with Option 1 (wrap start.sh) for minimal integration, evolve to Option 3 for tighter ispo-code integration.

### Output Parsing
Ralph uses Claude Code underneath, so output may be:
- Claude Code JSON stream (if ralph passes through)
- Ralph's own progress format (task X completed, Y remaining)
- Need to examine ralph source to determine

## Success Criteria
- [ ] `ralph` appears in agent type dropdown when ralph CLI installed
- [ ] Ralph agent executes PRD-style prompts via start.sh
- [ ] Progress/completion events emit correctly
- [ ] Docs reflect ralph availability and requirements

## Unresolved Questions
1. Does ralph support headless mode (no tmux)?
2. What's ralph's output format - passthrough Claude JSON or custom?
3. Can ralph accept a single prompt vs requiring PRD file?
4. Does ralph require specific directory structure?
5. How does ralph handle failures - retry logic built in?
6. License compatibility (need to verify ky-zo/ralph license)
