/**
 * CLI Agent Runner - spawns external CLI agents (claude, codex, opencode)
 */

import { EventEmitter } from "events"
import { spawn, execSync, type ChildProcess } from "child_process"
import { existsSync, mkdirSync } from "fs"
import { join } from "path"
import type { AgentOutputChunk, AgentType } from "./types"

export interface CLIRunnerConfig {
  agentType: AgentType
  workingDir: string
  prompt: string
  /** CLI session ID for resuming conversations */
  cliSessionId?: string
  /** Whether this is a resume (follow-up message) */
  isResume?: boolean
  /** Model to use in format "provider/model" (for opencode) */
  model?: string
}

/**
 * Get the path to a CLI tool, checking common locations
 */
function getCLIPath(cli: "claude" | "codex" | "opencode"): string | null {
  const home = process.env.HOME || ""

  const locations: Record<string, string[]> = {
    claude: [
      `${home}/.claude/local/claude`,
      "/usr/local/bin/claude",
      "/opt/homebrew/bin/claude",
    ],
    codex: [
      "/usr/local/bin/codex",
      "/opt/homebrew/bin/codex",
      `${home}/.local/bin/codex`,
    ],
    opencode: [
      `${home}/.opencode/bin/opencode`,
      "/usr/local/bin/opencode",
      "/opt/homebrew/bin/opencode",
      `${home}/.local/bin/opencode`,
      `${home}/go/bin/opencode`,
    ],
  }

  // First try which/command -v via shell
  try {
    const result = execSync(`command -v ${cli} 2>/dev/null || which ${cli} 2>/dev/null`, {
      stdio: "pipe",
      shell: "/bin/bash",
    }).toString().trim()
    if (result && existsSync(result)) {
      return result
    }
  } catch {
    // Ignore
  }

  // Check common locations
  for (const loc of locations[cli] || []) {
    if (existsSync(loc)) {
      return loc
    }
  }

  return null
}

/**
 * Check if a CLI tool is available
 */
export function checkCLIAvailable(cli: "claude" | "codex" | "opencode"): boolean {
  return getCLIPath(cli) !== null
}

/**
 * Get available agent types based on installed CLIs and API keys
 */
export function getAvailableAgentTypes(): AgentType[] {
  const types: AgentType[] = []
  if (checkCLIAvailable("claude")) types.push("claude")
  if (checkCLIAvailable("codex")) types.push("codex")
  if (checkCLIAvailable("opencode")) types.push("opencode")
  // Cerebras GLM agent - requires CEREBRAS_API_KEY
  if (process.env.CEREBRAS_API_KEY?.trim()) {
    types.push("cerebras")
  }
  return types
}

const MAX_PROMPT_BYTES_IN_ARGS = 100_000

type PromptTransport = "args" | "stdin"

interface BuiltCommand {
  command: string
  args: string[]
  promptTransport: PromptTransport
  stdinPrompt?: string
}

/**
 * CLI Agent Runner - runs external CLI agents as child processes
 */
export class CLIAgentRunner extends EventEmitter {
  private process: ChildProcess | null = null
  private aborted = false
  private outputBuffer = ""
  private awaitingApproval = false
  private awaitingInput = false
  /** CLI session ID discovered from output */
  public cliSessionId: string | null = null

  constructor() {
    super()
  }

  /**
   * Send input to the running process
   */
  sendInput(input: string): boolean {
    if (!this.process?.stdin?.writable) {
      return false
    }
    this.process.stdin.write(input + "\n")
    return true
  }

  /**
   * Send approval response (yes/no)
   */
  sendApproval(approved: boolean): boolean {
    return this.sendInput(approved ? "y" : "n")
  }

