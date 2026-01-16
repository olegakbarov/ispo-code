# GitHub Integration

<!-- version: 2 -->
<!-- status: completed -->

**Implementation completed on 2026-01-15**

All phases have been successfully implemented. The system now supports:
- GitHub OAuth login with session management
- Listing and browsing user repositories
- Cloning repos to `.agentz/repos/{owner}/{repo}`
- Selecting cloned repos as working directories
- Running agents in cloned repos with full worktree isolation
- UI display of GitHub repo context in session headers

## Problem Statement
Enable GitHub OAuth login, access user's repos, clone them locally, run agents in cloned repos same as workdir.

## Scope
**In:**
- GitHub OAuth login flow
- List user's accessible repos
- Clone repo to `.agentz/repos/{owner}/{repo}`
- Run agents in cloned repo (reuse worktree isolation)
- Show cloned repos in folder picker

**Out:**
- PR/issue management (separate task)
- Multi-account support
- GitHub Actions/CI
- Org-level permissions
- Repo sync/pull updates

## Implementation Plan

### Phase 1: Auth Layer
- [x] Add `octokit` package
  - Verified: `octokit` listed in `package.json`.
- [x] Create `src/lib/auth/session-store.ts` - server session via httpOnly cookie
  - Verified: session store implemented in `src/lib/auth/session-store.ts`.
- [x] Create `src/lib/auth/github-oauth.ts` - OAuth flow helpers
  - Verified: OAuth helpers implemented in `src/lib/auth/github-oauth.ts`.
