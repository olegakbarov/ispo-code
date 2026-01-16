/**
 * open command - Open web UI in browser
 */

import chalk from "chalk"
import open from "open"
import { registerCommand } from "./index"
import type { CLIContext } from "../context"

registerCommand({
  name: "open",
  aliases: ["browser", "ui"],
  description: "Open web UI in browser",
  usage: "open",

  async execute(_args, ctx: CLIContext) {
    const url = `http://${ctx.config.host}:${ctx.config.port}`

    console.log(chalk.gray(`  Opening ${url} in default browser...`))

    try {
      await open(url)
    } catch (err) {
      console.error(chalk.red(`  Failed to open browser: ${err instanceof Error ? err.message : String(err)}`))
      console.log(chalk.gray(`  Please open ${url} manually`))
    }
  },
})
