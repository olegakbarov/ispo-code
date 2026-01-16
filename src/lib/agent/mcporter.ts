/**
 * MCPorter Agent - MCP-powered QA Agent
 *
 * Uses MCPorter runtime to discover and invoke MCP tools dynamically.
 * The agent uses Gemini for LLM reasoning and generates tool calls
 * that are executed against configured MCP servers.
 *
 * Features:
 * - Dynamic tool discovery from MCP servers
 * - QA-focused system prompt
 * - Tool caching with TTL
 * - Output sanitization via DOMPurify
 */

import { EventEmitter } from "events"
import { generateText, tool, stepCountIs, zodSchema, type ModelMessage } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"
import DOMPurify from "isomorphic-dompurify"
import type { AgentOutputChunk, MCPorterMessageData } from "./types"
import { getDefaultMCPorterModelId, isValidMCPorterModel } from "./mcporter-config"

// MCPorter imports
import { createRuntime, type Runtime, type ServerToolInfo } from "mcporter"

// Validation imports
import {
  loadAndValidateConfigs,
  getConfigPaths,
  createConnectionPool,
  acquireConnection,
  releaseConnection,
  updateActivity,
  closeIdleConnections,
  type ConnectionPoolState,
  type ValidatedServer,
  IDLE_CONNECTION_TIMEOUT_MS,
} from "./mcp-server-validator"

// === Constants ===

const TOOL_CACHE_TTL_MS = 60_000 // 60 seconds
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 10000
const MAX_TOOL_STEPS = 20
const CONTEXT_PRUNE_THRESHOLD = 0.90
const MIN_MESSAGES_TO_KEEP = 4
const MAX_MESSAGE_HISTORY = 100

// Rate limiting
const MAX_REQUESTS_PER_MINUTE = 10

// === Types ===

export interface MCPorterAgentOptions {
  workingDir?: string
  /** Worktree path for isolation (if enabled) */
  worktreePath?: string
  /** Model to use for reasoning (default: gemini-2.0-flash, or DEFAULT_LLM env override) */
  model?: string
  /** System prompt for the agent */
  systemPrompt?: string
  /** Existing conversation state for resuming a session */
  messages?: MCPorterMessageData[]
}

export interface MCPorterEvents {
  output: (chunk: AgentOutputChunk) => void
  complete: (data: { tokensUsed: { input: number; output: number } }) => void
  error: (error: string) => void
  session_id: (sessionId: string) => void
}

interface CachedTools {
  tools: ServerToolInfo[]
  server: string
  timestamp: number
}

// === Helper Functions ===

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

/**
 * Sanitize output to prevent XSS
 */
function sanitizeOutput(content: string): string {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/**
 * Parse and extract error message from MCP tool response
 */
function extractErrorMessage(response: unknown, toolName: string): string {
  if (typeof response === "string") {
    return `Tool ${toolName} returned an error: ${sanitizeOutput(response)}`
  }

  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>
    // Try common error field names
    const errorMsg = obj.error ?? obj.errorMessage ?? obj.message ?? obj.err
    if (typeof errorMsg === "string") {
      return `Tool ${toolName} returned an error: ${sanitizeOutput(errorMsg)}`
    }
  }

  // Fallback: stringify the whole response
  try {
    const str = JSON.stringify(response)
    return `Tool ${toolName} returned an error: ${sanitizeOutput(str)}`
  } catch {
    return `Tool ${toolName} returned an error`
  }
}

// === QA-Focused System Prompt ===

const DEFAULT_SYSTEM_PROMPT = `You are an expert QA engineer assistant with access to MCP (Model Context Protocol) tools for testing, validation, and verification tasks.

Your capabilities include:
- Running tests and test suites
- Validating data and configurations
- Verifying system behavior and outputs
- Checking code quality and standards
- Performing integration and end-to-end tests

When given a task:
1. Understand the testing or validation requirements
2. Use the available MCP tools to perform the requested operations
3. Report results clearly with pass/fail status
4. Provide actionable feedback on any failures

Be thorough but focused. Report findings in a structured, actionable format.
When tests fail, explain what went wrong and suggest potential fixes.`

// === MCPorter Agent Implementation ===

export class MCPorterAgent extends EventEmitter {
  /** Working directory for agent operations (reserved for future MCP tool context) */
  private _workingDir: string
  private worktreePath?: string
  private model: string
  private systemPrompt: string
  private aborted = false
  private totalTokens = { input: 0, output: 0 }
  private sessionId: string
  private messages: ModelMessage[] = []
  private runtime: Runtime | null = null
  private toolCache: Map<string, CachedTools> = new Map()
  private requestCount = 0
  private requestWindowStart = Date.now()

