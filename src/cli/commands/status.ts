/**
 * status command - Show dashboard with system status and running agents
 */

import chalk from "chalk"
import { registerCommand } from "./index"
import {
  formatBanner,
  formatProcessStats,
  createSessionsTable,
  formatDuration,
} from "../formatter"
import type { CLIContext } from "../context"

// Read version from package.json at runtime
async function getVersion(): Promise<string> {
  try {
    const { readFile } = await import("fs/promises")
    const { join } = await import("path")
    const pkgPath = join(process.cwd(), "package.json")
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"))
    return pkg.version || "1.0.0"
  } catch {
    return "1.0.0"
  }
}

registerCommand({
  name: "status",
  aliases: ["st", "dashboard"],
  description: "Show dashboard with running agents",
  usage: "status [--watch]",

  async execute(args, ctx: CLIContext) {
    const watch = args.includes("--watch") || args.includes("-w")

    const showStatus = async () => {
      const version = await getVersion()
      const url = `http://${ctx.config.host}:${ctx.config.port}`

      console.log(formatBanner(version, url))

      // Get process stats
      const stats = await ctx.trpc.agent.getProcessStats()
      console.log(formatProcessStats(stats))

      // Get recent sessions
      const sessions = await ctx.trpc.agent.list()
      const recent = sessions.slice(0, 5)

      // Calculate uptime from first session if any
      if (sessions.length > 0) {
        const oldest = sessions[sessions.length - 1]
        console.log(chalk.gray(`  Uptime: ${formatDuration(oldest.startedAt)}`))
      }

      console.log()
      console.log(chalk.bold("  Recent Sessions:"))
      console.log(createSessionsTable(recent))
      console.log()
    }

    if (watch) {
      console.clear()
      await showStatus()
      console.log(chalk.gray("  Refreshing every 2s... (Ctrl+C to stop)"))

      const interval = setInterval(async () => {
        console.clear()
        await showStatus()
        console.log(chalk.gray("  Refreshing every 2s... (Ctrl+C to stop)"))
      }, 2000)

      // Handle Ctrl+C to stop watching
      const handler = () => {
        clearInterval(interval)
        process.removeListener("SIGINT", handler)
        console.log()
      }
      process.on("SIGINT", handler)

      // Wait indefinitely until interrupted
      await new Promise(() => {})
    } else {
      await showStatus()
    }
  },
})
