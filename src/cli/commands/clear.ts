/**
 * clear command - Clear terminal
 */

import { registerCommand } from "./index"
import type { CLIContext } from "../context"

registerCommand({
  name: "clear",
  aliases: ["cls"],
  description: "Clear terminal",
  usage: "clear",

  async execute(_args, _ctx: CLIContext) {
    console.clear()
  },
})
