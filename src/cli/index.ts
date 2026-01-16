/**
 * CLI Main Module - orchestrates server startup and REPL
 */

import chalk from "chalk"
import ora from "ora"
import open from "open"
import { startStreamServer, cleanupServerInfo } from "../streams/server"
import { rehydrateDaemonsOnBoot } from "../daemon/rehydrate"
import { startProductionServer, isPortAvailable } from "./server"
import { createCLIContext, type CLIConfig } from "./context"
import { startREPL } from "./repl"
import { formatBanner } from "./formatter"
import { initializeCommands } from "./commands/index"

export interface CLIOptions {
  port?: number
  host?: string
  open?: boolean
  daemon?: boolean
}

const DEFAULT_PORT = 4200
const DEFAULT_HOST = "127.0.0.1"

/**
 * Read package version
 */
async function getVersion(): Promise<string> {
  try {
    const { readFile } = await import("fs/promises")
    const { join } = await import("path")
    const pkgPath = join(process.cwd(), "package.json")
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"))
    return pkg.version || "1.0.0"
  } catch {
    return "1.0.0"
  }
}

/**
 * Main CLI entry point
 */
export async function main(options: CLIOptions = {}): Promise<void> {
  // Initialize commands first
  await initializeCommands()

  const port = options.port ?? DEFAULT_PORT
  const host = options.host ?? DEFAULT_HOST
  const shouldOpen = options.open ?? true
  const workingDir = process.cwd()

  const config: CLIConfig = {
    port,
    host,
    open: shouldOpen,
    workingDir,
  }

  // Check if port is available
  const portAvailable = await isPortAvailable(port, host)
  if (!portAvailable) {
    console.log(chalk.yellow(`  Port ${port} is already in use.`))
    console.log(chalk.gray(`  Connecting to existing server...`))
    console.log()

    // Create context and start REPL with existing server
    const ctx = createCLIContext(config)
    const version = await getVersion()
    console.log(formatBanner(version, `http://${host}:${port}`))

    await startREPL({
      ctx,
      onExit: () => process.exit(0),
      onQuit: async () => process.exit(0),
    })
    return
  }

  // Start streams server
  const streamsSpinner = ora("Starting streams server...").start()
  let streamServer: Awaited<ReturnType<typeof startStreamServer>> | null = null

  try {
    streamServer = await startStreamServer()
    streamsSpinner.succeed("Streams server started")
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "EADDRINUSE"
    ) {
      streamsSpinner.succeed("Streams server already running")
    } else {
      streamsSpinner.fail("Failed to start streams server")
      throw err
    }
  }

  // Rehydrate daemons
  const rehydrateSpinner = ora("Rehydrating agent daemons...").start()
  try {
    await rehydrateDaemonsOnBoot()
    rehydrateSpinner.succeed("Agent daemons rehydrated")
  } catch (err) {
    rehydrateSpinner.warn("Failed to rehydrate daemons")
    console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`))
  }

  // Start HTTP server
  const serverSpinner = ora("Starting web server...").start()
  let httpServer: Awaited<ReturnType<typeof startProductionServer>> | null = null

  try {
    httpServer = await startProductionServer({ port, host })
    serverSpinner.succeed(`Web server started at ${httpServer.url}`)
  } catch (err) {
    serverSpinner.fail("Failed to start web server")
    throw err
  }

  // Open browser
  if (shouldOpen) {
    try {
      await open(httpServer.url)
    } catch {
      // Ignore open errors
    }
  }

  // Show banner
  const version = await getVersion()
  console.log()
  console.log(formatBanner(version, httpServer.url))

  // Create context
  const ctx = createCLIContext(config)

  // Define shutdown function
  const shutdown = async () => {
    console.log()
    console.log(chalk.gray("  Shutting down..."))

    if (httpServer) {
      await httpServer.close()
    }

    if (streamServer) {
      await streamServer.close()
    }

    cleanupServerInfo()
    process.exit(0)
  }

  // Handle process signals
  process.on("SIGTERM", shutdown)

  // Start REPL
  await startREPL({
    ctx,
    onExit: () => {
      console.log(chalk.gray(`  Server still running at ${httpServer?.url}`))
      console.log(chalk.gray("  Press Ctrl+C to stop"))
      // Don't exit - let server continue
    },
    onQuit: shutdown,
  })
}

/**
 * Parse CLI arguments
 */
export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--port" || arg === "-p") {
      const port = parseInt(args[++i], 10)
      if (!isNaN(port)) options.port = port
    } else if (arg === "--host" || arg === "-h") {
      // Check if next arg looks like a host
      const next = args[i + 1]
      if (next && !next.startsWith("-")) {
        options.host = args[++i]
      }
    } else if (arg === "--no-open") {
      options.open = false
    } else if (arg === "--daemon" || arg === "-d") {
      options.daemon = true
    }
  }

  return options
}
