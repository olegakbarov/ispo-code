# Make Agents Work in Subtrees

## Problem Statement

Currently, agents can only operate at the repository root (`process.cwd()`). When users want to work on a specific subdirectory or component (e.g., `packages/backend`, `src/components/auth`), agents have full access to the entire codebase, which:

1. **Reduces focus**: Agents see the entire repository context, making it harder to focus on specific subtrees
2. **Wastes context window**: Tool outputs include irrelevant files from other parts of the codebase
3. **No directory scoping**: Can't restrict an agent session to work only within a specific folder
4. **Limits monorepo usability**: In monorepos, agents should work within individual packages

**Goal**: Enable agents to operate in any subdirectory within the repository, with proper path validation and git-awareness.

## Scope

### In Scope
- Add working directory selector to agent spawn UI
- Support both absolute and relative paths for working directories
- Validate working directories are within the git repository
- Update all agent types (Cerebras, OpenCode, Claude CLI, Codex CLI) to respect working directory
- Update durable streams architecture to persist working directory
- Ensure tool implementations (read, write, edit, bash, glob, grep) respect working directory boundaries
- Add working directory display in agent session UI
- Display relative paths from working directory in tool outputs

### Out of Scope
- Cross-repository operations (agents still operate within a single repository)
- Changing working directory mid-session (directory is set at spawn time)
- Directory permissions beyond git repository boundaries
- Multi-repository monorepos (focus on single git root)

## Implementation Plan

### Phase 1: Backend Foundation
- [ ] Update `SpawnAgentParams` type to validate `workingDir` is within git root
- [ ] Add `validateWorkingDirectory()` function to ensure directory:
  - Exists on filesystem
  - Is within the git repository root (use `getGitRoot()`)
  - Is not above the repository root
  - Defaults to `process.cwd()` if not provided
- [ ] Update `AgentManager.spawn()` to validate and normalize working directory
- [ ] Update `CLIAgentRunner.run()` to use working directory for subprocess `cwd`
- [ ] Update `CerebrasAgent` and `OpencodeAgent` constructors to store and use working directory
- [ ] Ensure all tool functions (read, write, edit, bash, glob, grep) receive correct `cwd` parameter

### Phase 2: API Layer
- [ ] Update `agent.spawn` tRPC mutation to accept optional `workingDir` parameter
- [ ] Add input validation using zod to ensure working directory is a valid path string
- [ ] Update durable streams `spawnAgentDaemon()` to include working directory
- [ ] Update `reconstructSessionFromStreams()` to extract working directory from events
- [ ] Add `session_created` event schema to include working directory field
- [ ] Update process monitor to track working directory for daemon processes

### Phase 3: Frontend UI - Directory Selector
- [ ] Add directory input field to spawn form (`src/routes/index.tsx`)
- [ ] Add directory browser/picker component for selecting subdirectories
- [ ] Display current working directory in form (default to repository root)
- [ ] Add validation feedback for invalid directory paths
- [ ] Show directory relative to git root in UI (e.g., "packages/backend" instead of "/full/path/packages/backend")
- [ ] Add "Browse" button to explore available directories in tree view

### Phase 4: Session Display
- [ ] Display working directory in agent session header (`src/routes/agents/$sessionId.tsx`)
- [ ] Show relative paths in tool call results (relative to working directory)
- [ ] Update file path displays to show paths relative to working directory
- [ ] Add git root indicator badge when working directory != git root
- [ ] Update metadata sidebar to show working directory information

### Phase 5: Tool Output Enhancement
- [ ] Update `read` tool output to display paths relative to working directory
- [ ] Update `write` tool to show relative paths in success messages
- [ ] Update `edit` tool to display relative paths
- [ ] Update `glob` tool to return paths relative to working directory
- [ ] Update `grep` tool to show relative paths in results
- [ ] Update `bash` tool output formatting to highlight relative paths

### Phase 6: Testing & Edge Cases
- [ ] Test spawning agent in repository root (default behavior)
- [ ] Test spawning agent in nested subdirectory (e.g., `packages/backend`)
- [ ] Test spawning agent in deeply nested path (e.g., `src/components/auth/forms`)
- [ ] Test path validation rejects paths outside git repository
- [ ] Test path validation rejects non-existent directories
- [ ] Test tool operations respect working directory boundaries
- [ ] Test CLI agents (Claude, Codex) spawn with correct cwd
- [ ] Test SDK agents (Cerebras, OpenCode) respect working directory
- [ ] Test session resumption preserves working directory
- [ ] Test durable streams persist working directory across server restarts

### Phase 7: Documentation
- [ ] Update README with working directory feature explanation
- [ ] Add examples of using agents in subtrees
- [ ] Document working directory validation rules
- [ ] Update CODEBASE_MAP.md with working directory architecture

## Key Files

### Core Agent System
- `src/lib/agent/types.ts` - Add working directory to type definitions
- `src/lib/agent/manager.ts` - Validate and normalize working directory in `spawn()`
- `src/lib/agent/cerebras.ts` - Update constructor to accept and use working directory
- `src/lib/agent/opencode.ts` - Update constructor to accept and use working directory
- `src/lib/agent/cli-runner.ts` - Pass working directory as `cwd` to child process
- `src/lib/agent/path-validator.ts` - Add validation for working directories within git root

