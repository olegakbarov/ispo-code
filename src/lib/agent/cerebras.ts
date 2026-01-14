/**
 * Cerebras GLM Agent - Uses Cerebras Cloud SDK with tool support
 *
 * GLM 4.7 features:
 * - 131k context window
 * - 40k max completion tokens
 * - Tool calling support
 * - OpenAI-compatible API
 */

import { EventEmitter } from "events"
import Cerebras from "@cerebras/cerebras_cloud_sdk"
import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"
import type { AgentOutputChunk, CerebrasMessageData } from "./types"
import { SecurityConfig } from "./security-config.js"

// === Types ===

export interface CerebrasAgentOptions {
  workingDir?: string
  /** Model to use (default: zai-glm-4.7) */
  model?: string
  /** System prompt for the agent */
  systemPrompt?: string
  /** Existing conversation state for resuming a session */
  messages?: CerebrasMessageData[]
}

export interface CerebrasEvents {
  output: (chunk: AgentOutputChunk) => void
  complete: (data: { tokensUsed: { input: number; output: number } }) => void
  error: (error: string) => void
  session_id: (sessionId: string) => void
}

// Available Cerebras models
export const CEREBRAS_MODELS = [
  { id: "zai-glm-4.7", name: "GLM 4.7 (357B)", description: "Advanced reasoning with tool use", contextLimit: 131072 },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", description: "Complex reasoning", contextLimit: 131072 },
  { id: "qwen-3-32b", name: "Qwen 3 32B", description: "General-purpose", contextLimit: 32768 },
  { id: "llama3.1-8b", name: "Llama 3.1 8B", description: "Speed-critical", contextLimit: 131072 },
] as const

const DEFAULT_MODEL = "zai-glm-4.7"

// Rate limit retry settings
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY_MS = 2000 // Start with 2 seconds
const MAX_RETRY_DELAY_MS = 60000 // Cap at 60 seconds

// Context window management
const CONTEXT_WARNING_THRESHOLD = 0.85 // Warn at 85% capacity
const CONTEXT_PRUNE_THRESHOLD = 0.90 // Prune at 90% capacity
const MIN_MESSAGES_TO_KEEP = 4 // Keep at least system + 3 recent messages

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if an error is a rate limit error (429)
 */
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

// Tool definitions for GLM
const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the contents of a file at the given path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path to read (relative to working directory or absolute)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Write content to a file at the given path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path to write to (relative to working directory or absolute)",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "exec_command",
      description: "Execute a shell command and return its output",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
]

type Message = CerebrasMessageData

// === Cerebras Agent ===

export class CerebrasAgent extends EventEmitter {
  private workingDir: string
  private model: string
  private systemPrompt: string
  private aborted = false
  private totalTokens = { input: 0, output: 0 }
  private sessionId: string
  private messages: Message[] = []
  private client: Cerebras | null = null

  constructor(options: CerebrasAgentOptions) {
    super()
    this.workingDir = options.workingDir ?? process.cwd()
    this.model = options.model ?? DEFAULT_MODEL
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    this.sessionId = this.generateSessionId()
    this.messages = options.messages ? options.messages.map((m) => ({ ...m })) : []
  }

