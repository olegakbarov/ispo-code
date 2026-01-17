import { createFileRoute } from "@tanstack/react-router"
import { LogBatchSchema, LogLineSchema } from "@/lib/shared/log-schemas"
import { getSession } from "@/lib/auth/session-store"
import * as fs from "fs"
import * as path from "path"
import { z } from "zod"

const BROWSER_LOG_FILE =
  process.env.BROWSER_LOG_FILE || path.join(process.cwd(), "logs", "browser.log")
const REQUIRE_AUTH =
  process.env.BROWSER_LOG_REQUIRE_AUTH !== undefined
    ? process.env.BROWSER_LOG_REQUIRE_AUTH === "true"
    : process.env.NODE_ENV === "production"

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
}

const MAX_BODY_CHARS = 100_000
const MAX_LOG_LINES = 50
const MAX_MESSAGE_CHARS = 2_000
const MAX_DATA_CHARS = 8_000
const MAX_LOG_FILE_LINES = Number(process.env.BROWSER_LOG_MAX_LINES || "5000")

function ensureDirExists(filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true

  try {
    return origin === new URL(request.url).origin
  } catch {
    return false
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return "\"[unserializable]\""
  }
}

function clamp(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}...[truncated]`
}

function rotateLogFile(filePath: string): void {
  if (!Number.isFinite(MAX_LOG_FILE_LINES) || MAX_LOG_FILE_LINES <= 0) return

  try {
    const content = fs.readFileSync(filePath, "utf8")
    const lines = content.split("\n")
    if (lines[lines.length - 1] === "") {
      lines.pop()
    }
    if (lines.length <= MAX_LOG_FILE_LINES) return
    const trimmed = lines.slice(-MAX_LOG_FILE_LINES)
    fs.writeFileSync(filePath, `${trimmed.join("\n")}\n`, "utf8")
  } catch {
    // Avoid surfacing logging failures.
  }
}

const serve = async (request: Request) => {
  try {
    if (!isSameOrigin(request)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      })
    }

    if (REQUIRE_AUTH) {
      let session: Awaited<ReturnType<typeof getSession>> | null = null
      try {
        session = await getSession(request)
      } catch {
        session = null
      }
      if (!session?.userId) {
        return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
          status: 401,
          headers: jsonHeaders,
        })
      }
    }

    const rawText = await request.text()
    if (rawText.length > MAX_BODY_CHARS) {
      return new Response(JSON.stringify({ ok: false, error: "payload_too_large" }), {
        status: 413,
        headers: jsonHeaders,
      })
    }

    let rawBody: unknown
    try {
      rawBody = rawText ? JSON.parse(rawText) : null
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const parsed = LogBatchSchema.safeParse(rawBody)

    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const lines = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
    const limitedLines = lines.slice(0, MAX_LOG_LINES)
    ensureDirExists(BROWSER_LOG_FILE)

    const now = new Date()
    const toLine = (entry: z.infer<typeof LogLineSchema>): string => {
      const ts =
        typeof entry.t === "number"
          ? new Date(entry.t).toISOString()
          : typeof entry.t === "string"
            ? entry.t
            : now.toISOString()

      const loc = entry.url
        ? ` (${entry.url}${entry.lineNumber != null ? `:${entry.lineNumber}` : ""}${entry.columnNumber != null ? `:${entry.columnNumber}` : ""})`
        : ""

      const level = clamp(String(entry.level ?? "info").toUpperCase(), 10).padEnd(5)
      const msg = clamp(String(entry.msg ?? ""), MAX_MESSAGE_CHARS)
      const base = `${ts} ${level} [web] ${msg}${clamp(loc, 1024)}`
      const tailRaw =
        entry.data !== undefined
          ? clamp(safeJsonStringify(entry.data), MAX_DATA_CHARS)
          : ""
      const tail = tailRaw ? ` ${tailRaw}` : ""
      return `${base}${tail}`
    }

    const payload = limitedLines.map(toLine).join("\n") + "\n"
    fs.appendFileSync(BROWSER_LOG_FILE, payload, "utf8")
    rotateLogFile(BROWSER_LOG_FILE)

    return new Response(null, { status: 204 })
  } catch (_err: unknown) {
    void _err
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: jsonHeaders,
    })
  }
}

export const Route = createFileRoute("/api/log")({
  server: {
    handlers: {
      POST: async ({ request }) => serve(request),
    },
  },
})
