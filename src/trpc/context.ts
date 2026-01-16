/**
 * tRPC Context - provides workingDir, sessionId, and auth data to all procedures
 */

export interface Context {
  workingDir: string
  /** Optional session ID for worktree-isolated operations */
  sessionId?: string
  /** Authenticated user ID from GitHub */
  userId?: string
  /** GitHub access token for API calls */
  githubToken?: string
  /** GitHub username */
  username?: string
}

export function createContext(opts: {
  workingDir: string
  sessionId?: string
  userId?: string
  githubToken?: string
  username?: string
}) {
  return (): Context => {
    return {
      workingDir: opts.workingDir,
      sessionId: opts.sessionId,
      userId: opts.userId,
      githubToken: opts.githubToken,
      username: opts.username,
    }
  }
}