  private generateSessionId(): string {
    return `cerebras-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Emit an output chunk
   */
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

  /**
   * Resolve a file path relative to working directory
   */
  private resolvePath(filePath: string): string {
    if (filePath.startsWith("/")) {
      return filePath
    }
    return resolve(this.workingDir, filePath)
  }

  /**
   * Estimate token count for a message (rough approximation)
   * Uses ~4 chars per token for English text
   */
  private estimateTokens(message: Message): number {
    if (!message.content) return 0
    const text = typeof message.content === "string" ? message.content : ""
    return Math.ceil(text.length / 4)
  }

  /**
   * Estimate total tokens for all messages
   */
  private estimateTotalTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateTokens(msg), 0)
  }

  /**
   * Get the context limit for the current model
   */
  private getContextLimit(): number {
    const modelInfo = CEREBRAS_MODELS.find(m => m.id === this.model)
    return modelInfo?.contextLimit ?? 131072
  }

  /**
   * Prune old messages to fit within context window
   * Keeps system prompt and most recent messages
   * Also enforces maximum message history limit for memory safety
   */
  private pruneMessages(): void {
    const contextLimit = this.getContextLimit()
    const currentTokens = this.estimateTotalTokens(this.messages)

    // Check if we need to prune based on token count OR message count
    const needsTokenPruning = currentTokens > contextLimit * CONTEXT_PRUNE_THRESHOLD
    const needsCountPruning = this.messages.length > SecurityConfig.MAX_MESSAGE_HISTORY

    if (!needsTokenPruning && !needsCountPruning) {
      return // No pruning needed
    }

    // Find system prompt index
    const systemIndex = this.messages.findIndex(m => m.role === "system")
    const systemMsg = systemIndex >= 0 ? this.messages[systemIndex] : null

    // Calculate how many messages to keep
    // Use stricter limit between token-based and count-based pruning
    const tokenBasedKeep = Math.floor(this.messages.length * 0.4)
    const countBasedKeep = SecurityConfig.MAX_MESSAGE_HISTORY - (systemMsg ? 1 : 0)
    const messagesToKeep = Math.max(
      MIN_MESSAGES_TO_KEEP,
      Math.min(tokenBasedKeep, countBasedKeep)
    )

    const recentMessages = this.messages.slice(-messagesToKeep)

    // Rebuild message array
    this.messages = []
    if (systemMsg) {
      this.messages.push(systemMsg)
    }
    this.messages.push(...recentMessages)

    const newTokens = this.estimateTotalTokens(this.messages)
    const reason = needsCountPruning ? "message limit" : "token limit"
    this.emitOutput("system", `Pruned messages (${reason}): ${currentTokens} → ${newTokens} tokens, ${messagesToKeep} messages`)
  }

  /**
   * Validate message history before resume
   */
  private validateMessages(): { valid: boolean; error?: string } {
    if (!this.messages || this.messages.length === 0) {
      return { valid: false, error: "No message history to resume from" }
    }

    // Check if we have at least a system prompt
    const hasSystem = this.messages.some(m => m.role === "system")
    if (!hasSystem) {
      return { valid: false, error: "Missing system prompt in message history" }
    }

    return { valid: true }
  }

  /**
   * Execute a tool call
   */
  private executeTool(name: string, args: Record<string, unknown>): string {
    try {
      switch (name) {
        case "read_file": {
          const path = this.resolvePath(args.path as string)
          if (!existsSync(path)) {
            return `Error: File not found: ${path}`
          }
          const content = readFileSync(path, "utf-8")
          return content.length > 50000
            ? content.slice(0, 50000) + "\n... (truncated)"
            : content
        }

        case "write_file": {
          const path = this.resolvePath(args.path as string)
          const content = args.content as string
          writeFileSync(path, content, "utf-8")
          return `Successfully wrote ${content.length} bytes to ${path}`
        }

        case "exec_command": {
          const command = args.command as string
          // Safety: don't allow dangerous commands
          const dangerous = ["rm -rf /", "rm -rf ~", "mkfs", "dd if="]
          if (dangerous.some(d => command.includes(d))) {
            return "Error: Command rejected for safety reasons"
          }
          try {
            const output = execSync(command, {
              cwd: this.workingDir,
              timeout: 30000,
              maxBuffer: 1024 * 1024,
              encoding: "utf-8",
            })
            return output.length > 50000
              ? output.slice(0, 50000) + "\n... (truncated)"
              : output || "(no output)"
          } catch (err) {
            const execErr = err as { stderr?: string; message?: string }
            return `Error: ${execErr.stderr || execErr.message}`
          }
        }

        default:
          return `Error: Unknown tool: ${name}`
      }
    } catch (err) {
      return `Error executing tool: ${(err as Error).message}`
    }
  }

  /**
   * Run the agent with a prompt
   */
  async run(prompt: string): Promise<void> {
    this.aborted = false

    const apiKey = process.env.CEREBRAS_API_KEY
    if (!apiKey) {
      const error = "CEREBRAS_API_KEY environment variable is required"
      this.emitOutput("error", error)
      this.emit("error", error)
      return
    }

    try {
      this.emitOutput("system", `Starting Cerebras GLM agent (${this.model})...`)
      this.emit("session_id", this.sessionId)

      this.client = new Cerebras({ apiKey })

      // Build messages array
      if (this.messages.length === 0) {
        this.messages.push({ role: "system", content: this.systemPrompt })
      }
      this.messages.push({ role: "user", content: prompt })

      // Check context window and prune if needed
      const contextLimit = this.getContextLimit()
      const currentTokens = this.estimateTotalTokens(this.messages)
      const utilization = currentTokens / contextLimit

      if (utilization > CONTEXT_WARNING_THRESHOLD) {
        this.emitOutput("system", `Context window at ${Math.round(utilization * 100)}% capacity (${currentTokens}/${contextLimit} tokens)`)
      }

      if (utilization > CONTEXT_PRUNE_THRESHOLD) {
        this.emitOutput("system", "Approaching context limit, pruning old messages...")
        this.pruneMessages()
      }

      // Agent loop - continue until no more tool calls
      let iterationCount = 0
      const MAX_ITERATIONS = 20

      while (!this.aborted && iterationCount < MAX_ITERATIONS) {
        iterationCount++

        this.emitOutput("system", `Calling GLM (iteration ${iterationCount})...`)

        // Create chat completion with tools (with retry for rate limits)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: any
        let lastError: unknown = null

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            response = await this.client.chat.completions.create({
              model: this.model,
              messages: this.messages as Parameters<typeof this.client.chat.completions.create>[0]["messages"],
              tools: TOOLS,
              tool_choice: "auto",
              max_completion_tokens: 8192,
              temperature: 0.6, // Recommended for instruction following
            })
            break // Success, exit retry loop
          } catch (err) {
            lastError = err
            if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
              // Calculate exponential backoff delay
              const delay = Math.min(
                INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
                MAX_RETRY_DELAY_MS
              )
              this.emitOutput(
                "system",
                `Rate limited (429). Waiting ${Math.round(delay / 1000)}s before retry ${attempt + 2}/${MAX_RETRIES}...`
              )
              await sleep(delay)
              continue
            }
            throw err // Non-rate-limit error or max retries reached
          }
        }

        if (!response) {
          throw lastError ?? new Error("Failed to get response after retries")
        }

        // Track usage
        const usage = response.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined
        if (usage) {
          this.totalTokens.input += usage.prompt_tokens ?? 0
          this.totalTokens.output += usage.completion_tokens ?? 0
        }

        const choices = response.choices as Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason: string }>
        const choice = choices[0]
        if (!choice) {
          throw new Error("No response from GLM")
        }

        const message = choice.message

        // Add assistant message to history
        this.messages.push({
          role: "assistant",
          content: message.content,
          tool_calls: message.tool_calls?.map(tc => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        })

        // Emit text content if any
        if (message.content) {
          this.emitOutput("text", message.content)
        }

        // Check for tool calls
        if (!message.tool_calls || message.tool_calls.length === 0) {
          // No more tool calls - we're done
          break
        }

        // Execute tool calls
        for (const toolCall of message.tool_calls) {
          if (this.aborted) break

          const toolName = toolCall.function.name
          let toolArgs: Record<string, unknown>

          try {
            toolArgs = JSON.parse(toolCall.function.arguments)
          } catch {
            toolArgs = {}
          }

          this.emitOutput("tool_use", JSON.stringify({
            name: toolName,
            input: toolArgs,
          }), { tool: toolName, toolName })

          // Execute the tool
          const result = this.executeTool(toolName, toolArgs)

          this.emitOutput("tool_result", result)

          // Add tool result to messages
          this.messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          })
        }

        // Check finish reason
        if (choice.finish_reason === "stop") {
          break
        }
      }

      if (iterationCount >= MAX_ITERATIONS) {
        this.emitOutput("system", "Reached maximum iterations limit")
      }

      // Emit completion
      this.emitOutput("system", "Cerebras GLM agent completed")
      this.emit("complete", { tokensUsed: this.totalTokens })
    } catch (err) {
      const errorMsg = (err as Error).message
      this.emitOutput("error", errorMsg)
      this.emit("error", errorMsg)
    }
  }

  /**
   * Continue conversation with a follow-up message
   */
  async continue(message: string): Promise<void> {
    await this.run(message)
  }

  /**
   * Resume a session with a new message
   * Validates message history and handles context window overflow
   */
  async resume(message: string): Promise<void> {
    // Validate message history
    const validation = this.validateMessages()
    if (!validation.valid) {
      const error = validation.error ?? "Cannot resume: invalid message history"
      this.emitOutput("error", error)
      this.emit("error", error)
      return
    }

    // Check context window and prune if needed
    const contextLimit = this.getContextLimit()
    const currentTokens = this.estimateTotalTokens(this.messages)
    const utilization = currentTokens / contextLimit

    if (utilization > CONTEXT_WARNING_THRESHOLD) {
      this.emitOutput("system", `Context window at ${Math.round(utilization * 100)}% capacity (${currentTokens}/${contextLimit} tokens)`)
    }

    if (utilization > CONTEXT_PRUNE_THRESHOLD) {
      this.emitOutput("system", "Approaching context limit, pruning old messages...")
      this.pruneMessages()
    }

    // Continue with the new message
    await this.continue(message)
  }

  /**
   * Get current conversation state (for persistence/resume)
   */
  getMessages(): CerebrasMessageData[] {
    return this.messages.map((m) => ({ ...m }))
  }

  /**
   * Abort the agent
   */
  abort(): void {
    this.aborted = true
    this.emitOutput("system", "Agent aborted by user")
  }

  /**
   * Get token usage
   */
  getTokenUsage(): { input: number; output: number } {
    return { ...this.totalTokens }
  }

  /**
   * Get session ID for resume support
   */
  getSessionId(): string {
    return this.sessionId
  }

  /**
   * Get context window usage info
   */
  getContextUsage(): { used: number; limit: number; percent: number } {
    const limit = this.getContextLimit()
    const used = this.estimateTotalTokens(this.messages)
    return {
      used,
      limit,
      percent: Math.round((used / limit) * 100),
    }
  }
}

// === Factory function ===

export function createCerebrasAgent(options: CerebrasAgentOptions): CerebrasAgent {
  return new CerebrasAgent(options)
}