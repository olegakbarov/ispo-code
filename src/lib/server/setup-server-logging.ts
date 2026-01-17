let installed = false

export function installServerLogging(): void {
  // Runtime guard ensures client bundles no-op.
}

if (typeof window === "undefined" && !installed) {
  installed = true

  const { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } =
    await import("node:fs")
  const { join, dirname } = await import("node:path")

  const SERVER_LOG_FILE =
    process.env.SERVER_LOG_FILE || join(process.cwd(), "logs", "server.log")
  const MAX_SERVER_LOG_LINES = Number(process.env.SERVER_LOG_MAX_LINES || "5000")
  const LOG_TO_FILE = process.env.SERVER_LOG_ENABLED !== "false"
  const DEFAULT_SUPPRESS = ["better auth", "better-auth"]
  const rawSuppress = process.env.SERVER_LOG_SUPPRESS
  const suppressSource =
    rawSuppress === undefined ? DEFAULT_SUPPRESS : rawSuppress.split(",")
  const SUPPRESS_PATTERNS = Array.from(
    new Set(
      suppressSource.map((value) => value.trim().toLowerCase()).filter(Boolean)
    )
  )

  const ensureLogDirExists = (filePath: string) => {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  const ansiRegex = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
  const stripAnsi = (value: string): string => value.replace(ansiRegex, "")

  const serializeArg = (arg: unknown): string => {
    if (typeof arg === "string") return arg
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }

  const shouldSuppress = (args: unknown[]) => {
    if (SUPPRESS_PATTERNS.length === 0) return false
    const message = stripAnsi(args.map(serializeArg).join(" ")).toLowerCase()
    return SUPPRESS_PATTERNS.some((pattern) => message.includes(pattern))
  }

  const countLines = (value: string): number => {
    if (!value) return 0
    const parts = value.split("\n")
    return parts[parts.length - 1] === "" ? parts.length - 1 : parts.length
  }

  let lineCount = 0
  if (existsSync(SERVER_LOG_FILE)) {
    try {
      lineCount = countLines(readFileSync(SERVER_LOG_FILE, "utf8"))
    } catch {
      lineCount = 0
    }
  }

  const rotateIfNeeded = () => {
    if (!Number.isFinite(MAX_SERVER_LOG_LINES) || MAX_SERVER_LOG_LINES <= 0) {
      return
    }
    if (lineCount <= MAX_SERVER_LOG_LINES) return

    try {
      const content = readFileSync(SERVER_LOG_FILE, "utf8")
      const lines = content.split("\n")
      if (lines[lines.length - 1] === "") {
        lines.pop()
      }
      const trimmed = lines.slice(-MAX_SERVER_LOG_LINES)
      writeFileSync(SERVER_LOG_FILE, `${trimmed.join("\n")}\n`, "utf8")
      lineCount = trimmed.length
    } catch {
      // Avoid recursive logging inside the logger.
    }
  }

  const appendLog = (level: string, args: unknown[]) => {
    const timestamp = new Date().toISOString()
    ensureLogDirExists(SERVER_LOG_FILE)
    appendFileSync(
      SERVER_LOG_FILE,
      `${timestamp} ${level} [server pid=${process.pid}] ${stripAnsi(
        args.map(serializeArg).join(" ")
      )}\n`,
      "utf8"
    )
    lineCount += 1
    rotateIfNeeded()
  }

  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  }

  console.log = (...args: unknown[]) => {
    if (LOG_TO_FILE && !shouldSuppress(args)) {
      appendLog("INFO", args)
    }
    originalConsole.log(...args)
  }

  console.info = (...args: unknown[]) => {
    if (LOG_TO_FILE && !shouldSuppress(args)) {
      appendLog("INFO", args)
    }
    originalConsole.info(...args)
  }

  console.warn = (...args: unknown[]) => {
    if (LOG_TO_FILE && !shouldSuppress(args)) {
      appendLog("WARN", args)
    }
    originalConsole.warn(...args)
  }

  console.error = (...args: unknown[]) => {
    if (LOG_TO_FILE && !shouldSuppress(args)) {
      appendLog("ERROR", args)
    }
    originalConsole.error(...args)
  }

  console.debug = (...args: unknown[]) => {
    if (LOG_TO_FILE && !shouldSuppress(args)) {
      appendLog("DEBUG", args)
    }
    originalConsole.debug(...args)
  }

  process.on("uncaughtException", (err) => {
    if (LOG_TO_FILE) {
      appendLog("ERROR", [
        "Uncaught exception",
        err instanceof Error ? err.stack ?? err.message : err,
      ])
    }
    originalConsole.error(err)
  })

  process.on("unhandledRejection", (reason) => {
    if (LOG_TO_FILE) {
      appendLog("ERROR", ["Unhandled rejection", reason])
    }
    originalConsole.error(reason)
  })

  if (LOG_TO_FILE) {
    appendLog("INFO", [
      "Server logging installed",
      { nodeEnv: process.env.NODE_ENV, cwd: process.cwd() },
    ])
  }
}
