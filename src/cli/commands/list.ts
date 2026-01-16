/**
 * list command - List all sessions with optional filters
 */

import chalk from "chalk"
import { registerCommand } from "./index"
import { createSessionsTable } from "../formatter"
import type { CLIContext } from "../context"

registerCommand({
  name: "list",
  aliases: ["ls", "sessions"],
  description: "List all sessions",
  usage: "list [--running] [--agent <type>] [--limit <n>]",

  async execute(args, ctx: CLIContext) {
    // Parse arguments
    let showRunning = false
    let agentFilter: string | undefined
    let limit = 20

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg === "--running" || arg === "-r") {
        showRunning = true
      } else if (arg === "--agent" || arg === "-a") {
        agentFilter = args[++i]
      } else if (arg === "--limit" || arg === "-l") {
        const n = parseInt(args[++i], 10)
        if (!isNaN(n)) limit = n
      }
    }

    let sessions = await ctx.trpc.agent.list()

    // Apply filters
    if (showRunning) {
      sessions = sessions.filter((s) => s.status === "running" || s.status === "pending")
    }

    if (agentFilter) {
      sessions = sessions.filter((s) => s.agentType === agentFilter)
    }

    // Apply limit
    sessions = sessions.slice(0, limit)

    if (sessions.length === 0) {
      const filters: string[] = []
      if (showRunning) filters.push("running")
      if (agentFilter) filters.push(`agent=${agentFilter}`)
      const filterStr = filters.length ? ` (${filters.join(", ")})` : ""
      console.log(chalk.gray(`  No sessions found${filterStr}`))
      return
    }

    console.log()
    console.log(createSessionsTable(sessions))
    console.log()

    if (sessions.length === limit) {
      console.log(chalk.gray(`  Showing first ${limit} results. Use --limit to show more.`))
    }
  },
})