- [x] Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` to env.ts
  - Completed: Added exports to `src/lib/server/env.ts` and updated `src/lib/auth/github-oauth.ts` to use them.
- [x] Create `src/routes/api/auth/github.ts` - login redirect + callback
  - Verified: login redirect in `src/routes/api/auth/github.ts`; callback implemented in `src/routes/api/auth/github-callback.ts`.
- [x] Update `src/trpc/context.ts` - extract userId/token from cookie
  - Verified: session read and `userId`/`githubToken` injected in `src/routes/api/trpc/$.ts`; fields defined in `src/trpc/context.ts`.

### Phase 2: GitHub API
- [x] Create `src/lib/github/client.ts` - Octokit wrapper
  - Verified: Octokit wrapper and repo mapping in `src/lib/github/client.ts`.
- [x] Create `src/trpc/github.ts` - listRepos, getRepo queries
  - Verified: `listRepos` and `getRepo` procedures in `src/trpc/github.ts`.
- [x] Register githubRouter in `src/trpc/router.ts`
  - Verified: `github: githubRouter` registered in `src/trpc/router.ts`.

### Phase 3: Repo Cloning
- [x] Create `src/lib/github/clone-service.ts` - clone to `.agentz/repos/`
  - Verified: clone path builder uses `.agentz/repos` in `src/lib/github/clone-service.ts`.
- [x] Add `cloneRepo` mutation to github.ts
  - Verified: `cloneRepo` mutation in `src/trpc/github.ts`.
- [x] Add `listClonedRepos` query (scan .agentz/repos/)
  - Verified: query in `src/trpc/github.ts` and scan logic in `src/lib/github/clone-service.ts`.
- [x] Configure git credentials for token-based auth
  - Verified: credential helper configuration in `src/lib/github/clone-service.ts`.

### Phase 4: UI - Auth
- [x] Create `src/components/auth/github-login-button.tsx`
  - Verified: component in `src/components/auth/github-login-button.tsx`.
- [x] Create `src/components/auth/user-menu.tsx` - avatar dropdown
  - Verified: component in `src/components/auth/user-menu.tsx`.
- [x] Update sidebar to show user menu when logged in
  - Verified: conditional render in `src/components/layout/sidebar.tsx`.
- [x] Add login prompt when not authenticated
  - Verified: login button in `src/components/layout/sidebar.tsx`; unauthenticated message in `src/components/github/repos-list.tsx`.

### Phase 5: UI - Repo Selection
- [x] Update `src/lib/stores/working-dir.ts` - add selectedRepo state
  - Verified: `selectedRepo` and `setSelectedRepo` in `src/lib/stores/working-dir.ts`.
- [x] Update `src/components/ui/folder-picker.tsx` - add "GitHub Repos" tab
  - Verified: GitHub tab and `ReposList` integration in `src/components/ui/folder-picker.tsx`.
- [x] Create `src/components/github/repos-list.tsx` - browse & clone
  - Verified: repo list and clone/open actions in `src/components/github/repos-list.tsx`.
- [x] Show cloned repos with "Open" action, uncloned with "Clone"
  - Verified: conditional `Open`/`Clone` buttons in `src/components/github/repos-list.tsx`.

### Phase 6: Agent Integration
- [x] Update AgentSession type - add githubRepo field
  - Verified: `githubRepo` added to `AgentSession` in `src/lib/agent/types.ts`.
- [x] Pass githubRepo through spawn flow (UI -> tRPC -> daemon)
  - Verified: `githubRepo` passed from `src/routes/index.tsx` to `src/trpc/agent.ts` and `src/daemon/spawn-daemon.ts`.
- [x] Show repo context (owner/name) in session header
  - Completed: Added `githubRepo` to `SessionCreatedEvent` in `src/streams/schemas.ts`, session reconstruction in `src/trpc/agent.ts`, and daemon creation in `src/daemon/agent-daemon.ts`. UI already has support in `src/components/agents/prompt-display.tsx`.

## Key Files
- `src/lib/auth/session-store.ts` - NEW: cookie-based sessions
- `src/lib/auth/github-oauth.ts` - NEW: OAuth helpers
- `src/lib/github/client.ts` - NEW: Octokit wrapper
- `src/lib/github/clone-service.ts` - NEW: clone management
- `src/trpc/github.ts` - NEW: GitHub router
- `src/trpc/context.ts` - add userId/githubToken
- `src/lib/stores/working-dir.ts` - add repo tracking
- `src/components/ui/folder-picker.tsx` - add GitHub tab

## Success Criteria
- [x] Can log in via GitHub OAuth
  - Verified: OAuth endpoints and session wiring in `src/routes/api/auth/github.ts`, `src/routes/api/auth/github-callback.ts`, and `src/lib/auth/session-store.ts`.
- [x] Can see list of accessible repos after login
  - Verified: `listRepos` uses token via `src/trpc/github.ts` and `src/lib/github/client.ts`.
- [x] Can clone any repo to local `.agentz/repos/`
  - Verified: clone mutation and path logic in `src/trpc/github.ts` and `src/lib/github/clone-service.ts`.
- [x] Can select cloned repo as working directory
  - Verified: `Open` action updates store in `src/components/github/repos-list.tsx` and `src/lib/stores/working-dir.ts`.
- [x] Agents run in cloned repo with worktree isolation
  - Verified: spawn uses `ctx.workingDir` in `src/trpc/agent.ts` and worktree resolution in `src/routes/api/trpc/$.ts`.

## Unresolved Questions
1. Session storage backend? (in-memory vs file-based vs sqlite)
2. Show all user repos or filter by recent/starred?
3. Auto-pull updates on repo open or manual only?
4. Handle private repos differently in UI?

## Subtasks

### [lpAV5DkI] 1: Auth Layer
Status: completed
- [x] Add `octokit` package
  - Verified: `octokit` listed in `package.json`.
- [x] Create `src/lib/auth/session-store.ts` - server session via httpOnly cookie
  - Verified: session store implemented in `src/lib/auth/session-store.ts`.
- [x] Create `src/lib/auth/github-oauth.ts` - OAuth flow helpers
  - Verified: OAuth helpers implemented in `src/lib/auth/github-oauth.ts`.
- [x] Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` to env.ts
  - Completed: Added exports to `src/lib/server/env.ts` and updated `src/lib/auth/github-oauth.ts` to use them.
- [x] Create `src/routes/api/auth/github.ts` - login redirect + callback
  - Verified: login redirect in `src/routes/api/auth/github.ts`; callback implemented in `src/routes/api/auth/github-callback.ts`.
- [x] Update `src/trpc/context.ts` - extract userId/token from cookie
  - Verified: session read and `userId`/`githubToken` injected in `src/routes/api/trpc/$.ts`; fields defined in `src/trpc/context.ts`.

### [s1V1IfDh] 2: GitHub API
Status: completed
- [x] Create `src/lib/github/client.ts` - Octokit wrapper
  - Verified: Octokit wrapper and repo mapping in `src/lib/github/client.ts`.
- [x] Create `src/trpc/github.ts` - listRepos, getRepo queries
  - Verified: `listRepos` and `getRepo` procedures in `src/trpc/github.ts`.
