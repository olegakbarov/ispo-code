/**
 * Production HTTP Server for CLI
 *
 * Serves the built TanStack Start app and static assets.
 * Uses the native Node.js http module to avoid vite dependency.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { createReadStream, existsSync, statSync } from "fs"
import { join, extname } from "path"
import type { Server } from "http"

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".map": "application/json",
}

interface ServerConfig {
  port: number
  host: string
  distDir?: string
}

interface StartedServer {
  port: number
  host: string
  url: string
  server: Server
  close: () => Promise<void>
}

/**
 * Serve static file
 */
function serveStatic(
  _req: IncomingMessage,
  res: ServerResponse,
  filePath: string
): boolean {
  if (!existsSync(filePath)) {
    return false
  }

  const stat = statSync(filePath)
  if (!stat.isFile()) {
    return false
  }

  const ext = extname(filePath).toLowerCase()
  const contentType = MIME_TYPES[ext] || "application/octet-stream"

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": "public, max-age=31536000, immutable",
  })

  createReadStream(filePath).pipe(res)
  return true
}

/**
 * Convert Node request to Web Request
 */
function nodeToWebRequest(req: IncomingMessage, host: string, port: number): Request {
  const protocol = "http"
  const url = new URL(req.url || "/", `${protocol}://${host}:${port}`)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v)
        }
      } else {
        headers.set(key, value)
      }
    }
  }

  const body =
    req.method !== "GET" && req.method !== "HEAD"
      ? new ReadableStream({
          start(controller) {
            req.on("data", (chunk) => controller.enqueue(chunk))
            req.on("end", () => controller.close())
            req.on("error", (err) => controller.error(err))
          },
        })
      : undefined

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    // @ts-expect-error - Node.js specific option
    duplex: body ? "half" : undefined,
  })
}

/**
 * Write Web Response to Node response
 */
async function webToNodeResponse(
  webRes: Response,
  nodeRes: ServerResponse
): Promise<void> {
  nodeRes.statusCode = webRes.status
  nodeRes.statusMessage = webRes.statusText

  webRes.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value)
  })

  if (webRes.body) {
    const reader = webRes.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        nodeRes.write(value)
      }
    } finally {
      reader.releaseLock()
    }
  }

  nodeRes.end()
}

/**
 * Start the production HTTP server
 */
export async function startProductionServer(config: ServerConfig): Promise<StartedServer> {
  const { port, host, distDir = join(process.cwd(), "dist") } = config

  const clientDir = join(distDir, "client")
  const serverPath = join(distDir, "server", "server.js")

  // Verify build exists
  if (!existsSync(serverPath)) {
    throw new Error(`Server build not found at ${serverPath}. Run 'npm run build' first.`)
  }

  // Import the server handler
  const serverModule = await import(serverPath)
  const handler = serverModule.default

  if (!handler || typeof handler.fetch !== "function") {
    throw new Error("Server module does not export a fetch handler")
  }

  const server = createServer(async (req, res) => {
    const url = req.url || "/"

    try {
      // Try serving static assets first
      if (url.startsWith("/assets/") || url.startsWith("/fonts/")) {
        const filePath = join(clientDir, url)
        if (serveStatic(req, res, filePath)) {
          return
        }
      }

      // Serve other static files from client dir
      if (url !== "/" && !url.includes("?")) {
        const filePath = join(clientDir, url)
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          if (serveStatic(req, res, filePath)) {
            return
          }
        }
      }

      // Use SSR handler for everything else
      const webReq = nodeToWebRequest(req, host, port)
      const webRes = await handler.fetch(webReq)
      await webToNodeResponse(webRes, res)
    } catch (err) {
      console.error("[Server] Error handling request:", err)
      res.writeHead(500, { "Content-Type": "text/plain" })
      res.end("Internal Server Error")
    }
  })

  return new Promise((resolve, reject) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use`))
      } else {
        reject(err)
      }
    })

    server.listen(port, host, () => {
      const url = `http://${host}:${port}`
      resolve({
        port,
        host,
        url,
        server,
        close: () =>
          new Promise<void>((resolve) => {
            server.close(() => resolve())
          }),
      })
    })
  })
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}