  // Connection management
  private connectionPool: ConnectionPoolState = createConnectionPool()
  private validatedServers: ValidatedServer[] = []
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null

  constructor(options: MCPorterAgentOptions) {
    super()
    this._workingDir = options.workingDir ?? process.cwd()
    this.worktreePath = options.worktreePath
    const requestedModel = options.model?.trim()
    if (requestedModel && isValidMCPorterModel(requestedModel)) {
      this.model = requestedModel
    } else {
      const configuredDefaultModel = getDefaultMCPorterModelId()
      if (requestedModel) {
        console.error(
          `[MCPorterAgent] Invalid model "${requestedModel}", falling back to ${configuredDefaultModel}`
        )
      }
      this.model = configuredDefaultModel
    }
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    this.sessionId = this.generateSessionId()

    // Restore messages from session if provided
    if (options.messages && options.messages.length > 0) {
      this.messages = options.messages.map(m => this.deserializeMessage(m))
    }
  }

  private generateSessionId(): string {
    return `mcporter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  private emitOutput(
    type: AgentOutputChunk["type"],
    content: string,
    metadata?: Record<string, string | number | boolean | null>
  ): void {
    const chunk: AgentOutputChunk = {
      type,
      content: sanitizeOutput(content),
      timestamp: new Date().toISOString(),
      metadata,
    }
    this.emit("output", chunk)
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private getContextLimit(): number {
    // Gemini 2.0 Flash default
    const limits: Record<string, number> = {
      "gemini-2.0-flash": 1_048_576,
      "gemini-2.0-pro": 1_048_576,
      "gemini-1.5-pro": 2_097_152,
      "gemini-1.5-flash": 1_048_576,
    }
    return limits[this.model] ?? 1_048_576
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
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now()
    // Reset window if minute has passed
    if (now - this.requestWindowStart > 60_000) {
      this.requestCount = 0
      this.requestWindowStart = now
    }
    return this.requestCount < MAX_REQUESTS_PER_MINUTE
  }

  private incrementRequestCount(): void {
    this.requestCount++
  }

  /**
   * Validate MCP server configurations before connecting
   */
  private async validateServers(): Promise<boolean> {
    this.emitOutput("system", "Validating MCP server configurations...")

    const result = await loadAndValidateConfigs({
      skipOAuth: true, // Skip OAuth servers by default
      skipDnsCheck: false, // Perform DNS validation
    })

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        this.emitOutput("error", `Server "${error.name}": ${error.errors.join(", ")}`)
      }
    }

    if (result.skipped.length > 0) {
      for (const skipped of result.skipped) {
        this.emitOutput("system", `Skipped "${skipped.name}": ${skipped.reason}`)
      }
    }

    this.validatedServers = result.servers

    if (result.servers.length === 0) {
      this.emitOutput(
        "error",
        "No valid MCP servers found. Please check your MCPorter configuration."
      )
      return false
    }

    this.emitOutput(
      "system",
      `Validated ${result.servers.length} server(s) from ${result.configPath ?? "configuration"}`
    )

    return true
  }

  /**
   * Start idle connection cleanup interval
   */
  private startIdleConnectionCleanup(): void {
    if (this.idleCheckInterval) {
      return
    }

    // Check for idle connections every minute
    this.idleCheckInterval = setInterval(() => {
      const closed = closeIdleConnections(this.connectionPool)
      if (closed > 0) {
        this.emitOutput("system", `Closed ${closed} idle connection(s)`)
      }
    }, IDLE_CONNECTION_TIMEOUT_MS / 5) // Check 5 times per timeout period
  }

  /**
   * Stop idle connection cleanup interval
   */
  private stopIdleConnectionCleanup(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval)
      this.idleCheckInterval = null
    }
  }

  /**
   * Initialize MCPorter runtime with error handling
   */
  private async initRuntime(): Promise<boolean> {
    if (this.runtime) {
      return true
    }

    // Validate servers first
    const serversValid = await this.validateServers()
    if (!serversValid) {
      return false
    }

    let retries = 0
    let delay = INITIAL_RETRY_DELAY_MS

    while (retries < MAX_RETRIES) {
      try {
        this.runtime = await createRuntime({
          clientInfo: { name: "ispo-code-qa-agent", version: "1.0.0" },
          logger: {
            debug: (msg: string) => console.debug(`[MCPorter] ${msg}`),
            info: (msg: string) => console.log(`[MCPorter] ${msg}`),
            warn: (msg: string) => console.warn(`[MCPorter] ${msg}`),
            error: (msg: string) => console.error(`[MCPorter] ${msg}`),
          },
        })

        // Start idle connection cleanup
        this.startIdleConnectionCleanup()

        return true
      } catch (err) {
        retries++
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[MCPorterAgent] Runtime init failed (attempt ${retries}/${MAX_RETRIES}): ${errorMsg}`)

