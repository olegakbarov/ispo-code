/**
 * tRPC Context - provides workingDir and optional sessionId to all procedures
 */

export interface Context {
  workingDir: string
  /** Optional session ID for worktree-isolated operations */
  sessionId?: string
}

export function createContext(opts: { workingDir: string; sessionId?: string }) {
  return (): Context => {
    return {
      workingDir: opts.workingDir,
      sessionId: opts.sessionId,
    }
  }
}