  /**
   * Run the CLI agent
   */
  async run(config: CLIRunnerConfig): Promise<void> {
    const { agentType, workingDir, isResume } = config

    const { command, args, promptTransport, stdinPrompt } = this.buildCommand(config)

    const action = isResume ? "Resuming" : "Starting"
    this.emitChunk("system", `${action} ${agentType} agent...`)

    return new Promise((resolve, reject) => {
      try {
        this.aborted = false
        this.awaitingApproval = false
        this.awaitingInput = false

        const env: Record<string, string> = { ...(process.env as Record<string, string>), FORCE_COLOR: "0" }

        // Codex CLI writes session state under CODEX_HOME
        if (agentType === "codex" && !env.CODEX_HOME) {
          const codexHome = join(process.cwd(), "data", "codex")
          try {
            mkdirSync(codexHome, { recursive: true })
            env.CODEX_HOME = codexHome
          } catch {
            // Let Codex fall back to defaults
          }
        }

        this.process = spawn(command, args, {
          cwd: workingDir,
          env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        })

        // Handle stdin
        if (this.process.stdin) {
          if (promptTransport === "stdin" && stdinPrompt) {
            this.process.stdin.write(stdinPrompt)
            if (!stdinPrompt.endsWith("\n")) {
              this.process.stdin.write("\n")
            }
            // Most CLIs expect EOF when prompt is passed via stdin.
            this.process.stdin.end()
          } else {
            // Keep stdin open when prompt is passed via args so we can respond
            // to interactive prompts (e.g. approval y/n) if needed.
          }
        }

        // Handle stdout
        if (this.process.stdout) {
          this.process.stdout.on("data", (data: Buffer) => {
            this.handleOutput(data.toString(), agentType)
          })
        }

        // Handle stderr
        if (this.process.stderr) {
          this.process.stderr.on("data", (data: Buffer) => {
            const text = data.toString()
            if (this.isErrorMessage(text)) {
              this.emitChunk("error", text)
            } else {
              this.emitChunk("system", text)
            }
            this.maybeEmitInteractiveState(text)
          })
        }

        // Handle process exit
        this.process.on("close", (code) => {
          this.process = null

          if (this.outputBuffer.trim()) {
            this.emitChunk("text", this.outputBuffer)
            this.outputBuffer = ""
          }

          if (this.aborted) {
            this.emit("cancelled")
            resolve()
            return
          }

          if (code === 0) {
            this.emit("complete", { tokensUsed: { input: 0, output: 0 } })
            resolve()
          } else {
            this.emit("error", `Agent exited with code ${code}`)
            reject(new Error(`Agent exited with code ${code}`))
          }
        })

        this.process.on("error", (err) => {
          this.process = null
          this.emit("error", err.message)
          reject(err)
        })
      } catch (err) {
        const error = err as Error
        this.emit("error", error.message)
        reject(error)
      }
    })
  }

  /**
   * Build CLI command and args
   */
  private buildCommand(config: CLIRunnerConfig): BuiltCommand {
    const { agentType, prompt, cliSessionId, isResume, model } = config

    const cliPath = getCLIPath(agentType as "claude" | "codex" | "opencode")
    if (!cliPath) {
      throw new Error(`CLI '${agentType}' not found`)
    }

    const promptBytes = Buffer.byteLength(prompt, "utf8")
    const promptTransport: PromptTransport =
      promptBytes > MAX_PROMPT_BYTES_IN_ARGS ? "stdin" : "args"

    switch (agentType) {
      case "claude": {
        const args = [
          "-p",
          "--output-format", "stream-json",
          "--verbose",
          "--dangerously-skip-permissions",
        ]

        if (promptTransport === "args") {
          args.splice(1, 0, prompt)
        }

        if (isResume && cliSessionId) {
          args.push("--resume", cliSessionId)
        }

        return {
          command: cliPath,
          args,
          promptTransport,
          stdinPrompt: promptTransport === "stdin" ? prompt : undefined,
        }
      }

      case "codex": {
        if (isResume && cliSessionId) {
          const args = ["resume", cliSessionId, "--json"]
          if (promptTransport === "args") {
            args.push(prompt)
          }
          return {
            command: cliPath,
            args,
            promptTransport,
            stdinPrompt: promptTransport === "stdin" ? prompt : undefined,
          }
        }
        return {
          command: cliPath,
          args: promptTransport === "args" ? ["exec", "--json", prompt] : ["exec", "--json"],
          promptTransport,
          stdinPrompt: promptTransport === "stdin" ? prompt : undefined,
        }
      }

      case "opencode": {
        const args = ["run", "--format", "json"]

        if (model) {
          args.push("--model", model)
        }

        if (isResume && cliSessionId) {
          args.push("--session", cliSessionId)
        }

        if (promptTransport === "args") {
          args.push(prompt)
        }

        return {
          command: cliPath,
          args,
          promptTransport,
          stdinPrompt: promptTransport === "stdin" ? prompt : undefined,
        }
      }

      default:
        throw new Error(`Unknown agent type: ${agentType}`)
    }
  }

