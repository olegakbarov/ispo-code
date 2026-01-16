/**
 * Command Registry - manages all available REPL commands
 */

import type { CLIContext } from "../context"

export interface Command {
  name: string
  aliases?: string[]
  description: string
  usage: string
  execute(args: string[], ctx: CLIContext): Promise<void>
}

const commands = new Map<string, Command>()
const aliasMap = new Map<string, string>()

/** Register a command */
export function registerCommand(command: Command): void {
  commands.set(command.name, command)
  if (command.aliases) {
    for (const alias of command.aliases) {
      aliasMap.set(alias, command.name)
    }
  }
}

/** Get a command by name or alias */
export function getCommand(nameOrAlias: string): Command | undefined {
  const name = aliasMap.get(nameOrAlias) || nameOrAlias
  return commands.get(name)
}

/** Get all registered commands */
export function getAllCommands(): Command[] {
  return Array.from(commands.values())
}

/** Parse command input into command name and args */
export function parseInput(input: string): { commandName: string; args: string[] } {
  const trimmed = input.trim()
  if (!trimmed) {
    return { commandName: "", args: [] }
  }

  // Simple tokenizer that handles quoted strings
  const tokens: string[] = []
  let current = ""
  let inQuote = false
  let quoteChar = ""

  for (const char of trimmed) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false
        tokens.push(current)
        current = ""
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = true
      quoteChar = char
    } else if (char === " ") {
      if (current) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += char
    }
  }

  if (current) {
    tokens.push(current)
  }

  const [commandName, ...args] = tokens
  return { commandName: commandName || "", args }
}

// Register all commands
import "./status"
import "./list"
import "./logs"
import "./spawn"
import "./kill"
import "./open"
import "./help"
import "./clear"