        if (retries >= MAX_RETRIES) {
          this.emitOutput(
            "error",
            "Failed to connect to MCP server. Please check your configuration and network connection."
          )
          return false
        }

        await sleep(delay)
        delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
      }
    }

    return false
  }

  /**
   * Check if a server was validated and is allowed
   */
  private isServerValidated(serverName: string): boolean {
    return this.validatedServers.some(s => s.name === serverName)
  }

  /**
   * Discover tools from all configured MCP servers
   */
  private async discoverTools(): Promise<Map<string, { server: string; tool: ServerToolInfo }>> {
    const allTools = new Map<string, { server: string; tool: ServerToolInfo }>()

    if (!this.runtime) {
      return allTools
    }

    const servers = this.runtime.listServers()
    if (servers.length === 0) {
      this.emitOutput(
        "system",
        "No MCP tools found. Please check your MCPorter configuration."
      )
      return allTools
    }

    for (const server of servers) {
      // Skip servers that weren't validated (security check)
      if (!this.isServerValidated(server)) {
        console.warn(`[MCPorterAgent] Skipping unvalidated server: ${server}`)
        continue
      }

      // Check connection pool before attempting to connect
      if (!acquireConnection(this.connectionPool, server)) {
        this.emitOutput(
          "system",
          `Connection limit reached for server "${server}", skipping`
        )
        continue
      }

      try {
        // Check cache first
        const cached = this.toolCache.get(server)
        const now = Date.now()

        let tools: ServerToolInfo[]
        if (cached && (now - cached.timestamp) < TOOL_CACHE_TTL_MS) {
          tools = cached.tools
        } else {
          // Fetch fresh tools with schema
          tools = await this.runtime.listTools(server, {
            includeSchema: true,
            autoAuthorize: false, // Skip OAuth servers
            allowCachedAuth: true,
          })

          // Update cache
          this.toolCache.set(server, { tools, server, timestamp: now })
        }

        // Update activity timestamp for idle tracking
        updateActivity(this.connectionPool, server)

        for (const t of tools) {
          // Use server:tool format to avoid conflicts
          const toolKey = `${server}:${t.name}`
          allTools.set(toolKey, { server, tool: t })
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.warn(`[MCPorterAgent] Failed to list tools from ${server}: ${errorMsg}`)
        // Release connection on error
        releaseConnection(this.connectionPool, server)
        // Continue with other servers
      }
    }

    return allTools
  }

  /**
   * Refresh tool cache for all servers
   */
  refreshToolCache(): void {
    this.toolCache.clear()
  }

  /**
   * Build dynamic tool definitions from discovered MCP tools
   */
  private buildTools(
    discoveredTools: Map<string, { server: string; tool: ServerToolInfo }>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: Record<string, any> = {}
    const agent = this

    for (const [toolKey, { server, tool: mcpTool }] of discoveredTools) {
      // Sanitize tool name for Vercel AI SDK (no colons allowed)
      const safeName = toolKey.replace(/:/g, "__")

      tools[safeName] = tool({
        description: mcpTool.description ?? `MCP tool: ${mcpTool.name} (server: ${server})`,
        inputSchema: zodSchema(z.object({
          args: z.record(z.unknown()).optional().describe("Tool arguments as key-value pairs"),
        })),
        execute: async ({ args }: { args?: Record<string, unknown> }) => {
          agent.emitOutput(
            "tool_use",
            JSON.stringify({ name: mcpTool.name, input: args ?? {} }),
            { tool: mcpTool.name, toolName: mcpTool.name, server }
          )

          try {
            if (!agent.runtime) {
              throw new Error("Runtime not initialized")
            }

            const result = await agent.runtime.callTool(server, mcpTool.name, {
              args: args as Record<string, unknown> | undefined,
              timeoutMs: 30_000,
            })

            // Sanitize and return result
            const resultStr = typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2)

            const sanitized = sanitizeOutput(resultStr)
            agent.emitOutput("tool_result", sanitized, { tool: mcpTool.name, success: true })
            return sanitized
          } catch (err) {
            const errorMsg = extractErrorMessage(err, mcpTool.name)
            agent.emitOutput("tool_result", errorMsg, { tool: mcpTool.name, success: false })
            return errorMsg
          }
        },
      })
    }

    return tools
  }

  /**
   * Serialize ModelMessage to MCPorterMessageData for storage
   */
  private serializeMessage(msg: ModelMessage): MCPorterMessageData {
    return {
      role: msg.role as MCPorterMessageData["role"],
      content: msg.content as MCPorterMessageData["content"],
    }
  }

  /**
   * Deserialize MCPorterMessageData back to ModelMessage
   */
  private deserializeMessage(msg: MCPorterMessageData): ModelMessage {
    return {
      role: msg.role,
      content: msg.content,
    } as ModelMessage
  }

  /**
   * Get messages for session persistence
   */
  getMessages(): MCPorterMessageData[] {
    return this.messages.map(m => this.serializeMessage(m))
  }

  /**
   * Get token usage
   */
  getTokenUsage(): { input: number; output: number } {
    return { ...this.totalTokens }
  }

  /**
   * Main execution entry point
   */
  async run(prompt: string): Promise<void> {
    this.emit("session_id", this.sessionId)

    // Check rate limit
    if (!this.checkRateLimit()) {
      this.emitOutput("error", "Rate limit exceeded. Please wait before sending more requests.")
      this.emit("error", "Rate limit exceeded")
      return
    }
    this.incrementRequestCount()

    // Initialize runtime
    const runtimeReady = await this.initRuntime()
    if (!runtimeReady) {
      this.emit("error", "Failed to initialize MCPorter runtime")
      return
    }

    // Add user message
    this.messages.push({ role: "user", content: prompt } as ModelMessage)

    await this.executeLoop()
  }

  /**
   * Resume with a new message
   */
  async resume(message: string): Promise<void> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      this.emitOutput("error", "Rate limit exceeded. Please wait before sending more requests.")
      this.emit("error", "Rate limit exceeded")
      return
    }
    this.incrementRequestCount()

    // Ensure runtime is initialized
    const runtimeReady = await this.initRuntime()
    if (!runtimeReady) {
      this.emitOutput("error", "Failed to resume session. Starting fresh.")
      // Clear messages and start fresh
      this.messages = []
      this.emit("error", "Failed to resume - runtime initialization failed")
      return
    }

    this.emitOutput("system", "Resuming session with new message")
    this.messages.push({ role: "user", content: message })
    await this.executeLoop()
  }

  /**
   * Core execution loop with dynamic tool discovery
   */
  private async executeLoop(): Promise<void> {
    // Discover tools fresh each turn (per spec)
    const discoveredTools = await this.discoverTools()

    if (discoveredTools.size === 0) {
      this.emitOutput(
        "system",
        "No MCP tools available. The agent can still respond to queries but cannot invoke tools."
      )
    } else {
      this.emitOutput(
        "system",
        `Discovered ${discoveredTools.size} MCP tools from ${this.runtime?.listServers().length ?? 0} servers`
      )
    }

    const tools = this.buildTools(discoveredTools)
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
          tools: Object.keys(tools).length > 0 ? tools : undefined,
          stopWhen: stepCountIs(MAX_TOOL_STEPS),
          onStepFinish: ({ text, usage }) => {
            if (text) {
              this.emitOutput("text", text)
            }

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
        this.emitOutput("error", `Error: ${sanitizeOutput(errorMsg)}`)
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

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    this.aborted = true

    // Stop idle connection cleanup
    this.stopIdleConnectionCleanup()

    if (this.runtime) {
      try {
        await this.runtime.close()
      } catch (err) {
        console.error("[MCPorterAgent] Error closing runtime:", err)
      }
      this.runtime = null
    }

    // Clear connection pool
    this.connectionPool = createConnectionPool()
    this.validatedServers = []

    this.toolCache.clear()
    this.messages = []
  }
}

