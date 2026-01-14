/**
 * System tRPC Router - Basic system info queries
 */

import { existsSync, readFileSync, readdirSync } from "fs"
import { join, resolve } from "path"
import { homedir } from "os"
import { z } from "zod"
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

  /**
   * List directories at a given path for folder picker UI.
   * Defaults to user's home directory if no path provided.
   */
  listDirectories: procedure
    .input(z.object({ path: z.string().optional() }).optional())
    .query(({ input }) => {
      const home = homedir()
      const targetPath = resolve(input?.path ?? home)

      // Security: ensure path doesn't escape home directory
      if (!targetPath.startsWith(home)) {
        throw new Error("Access denied: path must be within home directory")
      }

      if (!existsSync(targetPath)) {
        throw new Error(`Directory not found: ${targetPath}`)
      }

      try {
        const entries = readdirSync(targetPath, { withFileTypes: true })
        const directories = entries
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
          .map((entry) => ({
            name: entry.name,
            path: join(targetPath, entry.name),
          }))
          .sort((a, b) => a.name.localeCompare(b.name))

        return {
          currentPath: targetPath,
          parentPath: targetPath !== home ? resolve(targetPath, "..") : null,
          directories,
          isHome: targetPath === home,
        }
      } catch (error) {
        throw new Error(`Failed to read directory: ${error}`)
      }
    }),
})
