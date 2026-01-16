/**
 * help command - Show command reference
 */

import chalk from "chalk"
import { registerCommand, getAllCommands } from "./index"
import type { CLIContext } from "../context"

registerCommand({
  name: "help",
  aliases: ["?", "h"],
  description: "Show available commands",
  usage: "help [command]",

  async execute(args, _ctx: CLIContext) {
    const commandName = args[0]

    if (commandName) {
      // Show help for specific command
      const commands = getAllCommands()
      const command = commands.find(
        (c) => c.name === commandName || c.aliases?.includes(commandName)
      )

      if (!command) {
        console.log(chalk.red(`  Unknown command: ${commandName}`))
        return
      }

      console.log()
      console.log(chalk.bold(`  ${command.name}`))
      if (command.aliases?.length) {
        console.log(chalk.gray(`  Aliases: ${command.aliases.join(", ")}`))
      }
      console.log()
      console.log(`  ${command.description}`)
      console.log()
      console.log(chalk.gray(`  Usage: ${command.usage}`))
      console.log()
      return
    }

    // Show all commands
    console.log()
    console.log(chalk.bold("  Commands:"))
    console.log()

    const commands = getAllCommands()
    const maxLen = Math.max(...commands.map((c) => c.name.length))

    for (const command of commands) {
      const padding = " ".repeat(maxLen - command.name.length)
      console.log(`    ${chalk.cyan(command.name)}${padding}  ${command.description}`)
    }

    console.log()
    console.log(chalk.bold("  Special Commands:"))
    console.log()
    console.log(`    ${chalk.cyan("exit")}     Exit CLI (keeps server running)`)
    console.log(`    ${chalk.cyan("quit")}     Stop server and exit`)
    console.log()
    console.log(chalk.gray("  Type 'help <command>' for detailed help"))
    console.log()
  },
})