/**
 * Factory function for creating MCPorter agents
 */
export function createMCPorterAgent(options: MCPorterAgentOptions): MCPorterAgent {
  return new MCPorterAgent(options)
}

/**
 * Check if MCPorter is available (has configuration)
 */
export async function isMCPorterAvailable(): Promise<boolean> {
  try {
    const runtime = await createRuntime({
      clientInfo: { name: "ispo-code-qa-agent", version: "1.0.0" },
    })
    const servers = runtime.listServers()
    await runtime.close()
    return servers.length > 0
  } catch {
    return false
  }
}

/**
 * Synchronous check for MCPorter availability
 * Checks for mcporter.json config file existence
 */
export function checkMCPorterAvailableSync(): boolean {
  const { existsSync, readFileSync } = require("fs")
  const explicitPath = process.env.MCPORTER_CONFIG_PATH?.trim()
  const configPaths = explicitPath
    ? [explicitPath]
    : getConfigPaths()

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8")
        const config = JSON.parse(content)
        // Check if config has any server definitions
        if (config && (config.servers || config.mcpServers || Array.isArray(config))) {
          return true
        }
      } catch {
        // Invalid JSON or structure - continue checking other paths
        continue
      }
    }
  }
  return false
}

// Export MCPORTER_MODELS from model-registry for backward compatibility
export { MCPORTER_MODELS } from "./model-registry"
