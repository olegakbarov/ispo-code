/**
 * Gemini Agent - Uses Vercel AI SDK with Google provider
 *
 * Gemini 2.0 features:
 * - 1M token context window
 * - Native function calling
 * - Streaming support
 */

import { EventEmitter } from "events"
import { generateText, tool, stepCountIs, zodSchema, type ModelMessage } from "ai"
import { google } from "@ai-sdk/google"
import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { z } from "zod"
import type { AgentOutputChunk, GeminiMessageData } from "./types"
import { validatePath } from "./path-validator.js"

// Limits for tool operations
const MAX_FILE_READ_SIZE = 50000
const COMMAND_TIMEOUT_MS = 30000
const MAX_COMMAND_OUTPUT = 1024 * 1024

// === Types ===

export interface GeminiAgentOptions {
  workingDir?: string
  /** Model to use (default: gemini-2.0-flash) */
  model?: string
  /** System prompt for the agent */
  systemPrompt?: string
  /** Existing conversation state for resuming a session */
  messages?: GeminiMessageData[]
}

export interface GeminiEvents {
  output: (chunk: AgentOutputChunk) => void
  complete: (data: { tokensUsed: { input: number; output: number } }) => void
  error: (error: string) => void
  session_id: (sessionId: string) => void
}

// Available Gemini models
export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast multimodal", contextLimit: 1048576 },
  { id: "gemini-2.0-pro", name: "Gemini 2.0 Pro", description: "Advanced reasoning", contextLimit: 1048576 },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Balanced performance", contextLimit: 2097152 },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Speed optimized", contextLimit: 1048576 },
] as const

const DEFAULT_MODEL = "gemini-2.0-flash"

// Rate limit retry settings
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY_MS = 2000
const MAX_RETRY_DELAY_MS = 60000

// Context window management
const CONTEXT_PRUNE_THRESHOLD = 0.90
const MIN_MESSAGES_TO_KEEP = 4
const MAX_MESSAGE_HISTORY = 100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as { status?: number; statusCode?: number; message?: string }
    if (e.status === 429 || e.statusCode === 429) return true
    if (e.message?.includes("429") || e.message?.toLowerCase().includes("rate limit")) return true
  }
  return false
}

const DEFAULT_SYSTEM_PROMPT = `You are an expert software engineer assistant with access to tools for reading files, writing files, and executing shell commands.

When given a task:
1. Analyze the requirements carefully
2. Use the available tools to explore and modify the codebase
3. Provide clear explanations of your actions
4. Follow best practices and coding standards

Available tools:
- read_file: Read contents of a file
- write_file: Write content to a file
- exec_command: Execute a shell command

Be concise but thorough. Focus on practical, working solutions.`

// === Gemini Agent ===

export class GeminiAgent extends EventEmitter {
  private workingDir: string
  private model: string
  private systemPrompt: string
  private aborted = false
  private totalTokens = { input: 0, output: 0 }
  private sessionId: string
  private messages: ModelMessage[] = []

  constructor(options: GeminiAgentOptions) {
    super()
    this.workingDir = options.workingDir ?? process.cwd()
    this.model = options.model ?? DEFAULT_MODEL
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    this.sessionId = this.generateSessionId()

    // Restore messages from session if provided
    if (options.messages && options.messages.length > 0) {
      this.messages = options.messages.map(m => this.deserializeMessage(m))
    }
  }

