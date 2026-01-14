/**
 * System tRPC Router - Basic system info queries
 */

import { router, procedure } from "./trpc"

export const systemRouter = router({
  /**
   * Get the current working directory (server's process.cwd)
   */
  workingDir: procedure.query(({ ctx }) => {
    return ctx.workingDir
  }),
})
