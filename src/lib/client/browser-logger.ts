import type { LogLine } from "@/lib/shared/log-schemas"

type LogLevel = "debug" | "info" | "warn" | "error"

class BrowserLogger {
  private buffer: LogLine[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private endpoint = "/api/log"
  private maxBufferSize = 50
  private flushIntervalMs = 2000

  constructor() {
    this.interceptConsole()

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush())
      window.addEventListener("unload", () => this.flush())
    }
  }

  private interceptConsole(): void {
    if (typeof window === "undefined") return

    const isProduction = import.meta.env.PROD

    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    }

    console.log = (...args) => {
      originalConsole.log(...args)
      if (!isProduction) {
        this.log("info", args)
      }
    }

    console.info = (...args) => {
      originalConsole.info(...args)
      if (!isProduction) {
        this.log("info", args)
      }
    }

    console.warn = (...args) => {
      originalConsole.warn(...args)
      this.log("warn", args)
    }

    console.error = (...args) => {
      originalConsole.error(...args)
      this.log("error", args)
    }

    console.debug = (...args) => {
      originalConsole.debug(...args)
      if (!isProduction) {
        this.log("debug", args)
      }
    }

    window.addEventListener("error", (event) => {
      this.log("error", [`Uncaught error: ${event.message}`], {
        url: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
      })
    })

    window.addEventListener("unhandledrejection", (event) => {
      this.log("error", [`Unhandled promise rejection: ${String(event.reason)}`])
    })
  }

  private formatMessage(args: unknown[]): string {
    const cleanedArgs: unknown[] = []
    let styleArgsToSkip = 0

    for (const arg of args) {
      if (typeof arg === "string") {
        if (styleArgsToSkip > 0 && /^color:\s*/.test(arg)) {
          styleArgsToSkip -= 1
          continue
        }
        const colorCount = (arg.match(/%c/g) || []).length
        styleArgsToSkip += colorCount
        const cleaned = arg.replace(/%c/g, "")
        if (cleaned.trim()) {
          cleanedArgs.push(cleaned)
        }
      } else {
        cleanedArgs.push(arg)
      }
    }

    return cleanedArgs
      .map((arg) => {
        if (typeof arg === "string") return arg
        if (arg === undefined) return "undefined"
        if (arg === null) return "null"
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(" ")
  }

  private log(
    level: LogLevel,
    args: unknown[],
    extra: Partial<Omit<LogLine, "t" | "level" | "msg">> = {}
  ): void {
    const logLine: LogLine = {
      t: Date.now(),
      level,
      msg: this.formatMessage(args),
      ...extra,
    }

    if (level === "error" && args[0] instanceof Error) {
      const error = args[0]
      logLine.data = {
        stack: error.stack,
        name: error.name,
      }
    }

    this.buffer.push(logLine)

    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush()
    } else {
      this.scheduleFlush()
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return

    this.flushTimer = setTimeout(() => {
      void this.flush()
    }, this.flushIntervalMs)
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.buffer.length === 0) return

    const logs = [...this.buffer]
    this.buffer = []

    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logs),
      })
    } catch {
      this.buffer = [...logs, ...this.buffer]
    }
  }

  public info(message: string, data?: unknown): void {
    this.log("info", [message], data ? { data } : {})
  }

  public warn(message: string, data?: unknown): void {
    this.log("warn", [message], data ? { data } : {})
  }

  public error(message: string, data?: unknown): void {
    this.log("error", [message], data ? { data } : {})
  }

  public debug(message: string, data?: unknown): void {
    this.log("debug", [message], data ? { data } : {})
  }
}

export const logger = typeof window !== "undefined" ? new BrowserLogger() : null

export default logger