### API Layer
- `src/trpc/agent.ts` - Add `workingDir` parameter to spawn mutation schema
- `src/trpc/context.ts` - Potentially add helper for resolving working directories
- `src/streams/schemas.ts` - Add working directory to session event schemas
- `src/daemon/spawn-daemon.ts` - Pass working directory to daemon processes

### Frontend UI
- `src/routes/index.tsx` - Add directory selector to spawn form
- `src/routes/agents/$sessionId.tsx` - Display working directory in session view
- `src/components/agents/directory-picker.tsx` - New component for browsing directories (create)
- `src/components/agents/session-header.tsx` - Show working directory badge (if exists, else create)

### Services
- `src/lib/agent/git-service.ts` - Already has `getGitRoot()`, use for validation
- `src/lib/agent/tools.ts` - Ensure all tools respect working directory boundaries

## Testing

### Unit Tests
- [ ] Test `validateWorkingDirectory()` with valid paths
- [ ] Test `validateWorkingDirectory()` rejects paths outside git root
- [ ] Test `validateWorkingDirectory()` rejects non-existent paths
- [ ] Test `validatePath()` correctly resolves paths relative to working directory
- [ ] Test tool functions respect working directory cwd parameter

### Integration Tests
- [ ] Test spawning Cerebras agent in subdirectory
- [ ] Test spawning OpenCode agent in subdirectory
- [ ] Test spawning Claude CLI agent in subdirectory
- [ ] Test spawning Codex CLI agent in subdirectory
- [ ] Test read tool operates within working directory
- [ ] Test write tool creates files relative to working directory
- [ ] Test bash tool executes commands in working directory
- [ ] Test glob patterns respect working directory
- [ ] Test grep searches within working directory

### Manual Testing
- [ ] Spawn agent in `src/` subdirectory and verify tool paths are relative
- [ ] Spawn agent in deeply nested directory and verify operations work
- [ ] Try to spawn agent in `/tmp` (outside repo) and verify it's rejected
- [ ] Resume session and verify working directory is preserved
- [ ] Restart server and verify durable streams restore working directory
- [ ] Test UI directory picker allows browsing repository structure

## Success Criteria

- [ ] Users can select any subdirectory within the git repository when spawning agents
- [ ] Working directory defaults to repository root when not specified
- [ ] Agents cannot access files outside their working directory (enforced by path validator)
- [ ] Tool outputs display paths relative to the working directory
- [ ] Session UI clearly shows the working directory for each agent
- [ ] All agent types (Cerebras, OpenCode, Claude, Codex) respect working directory
- [ ] Working directory persists across session resumption
- [ ] Durable streams architecture preserves working directory after server restarts
- [ ] Invalid working directories (outside repo, non-existent) are rejected with clear error messages
- [ ] Documentation clearly explains how to use agents in subtrees

## Technical Considerations

### Path Resolution Strategy
When an agent is spawned with `workingDir = "/Users/venge/Code/agentz/packages/backend"`:
- Tool paths are resolved relative to this directory
- `read({ path: "src/index.ts" })` → `/Users/venge/Code/agentz/packages/backend/src/index.ts`
- `bash("ls")` executes in the working directory
- Display paths show `src/index.ts` instead of full absolute path

### Git Root Validation
Use existing `getGitRoot()` from git-service.ts to ensure working directory is within repository:
```typescript
function validateWorkingDirectory(workingDir: string): string {
  const absolutePath = resolve(workingDir)
  const gitRoot = getGitRoot(absolutePath)

  if (!gitRoot) {
    throw new Error("Working directory is not within a git repository")
  }

  if (!absolutePath.startsWith(gitRoot)) {
    throw new Error("Working directory is outside the git repository")
  }

  if (!existsSync(absolutePath)) {
    throw new Error("Working directory does not exist")
  }

  return absolutePath
}
```

### Security Implications
- Path validation already prevents traversal attacks via `path-validator.ts`
- Working directory adds an additional layer of isolation
- Agents still cannot escape the working directory boundary
- SecurityConfig.ALLOWED_PATH_PREFIX should be updated to use working directory

### UI/UX Decisions
- **Default behavior**: Working directory defaults to git root (backward compatible)
- **Directory picker**: Show tree view of repository structure
- **Path display**: Always show paths relative to working directory for clarity
- **Visual indicator**: Badge or icon when working directory is not the root

## Implementation Order

1. **Start with backend validation** (Phase 1) to establish safe boundaries
2. **Update API layer** (Phase 2) to accept and persist working directory
3. **Add basic UI input** (Phase 3) to allow manual directory entry
4. **Enhance UI with picker** (continue Phase 3) for better UX
5. **Update displays** (Phase 4-5) to show relative paths
6. **Comprehensive testing** (Phase 6) to ensure reliability
7. **Document feature** (Phase 7) for users

## Migration Path

This is a **backward-compatible** change:
- Existing code defaults `workingDir` to `process.cwd()` (current behavior)
- New sessions can optionally specify a subdirectory
- No changes required for existing sessions or API consumers
- Feature is opt-in via UI directory selector
