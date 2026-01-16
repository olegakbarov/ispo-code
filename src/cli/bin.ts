#!/usr/bin/env node
/**
 * CLI Binary Entry Point
 *
 * This is the main entry point for the `ispo` command.
 */

import { main, parseArgs } from "./index"

const args = process.argv.slice(2)

// Handle --help
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  ispo-code - Multi-agent AI coding assistant control panel

  Usage:
    ispo [options]

  Options:
    -p, --port <n>    Server port (default: 4200)
    --host <host>     Server host (default: 127.0.0.1)
    --no-open         Don't open browser on start
    -h, --help        Show this help message
    -v, --version     Show version number

  Commands (in REPL):
    status            Show dashboard with running agents
    list              List all sessions
    logs <id>         Stream real-time output from session
    spawn <agent> <p> Create new agent session
    kill <id>         Cancel running session
    open              Open web UI in browser
    help              Show available commands
    exit              Exit CLI (keeps server running)
    quit              Stop server and exit
`)
  process.exit(0)
}

// Handle --version
if (args.includes("--version") || args.includes("-v")) {
  const { readFileSync } = await import("fs")
  const { join } = await import("path")
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"))
    console.log(pkg.version || "1.0.0")
  } catch {
    console.log("1.0.0")
  }
  process.exit(0)
}

// Parse options and start
const options = parseArgs(args)

try {
  await main(options)
} catch (err) {
  console.error("Failed to start:", err instanceof Error ? err.message : String(err))
  process.exit(1)
}
