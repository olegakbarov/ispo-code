/**
 * spawn command - Create new agent session
 */

import chalk from "chalk"
import ora from "ora"
import { registerCommand } from "./index"
import { formatSessionId, formatAgentType } from "../formatter"
import type { CLIContext } from "../context"

const VALID_AGENTS = ["claude", "codex", "opencode", "cerebras", "gemini", "mcporter"]

registerCommand({
  name: "spawn",
  aliases: ["new", "create", "run"],
  description: "Create new agent session",
  usage: 'spawn <agent> "<prompt>"',

  async execute(args, ctx: CLIContext) {
    if (args.length < 2) {
      console.log(chalk.red("  Usage: spawn <agent> <prompt>"))
      console.log(chalk.gray(`  Available agents: ${VALID_AGENTS.join(", ")}`))
      return
    }

    const [agentType, ...promptParts] = args
    const prompt = promptParts.join(" ")

    if (!VALID_AGENTS.includes(agentType)) {
      console.log(chalk.red(`  Unknown agent type: ${agentType}`))
      console.log(chalk.gray(`  Available agents: ${VALID_AGENTS.join(", ")}`))
      return
    }

    const spinner = ora(`Spawning ${agentType} agent...`).start()

    try {
      const result = await ctx.trpc.agent.spawn({
        agentType: agentType as "claude" | "codex" | "opencode" | "cerebras" | "gemini" | "mcporter",
        prompt,
      })

      spinner.succeed(`Spawned ${formatAgentType(agentType)} agent`)
      console.log()
      console.log(`  Session ID: ${formatSessionId(result.sessionId)}`)
      console.log(`  Status: ${chalk.yellow("running")}`)
      console.log()
      console.log(chalk.gray(`  Use 'logs ${result.sessionId.slice(0, 7)}' to stream output`))
    } catch (err) {
      spinner.fail("Failed to spawn agent")
      console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`))
    }
  },
})
