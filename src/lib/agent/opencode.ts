/**
 * OpenCode Agent - Uses the @opencode-ai/sdk for programmatic access
 * Similar to NanocodeAgent but uses OpenCode's SDK instead of direct API calls
 */

import { EventEmitter } from "events"
import { createOpencode } from "@opencode-ai/sdk"
import type { AgentOutputChunk } from "./types"

// === Types ===

export interface OpencodeAgentOptions {
  workingDir?: string
  /** Model in format "provider/model" (e.g., "anthropic/claude-sonnet-4-20250514") */
  model?: string
  /** Port for the OpenCode server (default: random) */
  port?: number
}

export interface OpencodeEvents {
  output: (chunk: AgentOutputChunk) => void
  complete: (data: { tokensUsed: { input: number; output: number } }) => void
  error: (error: string) => void
  session_id: (sessionId: string) => void
}

// === OpenCode Agent ===

export class OpencodeAgent extends EventEmitter {
  private workingDir: string
  private model?: string
  private port?: number
  private aborted = false
  private totalTokens = { input: 0, output: 0 }
  private server: Awaited<ReturnType<typeof createOpencode>>["server"] | null = null
  private client: Awaited<ReturnType<typeof createOpencode>>["client"] | null = null
  private sessionId: string | null = null

  constructor(options: OpencodeAgentOptions) {
    super()
    this.workingDir = options.workingDir ?? process.cwd()
    this.model = options.model
    this.port = options.port
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
   * Parse model string into provider/model parts
   */
  private parseModel(model: string): { providerID: string; modelID: string } | undefined {
    if (!model) return undefined
    const parts = model.split("/")
    if (parts.length !== 2) return undefined
    return { providerID: parts[0], modelID: parts[1] }
  }

  /**
   * Run the agent with a prompt
   */
  async run(prompt: string): Promise<void> {
    this.aborted = false

    try {
      this.emitOutput("system", "Starting OpenCode agent...")

      // Create OpenCode instance (starts embedded server)
      const opencode = await createOpencode({
        hostname: "127.0.0.1",
        port: this.port ?? 0, // 0 = random port
      })

      this.server = opencode.server
      this.client = opencode.client

      this.emitOutput("system", `OpenCode server running at ${opencode.server.url}`)

      // Create a new session
      const sessionResult = await this.client.session.create({
        query: { directory: this.workingDir },
      })

      if (sessionResult.error || !sessionResult.data) {
        const err = sessionResult.error as { message?: string } | undefined
        throw new Error(err?.message ?? "Failed to create session")
      }

      const session = sessionResult.data
      this.sessionId = session.id
      this.emit("session_id", session.id)

      this.emitOutput("system", `Session created: ${session.id}`)

      if (this.aborted) {
        await this.cleanup()
        return
      }

      // Subscribe to events for streaming
      const events = await this.client.global.event()

      // Start processing events in background
      const eventPromise = this.processEvents(events)

      // Send the prompt
      this.emitOutput("system", `Sending prompt...`)

      const promptResult = await this.client.session.prompt({
        path: { id: session.id },
        query: { directory: this.workingDir },
        body: {
          parts: [{ type: "text", text: prompt }],
          model: this.parseModel(this.model ?? ""),
        },
      })

      // Wait for events to finish processing
      await eventPromise

      if (promptResult.error) {
        const err = promptResult.error as { message?: string }
        throw new Error(err.message ?? "Prompt failed")
      }

      // Emit completion
      this.emitOutput("system", "Agent completed")
      this.emit("complete", { tokensUsed: this.totalTokens })
    } catch (err) {
      const errorMsg = (err as Error).message
      this.emitOutput("error", errorMsg)
      this.emit("error", errorMsg)
    } finally {
      await this.cleanup()
    }
  }

  /**
   * Process streaming events
   */
  private async processEvents(
    events: Awaited<ReturnType<Awaited<ReturnType<typeof createOpencode>>["client"]["global"]["event"]>>
  ): Promise<void> {
    try {
      // The SDK returns a stream property for SSE events
      const stream = events.stream
      if (!stream) return

      for await (const rawEvent of stream) {
        if (this.aborted) break

        // Cast event to expected structure
        const event = rawEvent as { type?: string; properties?: Record<string, unknown> }
        const eventType = event.type ?? ""
        const props = event.properties

        switch (eventType) {
          case "message.part.text":
          case "message.text":
          case "assistant.text": {
            const text = (props?.text as string) ?? (props?.content as string)
            if (text) this.emitOutput("text", text)
            break
          }

          case "message.part.tool_call":
          case "tool.call":
          case "assistant.tool": {
            const toolName = (props?.name as string) ?? "unknown"
            this.emitOutput(
              "tool_use",
              JSON.stringify({ name: toolName, input: props?.input ?? props?.args }),
              { toolName, tool: toolName }
            )
            break
          }

          case "tool.result":
          case "message.part.tool_result": {
            const result = (props?.output as string) ?? (props?.result as string) ?? ""
            this.emitOutput("tool_result", result)
            break
          }

          case "message.part.thinking":
          case "thinking":
          case "assistant.thinking": {
            const thinking = (props?.text as string) ?? (props?.content as string)
            if (thinking) this.emitOutput("thinking", thinking)
            break
          }

          case "error": {
            const error = (props?.message as string) ?? (props?.error as string) ?? "Unknown error"
            this.emitOutput("error", error)
            break
          }

          case "session.complete":
          case "message.complete":
          case "assistant.complete":
            // Session finished
            return

          default:
            // Log unknown events as system messages for debugging
            if (props?.text || props?.content) {
              this.emitOutput("system", String(props.text ?? props.content))
            }
        }
      }
    } catch (err) {
      // Stream may close on completion, not an error
      if (!this.aborted) {
        console.log("[opencode-agent] Event stream ended:", (err as Error).message)
      }
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.server) {
      try {
        this.server.close()
      } catch {
        // Ignore cleanup errors
      }
      this.server = null
    }
    this.client = null
  }

  /**
   * Abort the agent
   */
  abort(): void {
    this.aborted = true
    this.emitOutput("system", "Agent aborted by user")
    this.cleanup()
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
  getSessionId(): string | null {
    return this.sessionId
  }
}

// === Factory function ===

export function createOpencodeAgent(options: OpencodeAgentOptions): OpencodeAgent {
  return new OpencodeAgent(options)
}