  /**
   * Handle output from the CLI
   */
  private handleOutput(data: string, agentType: AgentType) {
    this.outputBuffer += data

    const lines = this.outputBuffer.split("\n")
    this.outputBuffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.trim()) continue
      this.parseLine(line, agentType)
    }
  }

  /**
   * Parse a line of output
   */
  private parseLine(line: string, agentType: AgentType) {
    try {
      const json = JSON.parse(line)
      this.parseJsonOutput(json, agentType)
    } catch {
      this.maybeEmitInteractiveState(line)
      this.emitChunk("text", line)
    }
  }

  /**
   * Parse JSON output from CLI
   */
  private parseJsonOutput(json: Record<string, unknown>, agentType: AgentType) {
    if (agentType === "claude") {
      this.parseClaudeOutput(json)
    } else if (agentType === "codex") {
      this.parseCodexOutput(json)
    } else if (agentType === "opencode") {
      this.parseOpencodeOutput(json)
    }
  }

  /**
   * Parse Claude CLI output
   */
  private parseClaudeOutput(json: Record<string, unknown>) {
    const type = json.type as string

    switch (type) {
      case "stream_event": {
        const event = json.event as Record<string, unknown> | undefined
        if (!event) break
        const eventType = event.type as string
        if (eventType === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined
          if (delta?.type === "text_delta" && delta.text) {
            this.emitChunk("text", String(delta.text))
          } else if (delta?.type === "thinking_delta" && delta.thinking) {
            this.emitChunk("thinking", String(delta.thinking))
          }
        }
        break
      }

      case "system": {
        const subtype = json.subtype as string | undefined
        if (subtype === "init") {
          const sessionId = json.session_id as string | undefined
          if (sessionId && !this.cliSessionId) {
            this.cliSessionId = sessionId
            this.emit("session_id", sessionId)
          }
        }
        break
      }

      case "assistant": {
        // Handle assistant message with content array
        const message = json.message as Record<string, unknown> | undefined
        if (message?.content && Array.isArray(message.content)) {
          for (const block of message.content) {
            const blockObj = block as Record<string, unknown>
            if (blockObj.type === "text" && blockObj.text) {
              this.emitChunk("text", String(blockObj.text))
            } else if (blockObj.type === "thinking" && blockObj.thinking) {
              this.emitChunk("thinking", String(blockObj.thinking))
            } else if (blockObj.type === "tool_use") {
              this.emitChunk("tool_use", JSON.stringify({
                name: blockObj.name,
                input: blockObj.input,
              }), { tool: blockObj.name as string })
            }
          }
        }
        break
      }

      case "result": {
        // Handle final result - session complete
        const sessionId = json.session_id as string | undefined
        if (sessionId && !this.cliSessionId) {
          this.cliSessionId = sessionId
          this.emit("session_id", sessionId)
        }
        break
      }

      case "tool_use":
        this.emitChunk("tool_use", JSON.stringify({
          name: json.name,
          input: json.input,
        }), { tool: json.name as string })
        break

      case "tool_result":
        this.emitChunk("tool_result", String(json.content ?? json.output ?? ""))
        break

      case "error":
        this.emitChunk("error", String(json.message ?? json.error ?? "Unknown error"))
        break
    }
  }

  /**
   * Parse Codex CLI output
   */
  private parseCodexOutput(json: Record<string, unknown>) {
    const type = typeof json.type === "string" ? json.type : undefined

    if (type && (type.includes("approval") || type.includes("permission"))) {
      this.emitWaitingApproval()
    }
    const status = typeof json.status === "string" ? json.status : undefined
    if (status === "waiting_approval" || status === "approval_required") {
      this.emitWaitingApproval()
    }

    if (type === "thread.started") {
      const threadId = json.thread_id as string | undefined
      if (threadId) {
        this.cliSessionId = threadId
        this.emit("session_id", threadId)
      }
      return
    }

    if (type?.includes("error")) {
      const msg = (json.message as string) ?? (json.error as string) ?? "Error"
      this.emitChunk("error", msg)
      return
    }

    if (type === "item.completed" || type === "item.started") {
      const item = json.item as Record<string, unknown> | undefined
      if (item) {
        const itemType = item.type as string | undefined
        const text = item.text as string | undefined

        if (itemType === "agent_message" && text) {
          this.emitChunk("text", text)
        } else if (itemType === "reasoning" && text) {
          this.emitChunk("thinking", text)
        }
      }
    }
  }

  /**
   * Parse OpenCode CLI output
   */
  private parseOpencodeOutput(json: Record<string, unknown>) {
    const sessionID = json.sessionID as string | undefined
    if (sessionID && !this.cliSessionId) {
      this.cliSessionId = sessionID
      this.emit("session_id", sessionID)
    }

    const type = typeof json.type === "string" ? json.type : undefined

    switch (type) {
      case "message":
      case "text":
      case "output":
      case "response": {
        const text = (json.content ?? json.text ?? json.message) as string | undefined
        if (text) this.emitChunk("text", text)
        break
      }

      case "tool_call":
      case "tool_use": {
        this.emitChunk("tool_use", JSON.stringify({
          name: json.name ?? json.tool,
          input: json.input ?? json.args,
        }), { tool: (json.name ?? json.tool) as string })
        break
      }

      case "tool_result":
      case "tool_output": {
        const result = (json.output ?? json.result ?? json.content) as string | undefined
        if (result) this.emitChunk("tool_result", result)
        break
      }

      case "error": {
        const errorMsg = (json.message ?? json.error ?? "Unknown error") as string
        this.emitChunk("error", errorMsg)
        break
      }
    }
  }

  /**
   * Emit an output chunk
   */
  private emitChunk(
    type: AgentOutputChunk["type"],
    content: string,
    metadata?: Record<string, string | number | boolean | null>
  ) {
    const chunk: AgentOutputChunk = {
      type,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    }
    this.emit("output", chunk)
  }

  /**
   * Check if a message looks like an error
   */
  private isErrorMessage(text: string): boolean {
    const lowerText = text.toLowerCase()
    return (
      lowerText.includes("error:") ||
      lowerText.includes("fatal:") ||
      lowerText.includes("exception:")
    )
  }

  private emitWaitingApproval(): void {
    if (this.awaitingApproval) return
    this.awaitingApproval = true
    this.emit("waiting_approval")
  }

  private emitWaitingInput(): void {
    if (this.awaitingInput) return
    this.awaitingInput = true
    this.emit("waiting_input")
  }

  private maybeEmitInteractiveState(text: string): void {
    const lower = text.toLowerCase()

    const looksLikeYesNo =
      /\b\(?y\/n\)?\b/i.test(text) ||
      /\[[yY]\/[nN]\]/.test(text) ||
      /\([yY]\/[nN]\)/.test(text)

    const mentionsApproval =
      lower.includes("approval") ||
      lower.includes("approve") ||
      lower.includes("permission") ||
      lower.includes("allow") ||
      lower.includes("confirm")

    if (looksLikeYesNo && mentionsApproval) {
      this.emitWaitingApproval()
      return
    }

    // Very lightweight "waiting for input" heuristic.
    const mentionsInput =
      lower.includes("enter") ||
      lower.includes("type your") ||
      lower.includes("your response") ||
      lower.includes("input:")

    if (looksLikeYesNo) {
      // If it's a y/n prompt but not clearly about approval, still treat it as approval.
      this.emitWaitingApproval()
      return
    }

    if (mentionsInput) {
      this.emitWaitingInput()
    }
  }

  /**
   * Abort the running agent
   */
  abort(): void {
    if (this.aborted) return

    this.aborted = true

    if (!this.process) return

    const pid = this.process.pid

    try {
      this.process.kill("SIGTERM")
    } catch {
      // Ignore
    }

    // Kill child processes
    if (pid) {
      try {
        execSync(`pkill -TERM -P ${pid} 2>/dev/null || true`, { stdio: "ignore" })
      } catch {
        // Ignore
      }
    }

    this.process = null
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this.process !== null
  }
}
