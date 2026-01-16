/**
 * Interactive REPL - readline-based command interface
 */

import * as readline from "readline"
import chalk from "chalk"
import { getCommand, parseInput } from "./commands/index"
import type { CLIContext } from "./context"

export interface REPLOptions {
  ctx: CLIContext
  onExit?: () => void
  onQuit?: () => Promise<void>
}

/**
 * Start the interactive REPL
 */
export async function startREPL(options: REPLOptions): Promise<void> {
  const { ctx, onExit, onQuit } = options

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  const prompt = () => {
    rl.question(chalk.cyan("ispo") + chalk.gray("> "), async (input) => {
      await handleInput(input)
      prompt()
    })
  }

  const handleInput = async (input: string): Promise<void> => {
    const { commandName, args } = parseInput(input)

    if (!commandName) {
      return
    }

    // Handle special commands
    if (commandName === "exit") {
      console.log(chalk.gray("  Server still running. Use 'quit' to stop server."))
      rl.close()
      onExit?.()
      return
    }

    if (commandName === "quit") {
      console.log(chalk.gray("  Shutting down..."))
      rl.close()
      if (onQuit) {
        await onQuit()
      }
      return
    }

    // Find and execute command
    const command = getCommand(commandName)

    if (!command) {
      console.log(chalk.red(`  Unknown command: ${commandName}`))
      console.log(chalk.gray("  Type 'help' for available commands"))
      return
    }

    try {
      await command.execute(args, ctx)
    } catch (err) {
      console.error(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`))
    }
  }

  // Handle Ctrl+C
  rl.on("SIGINT", () => {
    console.log()
    console.log(chalk.gray("  Press Ctrl+C again or type 'quit' to exit"))
    prompt()
  })

  // Handle close
  rl.on("close", () => {
    // REPL closed
  })

  // Start prompting
  prompt()

  // Return a promise that never resolves (REPL runs until quit)
  return new Promise(() => {})
}
