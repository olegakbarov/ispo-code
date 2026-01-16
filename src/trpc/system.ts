/**
 * System tRPC Router - Basic system info queries
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, resolve } from "path"
import { homedir } from "os"
import { z } from "zod"
import { router, procedure } from "./trpc"

// Config file path for server-side settings
const CONFIG_DIR = ".ispo-code"
const CONFIG_FILE = "config.json"

interface ServerConfig {
  claudeUseSubscription?: boolean
}

/** Get the config file path for the current working directory */
function getConfigPath(workingDir: string): string {
  return join(workingDir, CONFIG_DIR, CONFIG_FILE)
}

/** Read server config from file */
export function readServerConfig(workingDir: string): ServerConfig {
  try {
    const configPath = getConfigPath(workingDir)
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf-8")
      return JSON.parse(content) as ServerConfig
    }
  } catch {
    // Ignore read errors, return empty config
  }
  return {}
}

/** Write server config to file */
function writeServerConfig(workingDir: string, config: ServerConfig): void {
  const configDir = join(workingDir, CONFIG_DIR)
  const configPath = getConfigPath(workingDir)

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  // Merge with existing config
  const existing = readServerConfig(workingDir)
  const merged = { ...existing, ...config }

  writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf-8")
}

export const systemRouter = router({
  /**
   * Get the current working directory (server's process.cwd)
   */
  workingDir: procedure.query(({ ctx }) => {
    return ctx.workingDir
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

  /**
   * Get Claude subscription auth setting
   */
  getClaudeUseSubscription: procedure.query(({ ctx }) => {
    const config = readServerConfig(ctx.workingDir)
    return config.claudeUseSubscription ?? false
  }),

  /**
   * Set Claude subscription auth setting
   */
  setClaudeUseSubscription: procedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ ctx, input }) => {
      writeServerConfig(ctx.workingDir, { claudeUseSubscription: input.enabled })
      return { success: true }
    }),
})
