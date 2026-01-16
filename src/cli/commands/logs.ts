/**
 * logs command - Stream real-time output from a session
 */

import chalk from "chalk"
import { registerCommand } from "./index"
import { formatOutputChunk, formatSessionId } from "../formatter"
import type { CLIContext } from "../context"
import type { AgentOutputEvent } from "../../streams/schemas"

/** Find session by partial ID match */
async function findSession(
  ctx: CLIContext,
  partialId: string
): Promise<{ id: string } | null> {
  const sessions = await ctx.trpc.agent.list()
  const matches = sessions.filter((s) => s.id.startsWith(partialId))

  if (matches.length === 0) {
    console.log(chalk.red(`  No session found matching "${partialId}"`))
    return null
  }

  if (matches.length > 1) {
    console.log(chalk.yellow(`  Multiple sessions match "${partialId}":`))
    for (const s of matches.slice(0, 5)) {
      console.log(`    ${formatSessionId(s.id)} - ${s.title || s.prompt.slice(0, 40)}`)
    }
    return null
  }

  return matches[0]
}

registerCommand({
  name: "logs",
  aliases: ["log", "tail"],
  description: "Stream real-time output from session",
  usage: "logs <sessionId> [--follow]",

  async execute(args, ctx: CLIContext) {
    const partialId = args[0]
    const follow = args.includes("--follow") || args.includes("-f")

    if (!partialId) {
      console.log(chalk.red("  Usage: logs <sessionId>"))
      return
    }

    const session = await findSession(ctx, partialId)
    if (!session) return

    console.log(chalk.gray(`  Streaming logs for ${formatSessionId(session.id)}...`))
    console.log(chalk.gray("  Press Ctrl+C to stop"))
    console.log()

    // Read historical events first
    const events = await ctx.streams.readSession(session.id)
    for (const event of events) {
      if (event.type === "output") {
        const outputEvent = event as AgentOutputEvent
        const formatted = formatOutputChunk(outputEvent.chunk)
        if (formatted) {
          process.stdout.write(formatted)
          if (!formatted.endsWith("\n")) {
            process.stdout.write("\n")
          }
        }
      }
    }

    if (!follow) {
      console.log()
      console.log(chalk.gray("  End of logs. Use --follow to stream live."))
      return
    }

    // Set up live streaming
    let stopped = false
    const stopHandler = () => {
      stopped = true
      process.removeListener("SIGINT", stopHandler)
      console.log()
      console.log(chalk.gray("  Stopped streaming"))
    }
    process.on("SIGINT", stopHandler)

    try {
      const stream = ctx.streams.subscribeToSession(session.id)
      for await (const event of stream) {
        if (stopped) break

        if (event.type === "output") {
          const outputEvent = event as AgentOutputEvent
          const formatted = formatOutputChunk(outputEvent.chunk)
          if (formatted) {
            process.stdout.write(formatted)
            if (!formatted.endsWith("\n")) {
              process.stdout.write("\n")
            }
          }
        }
      }
    } catch (err) {
      if (!stopped) {
        console.error(chalk.red("  Stream error:"), err)
      }
    }
  },
})
