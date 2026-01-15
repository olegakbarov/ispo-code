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
   * Process streaming events from OpenCode SDK
   *
   * OpenCode uses these event types:
   * - message.updated: Message info updated (check finish field for completion)
   * - message.part.updated: Part content (text, tool calls, etc.)
   */
  private async processEvents(
    events: Awaited<ReturnType<Awaited<ReturnType<typeof createOpencode>>["client"]["global"]["event"]>>
  ): Promise<void> {
    try {
      const stream = events.stream
      if (!stream) return

      // Track seen text parts to avoid duplicates
      const seenParts = new Set<string>()

      for await (const rawEvent of stream) {
        if (this.aborted) break

        const event = rawEvent as { type?: string; properties?: Record<string, unknown> }
        const eventType = event.type ?? ""
        const props = event.properties

        switch (eventType) {
          // OpenCode SDK: message.updated contains message info with finish status
          case "message.updated": {
            const info = props?.info as { sessionID?: string; finish?: string; role?: string; time?: { completed?: number }; tokens?: { input?: number; output?: number } } | undefined
            // Only process events for our session
            if (info?.sessionID !== this.sessionId) break

            // Track token usage
            if (info.tokens) {
              this.totalTokens.input += info.tokens.input ?? 0
              this.totalTokens.output += info.tokens.output ?? 0
            }

            // Check if message finished (finish field set or time.completed exists)
            if (info.role === "assistant" && (info.finish || info.time?.completed)) {
              return // Session complete
            }
            break
          }

          // OpenCode SDK: message.part.updated contains the actual content
          case "message.part.updated": {
            const part = props as { id?: string; sessionID?: string; type?: string; text?: string; tool?: string; state?: { status?: string; input?: unknown; output?: string } }
            // Only process events for our session
            if (part?.sessionID !== this.sessionId) break

            // Skip already processed parts
            if (part.id && seenParts.has(part.id)) break
            if (part.id) seenParts.add(part.id)

            switch (part.type) {
              case "text":
                if (part.text) this.emitOutput("text", part.text)
                break
              case "reasoning":
                if (part.text) this.emitOutput("thinking", part.text)
                break
              case "tool":
                if (part.tool && part.state) {
                  if (part.state.status === "running" || !part.state.output) {
                    this.emitOutput("tool_use", JSON.stringify({ name: part.tool, input: part.state.input }), { toolName: part.tool, tool: part.tool })
                  }
                  if (part.state.status === "completed" && part.state.output) {
                    this.emitOutput("tool_result", part.state.output)
                  }
                }
                break
              case "step-start":
              case "step-finish":
                // Ignore step markers
                break
            }
            break
          }

          // Legacy event types (for backwards compatibility)
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
            this.emitOutput("tool_use", JSON.stringify({ name: toolName, input: props?.input ?? props?.args }), { toolName, tool: toolName })
            break
          }

          case "tool.result":
          case "message.part.tool_result": {
            const result = (props?.output as string) ?? (props?.result as string) ?? ""
            this.emitOutput("tool_result", result)
            break
          }

          case "error": {
            const error = (props?.message as string) ?? (props?.error as string) ?? "Unknown error"
            this.emitOutput("error", error)
            break
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
