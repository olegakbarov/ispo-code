/**
 * System tRPC Router - Basic system info queries
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { router, procedure } from "./trpc"

export const systemRouter = router({
  /**
   * Get the current working directory (server's process.cwd)
   */
  workingDir: procedure.query(({ ctx }) => {
    return ctx.workingDir
  }),

  /**
   * Get the codebase map if it exists
   */
  getCodebaseMap: procedure.query(({ ctx }) => {
    const mapPath = join(ctx.workingDir, "docs/CODEBASE_MAP.md")

    if (!existsSync(mapPath)) {
      return { exists: false, content: null, path: mapPath }
    }

    try {
      const content = readFileSync(mapPath, "utf-8")
      return { exists: true, content, path: mapPath }
    } catch (error) {
      return { exists: false, content: null, path: mapPath, error: String(error) }
    }
  }),
})