  private generateSessionId(): string {
    return `gemini-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  private emitOutput(
    type: AgentOutputChunk["type"],
    content: string,
    metadata?: Record<string, string | number | boolean | null>
  ): void {
    const chunk: AgentOutputChunk = {
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    }
    this.emit("output", chunk)
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private getContextLimit(): number {
    const modelInfo = GEMINI_MODELS.find(m => m.id === this.model)
    return modelInfo?.contextLimit ?? 1048576
  }

  private pruneMessages(): void {
    const contextLimit = this.getContextLimit()
    const currentTokens = this.messages.reduce((sum, msg) => {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
      return sum + this.estimateTokens(content)
    }, 0)

    const needsTokenPruning = currentTokens > contextLimit * CONTEXT_PRUNE_THRESHOLD
    const needsCountPruning = this.messages.length > MAX_MESSAGE_HISTORY

    if (!needsTokenPruning && !needsCountPruning) {
      return
    }

    const tokenBasedKeep = Math.floor(this.messages.length * 0.4)
    const countBasedKeep = MAX_MESSAGE_HISTORY
    const messagesToKeep = Math.max(MIN_MESSAGES_TO_KEEP, Math.min(tokenBasedKeep, countBasedKeep))

    this.messages = this.messages.slice(-messagesToKeep)
    this.emitOutput("system", `Pruned messages to ${messagesToKeep} to fit context window`)
  }

  /**
   * Serialize ModelMessage to GeminiMessageData for storage
   */
  private serializeMessage(msg: ModelMessage): GeminiMessageData {
    return {
      role: msg.role as GeminiMessageData["role"],
      content: msg.content as GeminiMessageData["content"],
    }
  }

  /**
   * Deserialize GeminiMessageData back to ModelMessage
   */
  private deserializeMessage(msg: GeminiMessageData): ModelMessage {
    return {
      role: msg.role,
      content: msg.content,
    } as ModelMessage
  }

  /**
   * Get messages for session persistence
   */
  getMessages(): GeminiMessageData[] {
    return this.messages.map(m => this.serializeMessage(m))
  }

  /**
   * Get token usage
   */
  getTokenUsage(): { input: number; output: number } {
    return { ...this.totalTokens }
  }

  /**
   * Create tool definitions for Vercel AI SDK
   */
  private createTools() {
    const agent = this

    return {
      read_file: tool({
        description: "Read the contents of a file at the given path",
        inputSchema: zodSchema(z.object({
          path: z.string().describe("The file path to read (relative to working directory or absolute)"),
        })),
        execute: async ({ path }) => {
          agent.emitOutput("tool_use", `Reading file: ${path}`, { tool: "read_file", path })

          try {
            // validatePath throws on invalid paths
            const resolved = validatePath(path, agent.workingDir)

            if (!existsSync(resolved)) {
              const result = `Error: File not found: ${path}`
              agent.emitOutput("tool_result", result, { tool: "read_file", success: false })
              return result
            }
            const content = readFileSync(resolved, "utf-8")
            const truncated = content.length > MAX_FILE_READ_SIZE
              ? content.slice(0, MAX_FILE_READ_SIZE) + "\n... [truncated]"
              : content
            agent.emitOutput("tool_result", `File contents (${content.length} chars):\n${truncated}`, { tool: "read_file", success: true })
            return truncated
          } catch (err) {
            const result = `Error: ${err instanceof Error ? err.message : String(err)}`
            agent.emitOutput("tool_result", result, { tool: "read_file", success: false })
            return result
          }
        },
      }),

      write_file: tool({
        description: "Write content to a file at the given path",
        inputSchema: zodSchema(z.object({
          path: z.string().describe("The file path to write to"),
          content: z.string().describe("The content to write to the file"),
        })),
        execute: async ({ path, content }) => {
          agent.emitOutput("tool_use", `Writing file: ${path}`, { tool: "write_file", path })

          try {
            // validatePath throws on invalid paths
            const resolved = validatePath(path, agent.workingDir)
            writeFileSync(resolved, content, "utf-8")
            const result = `Successfully wrote ${content.length} characters to ${path}`
            agent.emitOutput("tool_result", result, { tool: "write_file", success: true })
            return result
          } catch (err) {
            const result = `Error: ${err instanceof Error ? err.message : String(err)}`
            agent.emitOutput("tool_result", result, { tool: "write_file", success: false })
            return result
          }
        },
      }),

      exec_command: tool({
        description: "Execute a shell command and return its output",
        inputSchema: zodSchema(z.object({
          command: z.string().describe("The shell command to execute"),
        })),
        execute: async ({ command }) => {
          agent.emitOutput("tool_use", `Executing: ${command}`, { tool: "exec_command", command })

          // Safety: block dangerous commands
          const dangerous = ["rm -rf /", "rm -rf ~", "mkfs", "dd if="]
          if (dangerous.some(d => command.includes(d))) {
            const result = "Error: Command rejected for safety reasons"
            agent.emitOutput("tool_result", result, { tool: "exec_command", success: false })
            return result
          }

          try {
            const output = execSync(command, {
              cwd: agent.workingDir,
              encoding: "utf-8",
              timeout: COMMAND_TIMEOUT_MS,
              maxBuffer: MAX_COMMAND_OUTPUT,
            })
            const truncated = output.length > MAX_FILE_READ_SIZE
              ? output.slice(0, MAX_FILE_READ_SIZE) + "\n... [truncated]"
              : output
            agent.emitOutput("tool_result", truncated || "(no output)", { tool: "exec_command", success: true })
            return truncated || "(no output)"
          } catch (err) {
            const error = err as { stderr?: string; message?: string }
            const result = `Command failed: ${error.stderr || error.message || String(err)}`
            agent.emitOutput("tool_result", result, { tool: "exec_command", success: false })
            return result
          }
        },
      }),
    }
  }

  /**
   * Main execution loop
   */
  async run(prompt: string): Promise<void> {
    this.emit("session_id", this.sessionId)

    // Add user message
    this.messages.push({ role: "user", content: prompt })

    await this.executeLoop()
  }

  /**
   * Resume with a new message
   */
  async resume(message: string): Promise<void> {
    this.emitOutput("system", `Resuming session with new message`)
    this.messages.push({ role: "user", content: message })
    await this.executeLoop()
  }

  /**
   * Core execution loop with tool calling
   */
  private async executeLoop(): Promise<void> {
    const tools = this.createTools()
    const model = google(this.model)

    let retryCount = 0
    let retryDelay = INITIAL_RETRY_DELAY_MS

    while (!this.aborted) {
      this.pruneMessages()

      try {
        const result = await generateText({
          model,
          system: this.systemPrompt,
          messages: this.messages,
          tools,
          stopWhen: stepCountIs(20), // Allow up to 20 tool call steps per turn
          onStepFinish: ({ text, usage }) => {
            // Stream text output
            if (text) {
              this.emitOutput("text", text)
            }

            // Track token usage
            if (usage) {
              this.totalTokens.input += usage.inputTokens ?? 0
              this.totalTokens.output += usage.outputTokens ?? 0
            }
          },
        })

        // Add assistant response to messages
        if (result.text) {
          this.messages.push({ role: "assistant", content: result.text })
        }

        // Update final token usage
        if (result.usage) {
          this.totalTokens.input = result.usage.inputTokens ?? 0
          this.totalTokens.output = result.usage.outputTokens ?? 0
        }

        // Execution complete
        this.emit("complete", { tokensUsed: this.totalTokens })
        return

      } catch (err) {
        if (isRateLimitError(err) && retryCount < MAX_RETRIES) {
          retryCount++
          this.emitOutput("system", `Rate limited. Retry ${retryCount}/${MAX_RETRIES} in ${retryDelay / 1000}s...`)
          await sleep(retryDelay)
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
          continue
        }

        const errorMsg = err instanceof Error ? err.message : String(err)
        this.emitOutput("error", `Error: ${errorMsg}`)
        this.emit("error", errorMsg)
        return
      }
    }

    // Aborted
    this.emitOutput("system", "Session aborted")
    this.emit("complete", { tokensUsed: this.totalTokens })
  }

  /**
   * Abort the current execution
   */
  abort(): void {
    this.aborted = true
  }
}

/**
 * Factory function for creating Gemini agents
 */
export function createGeminiAgent(options: GeminiAgentOptions): GeminiAgent {
  return new GeminiAgent(options)
}
