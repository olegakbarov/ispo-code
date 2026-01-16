import { existsSync, readFileSync } from "fs"
import path from "path"

let loaded = false

/**
 * Minimal dotenv loader for server-side code.
 *
 * TanStack Start/Vite only expose prefixed env vars to the client, and depending on the runtime
 * unprefixed variables in `.env` may not be present in `process.env` for server routes.
 *
 * This loader is intentionally:
 * - Server-only (do not import from client code)
 * - No dependency on `dotenv`
 * - Idempotent and non-destructive (does not override existing `process.env` values)
 */
export function ensureServerEnv(options?: { cwd?: string; filename?: string }): void {
  if (loaded) return
  loaded = true

  const cwd = options?.cwd ?? process.cwd()
  const filename = options?.filename ?? ".env"
  const envPath = path.isAbsolute(filename) ? filename : path.join(cwd, filename)

  if (!existsSync(envPath)) return

  const raw = readFileSync(envPath, "utf-8")
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line
    const eqIdx = normalized.indexOf("=")
    if (eqIdx === -1) continue

    const key = normalized.slice(0, eqIdx).trim()
    if (!key) continue

    let value = normalized.slice(eqIdx + 1).trim()
    if (!value) {
      if (process.env[key] === undefined) process.env[key] = ""
      continue
    }

    // Strip inline comments for unquoted values (e.g. FOO=bar # comment)
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (!isQuoted) {
      const hashIdx = value.indexOf(" #")
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trim()
    }

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/**
 * GitHub OAuth configuration
 * Required for GitHub integration features
 */
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ""
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ""
export const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || "http://localhost:4200/api/auth/github-callback"

