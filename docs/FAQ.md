# Ispo Code FAQ

## Getting Started

### What is Ispo Code?
A control panel for spawning and managing AI coding agents (Claude, Codex, Cerebras, Gemini, OpenCode). Each agent runs in isolation, and you can review/merge their changes back to your codebase.

### How do I start it?
```bash
npm run dev    # Development mode on port 4200
npm run build && npm start  # Production mode
```

### What agents are available?
| Agent | Type | Context | Requirements |
|-------|------|---------|--------------|
| Claude | CLI | 200K | `claude` CLI installed |
| Codex | CLI | 128K | `codex` CLI installed |
| Cerebras | SDK | 8K-131K | `CEREBRAS_API_KEY` env var |
| Gemini | SDK | Varies | `GOOGLE_API_KEY` env var |
| OpenCode | SDK | Varies | `@opencode-ai/sdk` installed |

---

## Tasks

### What's a task?
A markdown file in `tasks/` describing work to be done. Tasks have:
- Title and description
- Implementation plan with checkboxes
- Associated agent sessions
- QA status tracking

### How do I create a task?
1. Click "New Task" in sidebar
2. Enter title (description optional)
3. Choose: create empty, or spawn agent to write the plan

### What's the task lifecycle?
1. **Draft** → Write/generate implementation plan
2. **Implement** → Assign agent to execute plan
3. **Review** → Check agent's changes in diff view
4. **Commit & Merge** → Commit to worktree, merge to main
5. **QA** → Pass/fail the merged changes
6. **Archive** → Mark complete

---

## Worktree Isolation

### What is worktree isolation?
Each agent session gets its own git worktree (separate working directory) on a unique branch (`ispo-code/session-{id}`). Agents can't step on each other's changes.

### Is it enabled by default?
Yes. To disable: `export DISABLE_WORKTREE_ISOLATION=true`

### Where are worktrees stored?
`.ispo-code/worktrees/{sessionId}/` inside your repo.

### How do I see active worktrees?
Settings → Worktrees tab. Or run `git worktree list`.

### Do worktrees use extra disk space?
Yes, each is a full working copy. Cleaned up when sessions are deleted.

---

## Merging

### How do I merge agent changes to main?
Two paths:
1. **Commit & Merge modal** → Select "Commit & Merge to Main" option
2. **Review mode** → Click "Merge to Main" button after reviewing

### What happens on merge?
1. Git checkout main
2. `git merge --no-ff ispo-code/session-{id}` (creates merge commit)
3. Return to original branch
4. Record merge in task metadata, set QA to pending

### What if there are conflicts?
Merge aborts and shows error. Currently requires manual resolution:
```bash
git checkout main
git merge ispo-code/session-{id}
# resolve conflicts in editor
git add .
git commit
```

### Can I revert a merge?
Yes. In review mode, click "Revert Merge" on a merged session. Uses `git revert -m 1`.

---

## Agent Sessions

### How do I run an agent on a task?
1. Open task
2. Click "Implement" (or "Run Agent")
3. Select agent type and model
4. Agent runs in background, streams output

### Can I run multiple agents simultaneously?
Yes, up to 3 concurrent. Each gets its own worktree (if enabled).

### How do I stop a running agent?
Click the stop/cancel button on the session card or in session detail view.

### Can I resume a session?
Yes, for completed/stopped sessions. Click "Resume" and enter follow-up message.

### What's the difference between planning and execution sessions?
- **Planning**: Agent writes/refines the task plan
- **Execution**: Agent implements the plan (writes code)

---

## Review Mode

### What does review mode show?
- Files changed by the agent session
- Side-by-side or unified diff view
- Commit interface with auto-generated messages

### How do I switch between sessions in review?
Click different session cards in the sidebar. Each shows its own changes.

### Can I edit files before committing?
The review mode is read-only. Edit files in your editor, then refresh the diff.

---

## Git Operations

### Does Ispo Code push to remote?
Not automatically. Use the Push button in git panel, or push manually.

### Can I change branches?
Yes, via the branch dropdown in git status. Warning: may affect worktree sessions.

### How do I see what an agent changed?
1. Select the session
2. Go to Review tab
3. Changed files listed with diffs

---

## Troubleshooting

### Agent won't start
- Check agent CLI/SDK is installed
- Check API keys are set (for SDK agents)
- Check console for errors

### Worktree creation failed
- Ensure you're in a git repo
- Check disk space
- Look for stale worktrees: `git worktree prune`

### Merge says "branch does not exist"
Worktree was deleted or isolation was disabled mid-session. The branch only exists while the worktree is active.

### Session stuck in "running" state
The daemon may have crashed. Delete the session and retry. Check `.ispo-code/` for orphaned processes.

### Port 4200 already in use
Another instance running, or different app. Use: `lsof -i :4200` to find it, or start on different port.

---

## Tips

### Effective task prompts
- Be specific about files/functions to modify
- Include acceptance criteria
- Reference existing patterns in codebase

### When to use which agent
- **Claude**: Complex multi-file changes, refactoring
- **Codex**: Quick fixes, single-file edits
- **Cerebras**: Fast iteration, smaller context tasks

### Parallel agent strategy
1. Create separate tasks for independent features
2. Run agents concurrently (each in own worktree)
3. Merge sequentially to avoid conflicts
4. QA each merge before starting next

### Avoiding merge conflicts
- Don't run concurrent agents on same files
- Merge and QA before spawning next session on same area
- Keep tasks focused on disjoint file sets