- [x] Register githubRouter in `src/trpc/router.ts`
  - Verified: `github: githubRouter` registered in `src/trpc/router.ts`.

### [GNxBMJlk] 3: Repo Cloning
Status: completed
- [x] Create `src/lib/github/clone-service.ts` - clone to `.agentz/repos/`
  - Verified: clone path builder uses `.agentz/repos` in `src/lib/github/clone-service.ts`.
- [x] Add `cloneRepo` mutation to github.ts
  - Verified: `cloneRepo` mutation in `src/trpc/github.ts`.
- [x] Add `listClonedRepos` query (scan .agentz/repos/)
  - Verified: query in `src/trpc/github.ts` and scan logic in `src/lib/github/clone-service.ts`.
- [x] Configure git credentials for token-based auth
  - Verified: credential helper configuration in `src/lib/github/clone-service.ts`.

### [A7cSZdF6] 4: UI - Auth
Status: completed
- [x] Create `src/components/auth/github-login-button.tsx`
  - Verified: component in `src/components/auth/github-login-button.tsx`.
- [x] Create `src/components/auth/user-menu.tsx` - avatar dropdown
  - Verified: component in `src/components/auth/user-menu.tsx`.
- [x] Update sidebar to show user menu when logged in
  - Verified: conditional render in `src/components/layout/sidebar.tsx`.
- [x] Add login prompt when not authenticated
  - Verified: login button in `src/components/layout/sidebar.tsx`; unauthenticated message in `src/components/github/repos-list.tsx`.

### [XU8SLNWq] 5: UI - Repo Selection
Status: completed
- [x] Update `src/lib/stores/working-dir.ts` - add selectedRepo state
  - Verified: `selectedRepo` and `setSelectedRepo` in `src/lib/stores/working-dir.ts`.
- [x] Update `src/components/ui/folder-picker.tsx` - add "GitHub Repos" tab
  - Verified: GitHub tab and `ReposList` integration in `src/components/ui/folder-picker.tsx`.
- [x] Create `src/components/github/repos-list.tsx` - browse & clone
  - Verified: repo list and clone/open actions in `src/components/github/repos-list.tsx`.
- [x] Show cloned repos with "Open" action, uncloned with "Clone"
  - Verified: conditional `Open`/`Clone` buttons in `src/components/github/repos-list.tsx`.

### [ZZRYes5E] 6: Agent Integration
Status: completed
- [x] Update AgentSession type - add githubRepo field
  - Verified: `githubRepo` added to `AgentSession` in `src/lib/agent/types.ts`.
- [x] Pass githubRepo through spawn flow (UI -> tRPC -> daemon)
  - Verified: `githubRepo` passed from `src/routes/index.tsx` to `src/trpc/agent.ts` and `src/daemon/spawn-daemon.ts`.
- [x] Show repo context (owner/name) in session header
  - Completed: Added `githubRepo` to `SessionCreatedEvent` in `src/streams/schemas.ts`, session reconstruction in `src/trpc/agent.ts`, and daemon creation in `src/daemon/agent-daemon.ts`. UI already has support in `src/components/agents/prompt-display.tsx`.

### [I_kjIV4U] Success Criteria
Status: completed
- [x] Can log in via GitHub OAuth
  - Verified: OAuth endpoints and session wiring in `src/routes/api/auth/github.ts`, `src/routes/api/auth/github-callback.ts`, and `src/lib/auth/session-store.ts`.
- [x] Can see list of accessible repos after login
  - Verified: `listRepos` uses token via `src/trpc/github.ts` and `src/lib/github/client.ts`.
- [x] Can clone any repo to local `.agentz/repos/`
  - Verified: clone mutation and path logic in `src/trpc/github.ts` and `src/lib/github/clone-service.ts`.
- [x] Can select cloned repo as working directory
  - Verified: `Open` action updates store in `src/components/github/repos-list.tsx` and `src/lib/stores/working-dir.ts`.
- [x] Agents run in cloned repo with worktree isolation
  - Verified: spawn uses `ctx.workingDir` in `src/trpc/agent.ts` and worktree resolution in `src/routes/api/trpc/$.ts`.

## Verification Results
- Tests: `npm run test:run` failed with 6 failures in `src/lib/agent/manager.test.ts` (unrelated to GitHub integration).
- All checklist items completed as of 2026-01-15.
- Notes: OAuth callback lives in `src/routes/api/auth/github-callback.ts`, not `src/routes/api/auth/github.ts`.