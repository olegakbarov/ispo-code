/**
 * CLI Output Formatting Utilities
 */

import chalk from "chalk"
import Table from "cli-table3"
import type { RouterOutputs } from "./context"

type AgentSession = RouterOutputs["agent"]["list"][number]

/** Status indicators */
export const STATUS_ICONS = {
  running: chalk.green("●"),
  pending: chalk.yellow("○"),
  completed: chalk.blue("✓"),
  failed: chalk.red("✗"),
  cancelled: chalk.gray("⊘"),
  idle: chalk.gray("○"),
} as const

/** Format session status with icon */
export function formatStatus(status: string): string {
  const icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || chalk.gray("?")
  return `${icon} ${status}`
}

/** Truncate string to max length with ellipsis */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + "..."
}

/** Format session ID (first 7 chars) */
export function formatSessionId(id: string): string {
  return chalk.cyan(id.slice(0, 7))
}

/** Format agent type with color */
export function formatAgentType(type: string): string {
  const colors: Record<string, typeof chalk> = {
    claude: chalk.magenta,
    codex: chalk.blue,
    opencode: chalk.green,
    cerebras: chalk.yellow,
    gemini: chalk.cyan,
    mcporter: chalk.white,
  }
  const color = colors[type] || chalk.white
  return color(type)
}

/** Format duration from start time */
export function formatDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  const now = Date.now()
  const diffMs = now - start

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

/** Format timestamp for logs */
export function formatTimestamp(ts: string | number): string {
  const date = new Date(ts)
  return chalk.gray(
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  )
}

/** Create sessions table */
export function createSessionsTable(sessions: AgentSession[]): string {
  if (sessions.length === 0) {
    return chalk.gray("  No sessions found")
  }

  const table = new Table({
    head: [
      chalk.bold("ID"),
      chalk.bold("Agent"),
      chalk.bold("Status"),
      chalk.bold("Task"),
    ],
    style: {
      head: [],
      border: [],
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  })

  for (const session of sessions) {
    const title = session.title || session.prompt
    table.push([
      formatSessionId(session.id),
      formatAgentType(session.agentType || "unknown"),
      formatStatus(session.status),
      truncate(title, 40),
    ])
  }

  return table.toString()
}

/** Format banner */
export function formatBanner(version: string, url: string): string {
  const lines = [
    "",
    chalk.bold.cyan("  ispo-code") + chalk.gray(` v${version}`),
    chalk.gray(`  Web UI: ${url}`),
    "",
  ]
  return lines.join("\n")
}

/** Format process stats */
export function formatProcessStats(stats: {
  total: number
  running: number
  dead: number
  byAgentType: Record<string, number>
}): string {
  const lines: string[] = []

  lines.push(
    `  Processes: ${chalk.green(stats.running)} running, ` +
    `${chalk.red(stats.dead)} dead, ` +
    `${chalk.gray(stats.total)} total`
  )

  if (Object.keys(stats.byAgentType).length > 0) {
    const agents = Object.entries(stats.byAgentType)
      .map(([type, count]) => `${formatAgentType(type)} (${count})`)
      .join(", ")
    lines.push(`  Agents: ${agents}`)
  }

  return lines.join("\n")
}

/** Format output chunk for log streaming */
export function formatOutputChunk(chunk: { type: string; content: string; timestamp?: string | number }): string {
  const ts = chunk.timestamp ? formatTimestamp(chunk.timestamp) : ""
  const prefix = ts ? `${ts} ` : ""

  switch (chunk.type) {
    case "text":
      return prefix + chunk.content
    case "tool_use":
      try {
        const tool = JSON.parse(chunk.content)
        return prefix + chalk.yellow(`[Tool: ${tool.name || "unknown"}]`)
      } catch {
        return prefix + chalk.yellow("[Tool call]")
      }
    case "tool_result":
      return prefix + chalk.gray("[Tool result]")
    case "error":
      return prefix + chalk.red(`Error: ${chunk.content}`)
    default:
      return prefix + chunk.content
  }
}

/** Print a box around text */
export function box(content: string): string {
  const lines = content.split("\n")
  const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length))
  const top = "╭" + "─".repeat(maxLen + 2) + "╮"
  const bottom = "╰" + "─".repeat(maxLen + 2) + "╯"
  const middle = lines.map((line) => {
    const padding = maxLen - stripAnsi(line).length
    return "│ " + line + " ".repeat(padding) + " │"
  })
  return [top, ...middle, bottom].join("\n")
}

/** Strip ANSI codes for length calculation */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
}
