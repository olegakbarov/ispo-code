# GitHub Integration

## Problem Statement
Enable tasks to link to GitHub issues/PRs. Auto-create PRs from completed agent sessions. Sync status between tasks and GitHub.

## Scope
**In:**
- List/view issues and PRs
- Create PR from session branch
- Link tasks to GitHub issues
- Basic auth via personal access token

**Out:**
- GitHub Actions/CI integration
- Issue creation from tasks
- PR review/merge operations
- OAuth flow (use PAT)
- Multi-repo support

## Implementation Plan

### Phase 1: Service Layer
- [ ] Add `octokit` package
- [ ] Create `src/lib/github-service.ts` - API wrapper
- [ ] Add GitHub types to `src/lib/agent/types.ts`
- [ ] Add `GITHUB_TOKEN` env var support in `src/lib/server/env.ts`

### Phase 2: tRPC Router
- [ ] Create `src/trpc/github.ts` with queries: `issues`, `pullRequests`, `repo`
- [ ] Add mutations: `createPullRequest`, `linkTaskToIssue`
- [ ] Register router in `src/trpc/router.ts`

### Phase 3: Task Integration
- [ ] Add `githubIssue?: number` field to task schema
- [ ] Update task creation to accept issue link
- [ ] Add "Create PR" action in task sidebar
- [ ] Show linked issue/PR status in task view

### Phase 4: UI Components
- [ ] Create `src/components/github/pr-create-modal.tsx`
- [ ] Create `src/components/github/issue-link.tsx`
- [ ] Add GitHub status badge to task list

## Key Files
- `src/lib/github-service.ts` - NEW: Octokit wrapper
- `src/trpc/github.ts` - NEW: tRPC router
- `src/trpc/router.ts` - add githubRouter
- `src/lib/agent/types.ts` - add GitHubIssue, GitHubPR types
- `src/streams/schemas.ts` - add githubIssue to task schema
- `src/components/tasks/task-footer.tsx` - add PR create button

## Success Criteria
- [ ] Can list open issues/PRs from connected repo
- [ ] Can create PR from agent session branch
- [ ] Tasks show linked GitHub issue with status
- [ ] PR description auto-generated from task context

## Unresolved Questions
1. Auto-create PR on task completion vs manual trigger?
2. Store GitHub config per-project or global?
3. Cache issues/PRs locally or always fetch?
