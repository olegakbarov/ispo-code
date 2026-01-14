/**
 * tRPC Context - provides workingDir to all procedures
 */

export interface Context {
  workingDir: string
}

export function createContext(opts: { workingDir: string }) {
  return (): Context => {
    return {
      workingDir: opts.workingDir,
    }
  }
}
