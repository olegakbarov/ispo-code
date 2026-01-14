/**
 * Tool implementations for agent runners
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs"
import { execSync } from "child_process"
import { glob as globLib } from "glob"
import { validatePath } from "./path-validator.js"
import { SecurityConfig } from "./security-config.js"

// === Tool Types ===

export interface ToolResult {
  success: boolean
  content: string
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, { type: string; description?: string }>
    required: string[]
  }
}

// === Tool Implementations ===

/**
 * Read file with line numbers
 */
export function read(args: { path: string; offset?: number; limit?: number }, cwd: string): ToolResult {
  try {
    // Validate path to prevent path traversal
    const fullPath = validatePath(args.path, cwd)

    if (!existsSync(fullPath)) {
      return { success: false, content: `error: file not found: ${args.path}` }
    }

    const content = readFileSync(fullPath, "utf-8")
    const lines = content.split("\n")
    const offset = args.offset ?? 0
    const limit = args.limit ?? lines.length

    const selected = lines.slice(offset, offset + limit)
    const numbered = selected
      .map((line, idx) => `${String(offset + idx + 1).padStart(4)}| ${line}`)
      .join("\n")

    return { success: true, content: numbered || "(empty file)" }
  } catch (err) {
    return { success: false, content: `error: ${(err as Error).message}` }
  }
}

/**
 * Write content to file
 */
export function write(args: { path: string; content: string }, cwd: string): ToolResult {
  try {
    // Validate path to prevent path traversal
    const fullPath = validatePath(args.path, cwd)
    writeFileSync(fullPath, args.content, "utf-8")
    return { success: true, content: "ok" }
  } catch (err) {
    return { success: false, content: `error: ${(err as Error).message}` }
  }
}

/**
 * Edit file by replacing old with new
 */
export function edit(args: {
  path: string
  old: string
  new: string
  all?: boolean
}, cwd: string): ToolResult {
  try {
    // Validate path to prevent path traversal
    const fullPath = validatePath(args.path, cwd)

    if (!existsSync(fullPath)) {
      return { success: false, content: `error: file not found: ${args.path}` }
    }

    const text = readFileSync(fullPath, "utf-8")

    if (!text.includes(args.old)) {
      return { success: false, content: "error: old_string not found" }
    }

    const count = text.split(args.old).length - 1
    if (!args.all && count > 1) {
      return {
        success: false,
        content: `error: old_string appears ${count} times, must be unique (use all=true)`,
      }
    }

    const replacement = args.all
      ? text.replaceAll(args.old, args.new)
      : text.replace(args.old, args.new)

    writeFileSync(fullPath, replacement, "utf-8")
    return { success: true, content: "ok" }
  } catch (err) {
    return { success: false, content: `error: ${(err as Error).message}` }
  }
}

/**
 * Find files by glob pattern
 */
export async function glob(args: { pat: string; path?: string }, cwd: string): Promise<ToolResult> {
  try {
    const basePath = args.path ?? cwd
    // Validate base path to prevent path traversal
    const fullBasePath = validatePath(basePath, cwd)
    const pattern = `${fullBasePath}/${args.pat}`.replace("//", "/")

    const files = await globLib(pattern, { nodir: false })

    // Validate all returned files are within working directory
    const validFiles = files.filter((f) => {
      try {
        validatePath(f, cwd)
        return statSync(f).isFile()
      } catch {
        return false
      }
    })

    // Sort by mtime (most recent first)
    const sorted = validFiles.sort((a, b) => {
      try {
        return statSync(b).mtimeMs - statSync(a).mtimeMs
      } catch {
        return 0
      }
    })

    return { success: true, content: sorted.join("\n") || "none" }
  } catch (err) {
    return { success: false, content: `error: ${(err as Error).message}` }
  }
}

/**
 * Search files for regex pattern
 */
export async function grep(args: { pat: string; path?: string }, cwd: string): Promise<ToolResult> {
  try {
    const basePath = args.path ?? cwd
    // Validate base path to prevent path traversal
    const fullBasePath = validatePath(basePath, cwd)
    const pattern = new RegExp(args.pat)
    const hits: string[] = []

    const files = await globLib(`${fullBasePath}/**/*`, { nodir: true })

    for (const filepath of files) {
      try {
        // Validate each file is within working directory
        validatePath(filepath, cwd)

        const content = readFileSync(filepath, "utf-8")
        const lines = content.split("\n")

        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            hits.push(`${filepath}:${i + 1}:${lines[i].trim()}`)
            if (hits.length >= SecurityConfig.GREP_MAX_RESULTS) break
          }
        }

        if (hits.length >= SecurityConfig.GREP_MAX_RESULTS) break
      } catch {
        // Skip unreadable files or files outside working directory
      }
    }

    return { success: true, content: hits.join("\n") || "none" }
  } catch (err) {
    return { success: false, content: `error: ${(err as Error).message}` }
  }
}

