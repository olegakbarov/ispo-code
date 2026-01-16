/**
 * kill command - Cancel running session
 */

import chalk from "chalk"
import ora from "ora"
import { registerCommand } from "./index"
import { formatSessionId } from "../formatter"
import type { CLIContext } from "../context"

/** Find session by partial ID match */
async function findSession(
  ctx: CLIContext,
  partialId: string
): Promise<{ id: string; status: string } | null> {
  const sessions = await ctx.trpc.agent.list()
  const matches = sessions.filter((s) => s.id.startsWith(partialId))

  if (matches.length === 0) {
    console.log(chalk.red(`  No session found matching "${partialId}"`))
    return null
  }

  if (matches.length > 1) {
    console.log(chalk.yellow(`  Multiple sessions match "${partialId}":`))
    for (const s of matches.slice(0, 5)) {
      console.log(`    ${formatSessionId(s.id)} - ${s.status}`)
    }
    return null
  }

  return matches[0]
}

registerCommand({
  name: "kill",
  aliases: ["cancel", "stop"],
  description: "Cancel running session",
  usage: "kill <sessionId>",

  async execute(args, ctx: CLIContext) {
    const partialId = args[0]

    if (!partialId) {
      console.log(chalk.red("  Usage: kill <sessionId>"))
      return
    }

    const session = await findSession(ctx, partialId)
    if (!session) return

    if (session.status !== "running" && session.status !== "pending") {
      console.log(chalk.yellow(`  Session ${formatSessionId(session.id)} is not running (status: ${session.status})`))
      return
    }

    const spinner = ora(`Cancelling session ${formatSessionId(session.id)}...`).start()

    try {
      const result = await ctx.trpc.agent.cancel({ id: session.id })

      if (result.success) {
        spinner.succeed(`Session ${formatSessionId(session.id)} cancelled`)
      } else {
        spinner.warn(`Session ${formatSessionId(session.id)} may not have been cancelled`)
      }
    } catch (err) {
      spinner.fail("Failed to cancel session")
      console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`))
    }
  },
})