/**
 * Run shell command with security checks
 */
export function bash(args: { cmd: string; timeout?: number }, cwd: string): ToolResult {
  try {
    // Security check: block dangerous commands
    if (SecurityConfig.ENABLE_COMMAND_SANDBOXING) {
      const cmdLower = args.cmd.toLowerCase().trim()

      for (const dangerousCmd of SecurityConfig.DANGEROUS_COMMANDS) {
        if (cmdLower.includes(dangerousCmd.toLowerCase())) {
          console.warn(`[Security] Blocked dangerous command: ${args.cmd}`)
          return {
            success: false,
            content: `error: command blocked for security reasons: contains "${dangerousCmd}"`,
          }
        }
      }
    }

    const result = execSync(args.cmd, {
      cwd,
      encoding: "utf-8",
      timeout: args.timeout ?? SecurityConfig.BASH_DEFAULT_TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: SecurityConfig.MAX_BASH_OUTPUT_BUFFER,
    })

    return { success: true, content: result.trim() || "(empty)" }
  } catch (err) {
    const execErr = err as { stdout?: string; stderr?: string; message: string }
    const output = [execErr.stdout, execErr.stderr].filter(Boolean).join("\n").trim()
    return { success: false, content: output || execErr.message }
  }
}

/**
 * List directory contents
 */
export function ls(args: { path?: string }, cwd: string): ToolResult {
  try {
    const dirPath = args.path ?? cwd
    // Validate path to prevent path traversal
    const fullPath = validatePath(dirPath, cwd)

    if (!existsSync(fullPath)) {
      return { success: false, content: `error: directory not found: ${dirPath}` }
    }

    const entries = readdirSync(fullPath, { withFileTypes: true })
    const formatted = entries
      .sort((a, b) => {
        // Directories first
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      .map((entry) => {
        const suffix = entry.isDirectory() ? "/" : ""
        return `${entry.name}${suffix}`
      })

    return { success: true, content: formatted.join("\n") || "(empty)" }
  } catch (err) {
    return { success: false, content: `error: ${(err as Error).message}` }
  }
}

// === Tool Definitions for API ===

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read",
    description: "Read file with line numbers (file path, not directory)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        offset: { type: "number", description: "Line offset to start from (0-based)" },
        limit: { type: "number", description: "Number of lines to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write",
    description: "Write content to file (creates or overwrites)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit",
    description: "Replace old_string with new_string in file (old must be unique unless all=true)",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        old: { type: "string", description: "String to find and replace" },
        new: { type: "string", description: "Replacement string" },
        all: { type: "boolean", description: "Replace all occurrences (default: false)" },
      },
      required: ["path", "old", "new"],
    },
  },
  {
    name: "glob",
    description: "Find files by glob pattern, sorted by modification time",
    input_schema: {
      type: "object",
      properties: {
        pat: { type: "string", description: "Glob pattern (e.g., **/*.ts)" },
        path: { type: "string", description: "Base path to search from (default: .)" },
      },
      required: ["pat"],
    },
  },
  {
    name: "grep",
    description: "Search files for regex pattern (returns up to 50 matches)",
    input_schema: {
      type: "object",
      properties: {
        pat: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Base path to search in (default: .)" },
      },
      required: ["pat"],
    },
  },
  {
    name: "bash",
    description: "Run shell command (30s timeout)",
    input_schema: {
      type: "object",
      properties: {
        cmd: { type: "string", description: "Shell command to execute" },
        timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
      },
      required: ["cmd"],
    },
  },
  {
    name: "ls",
    description: "List directory contents",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: .)" },
      },
      required: [],
    },
  },
]

// === Tool Executor ===

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  workingDir?: string
): Promise<ToolResult> {
  const cwd = workingDir ?? process.cwd()
  switch (name) {
    case "read":
      return read(args as Parameters<typeof read>[0], cwd)
    case "write":
      return write(args as Parameters<typeof write>[0], cwd)
    case "edit":
      return edit(args as Parameters<typeof edit>[0], cwd)
    case "glob":
      return glob(args as Parameters<typeof glob>[0], cwd)
    case "grep":
      return grep(args as Parameters<typeof grep>[0], cwd)
    case "bash":
      return bash(args as Parameters<typeof bash>[0], cwd)
    case "ls":
      return ls(args as Parameters<typeof ls>[0], cwd)
    default:
      return { success: false, content: `error: unknown tool: ${name}` }
  }
}
