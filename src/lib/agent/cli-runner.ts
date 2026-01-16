/**
 * CLI Agent Runner - spawns external CLI agents (claude, codex, opencode)
 */

import { EventEmitter } from "events"
import { spawn, execSync, type ChildProcess } from "child_process"
import { existsSync, mkdirSync, accessSync, constants, writeFileSync, rmSync } from "fs"
import { join, dirname } from "path"
import { tmpdir } from "os"
import { match } from 'ts-pattern'
import type { AgentOutputChunk, AgentType, ImageAttachment } from "./types"

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
  /** Image attachments for multimodal input */
  attachments?: ImageAttachment[]
  /** Use Claude subscription (Max/Pro) instead of API key */
  claudeUseSubscription?: boolean
}

/**
 * Get the path to a CLI tool, checking common locations
 */
function getCLIPath(cli: "claude" | "codex" | "opencode"): string | null {
  const home = process.env.HOME || ""

  // Detect nvm-managed node bin directory
  const nvmBin = process.execPath ? dirname(process.execPath) : null

  const locations: Record<string, string[]> = {
    claude: [
      `${home}/.claude/local/claude`,
      "/usr/local/bin/claude",
      "/opt/homebrew/bin/claude",
      ...(nvmBin ? [`${nvmBin}/claude`] : []),
    ],
    codex: [
      "/usr/local/bin/codex",
      "/opt/homebrew/bin/codex",
      `${home}/.local/bin/codex`,
      ...(nvmBin ? [`${nvmBin}/codex`] : []),
    ],
    opencode: [
      `${home}/.opencode/bin/opencode`,
      "/usr/local/bin/opencode",
      "/opt/homebrew/bin/opencode",
      `${home}/.local/bin/opencode`,
      `${home}/go/bin/opencode`,
      ...(nvmBin ? [`${nvmBin}/opencode`] : []),
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
  // OpenCode is available via the embedded SDK (no CLI required).
  types.push("opencode")
  // Cerebras GLM agent - requires CEREBRAS_API_KEY
  if (process.env.CEREBRAS_API_KEY?.trim()) {
    types.push("cerebras")
  }
  // Gemini agent via Vercel AI SDK - requires GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim()) {
    types.push("gemini")
  }
  // OpenRouter agent via Vercel AI SDK - requires OPENROUTER_API_KEY
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    types.push("openrouter")
  }
  return types
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return value
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  return value
}

function extractContentBlocks(content: unknown): { text: string[]; thinking: string[] } {
  const text: string[] = []
  const thinking: string[] = []

  const pushValue = (value: unknown, isThinking: boolean) => {
    const coerced = coerceString(value)
    if (!coerced) return
    if (isThinking) {
      thinking.push(coerced)
    } else {
      text.push(coerced)
    }
  }

  const handleBlock = (block: Record<string, unknown>) => {
    const blockType = (coerceString(block.type) ?? "").toLowerCase()
    const isThinking = blockType.includes("thinking") || blockType.includes("reasoning")
    const contentValue = block.text ?? block.content ?? block.message ?? block.value ?? block.delta
    pushValue(contentValue, isThinking)
  }

  if (typeof content === "string") {
    text.push(content)
    return { text, thinking }
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object") {
        handleBlock(block as Record<string, unknown>)
      }
    }
    return { text, thinking }
  }

  if (content && typeof content === "object") {
    handleBlock(content as Record<string, unknown>)
  }

  return { text, thinking }
}

function hasCodexAuthHint(env: Record<string, string>): boolean {
  if (env.OPENAI_API_KEY?.trim()) return true

  const home = env.HOME ?? ""
  const codexHome = env.CODEX_HOME ?? ""
  const candidates = [
    codexHome && join(codexHome, "config.json"),
    codexHome && join(codexHome, "auth.json"),
    codexHome && join(codexHome, "credentials.json"),
    codexHome && join(codexHome, "token.json"),
    home && join(home, ".codex", "config.json"),
    home && join(home, ".codex", "auth.json"),
    home && join(home, ".codex", "credentials.json"),
    home && join(home, ".config", "codex", "config.json"),
  ].filter(Boolean) as string[]

  return candidates.some((candidate) => existsSync(candidate))
}

function getCodexAuthWarning(env: Record<string, string>): string | null {
  if (hasCodexAuthHint(env)) return null
  return "Codex CLI may require authentication. Set OPENAI_API_KEY or run `codex auth login`."
}

function resolveCodexHome(env: Record<string, string>, workingDir: string): string | null {
  if (env.CODEX_HOME) return env.CODEX_HOME

  const home = env.HOME ?? ""
  if (home) {
    const homeCodex = join(home, ".codex")
    const authCandidates = [
      join(homeCodex, "config.json"),
      join(homeCodex, "auth.json"),
      join(homeCodex, "credentials.json"),
      join(homeCodex, "token.json"),
    ]
    if (authCandidates.some((candidate) => existsSync(candidate))) {
      return homeCodex
    }
  }

  const projectCodex = join(workingDir, "data", "codex")
  try {
    mkdirSync(projectCodex, { recursive: true })
  } catch {
    return null
  }
  return projectCodex
}

const MAX_PROMPT_BYTES_IN_ARGS = 100_000
const STARTUP_OUTPUT_TIMEOUT_MS = 30_000
const MAX_PROCESS_RUNTIME_MS = 60 * 60 * 1000 // 1 hour max runtime
const MAX_OUTPUT_BUFFER_SIZE = 1_000_000 // 1MB max buffer to prevent overflow

type PromptTransport = "args" | "stdin"

interface BuiltCommand {
  command: string
  args: string[]
  promptTransport: PromptTransport
  stdinPrompt?: string
  /** Temp files to clean up after process exits */
  tempFiles?: string[]
}

/**
 * Write image attachments to temp files and return file paths
 */
function writeImagesTempFiles(attachments: ImageAttachment[]): string[] {
  const tempPaths: string[] = []
  const tempDir = tmpdir()

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]
    // Determine extension from MIME type
    const ext = att.mimeType.split("/")[1] || "png"
    const fileName = att.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || `image_${i}`
    const tempPath = join(tempDir, `ispo_code_${Date.now()}_${fileName}.${ext}`)

    // Decode base64 and write to temp file
    const buffer = Buffer.from(att.data, "base64")
    writeFileSync(tempPath, buffer)
    tempPaths.push(tempPath)
  }

  return tempPaths
}

/**
 * Clean up temp files
 */
function cleanupTempFiles(paths?: string[]): void {
  if (!paths) return
  for (const p of paths) {
    try {
      rmSync(p, { force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * CLI Agent Runner - runs external CLI agents as child processes
 */
export class CLIAgentRunner extends EventEmitter {
  private process: ChildProcess | null = null
  private aborted = false
  private abortReason: "user" | "timeout" | null = null
  private abortMessage: string | null = null
  private outputBuffer = ""
  private awaitingApproval = false
  private awaitingInput = false
  /** CLI session ID discovered from output */
  public cliSessionId: string | null = null
  /** Agent reported an error in structured output (even if exit code is 0). */
  private reportedError: string | null = null

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
    const { agentType, workingDir, isResume, claudeUseSubscription } = config

    const { command, args, promptTransport, stdinPrompt, tempFiles } = this.buildCommand(config)

    const action = isResume ? "Resuming" : "Starting"
    this.emitChunk("system", `${action} ${agentType} agent...`)

    return new Promise((resolve, reject) => {
      let settled = false
      let sawProcessOutput = false
      let startupTimer: ReturnType<typeof setTimeout> | null = null
      let maxRuntimeTimer: ReturnType<typeof setTimeout> | null = null

      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        if (startupTimer) clearTimeout(startupTimer)
        if (maxRuntimeTimer) clearTimeout(maxRuntimeTimer)
        startupTimer = null
        maxRuntimeTimer = null
        // Clean up temp files when process completes
        cleanupTempFiles(tempFiles)
        fn()
      }

      const markProcessOutput = () => {
        if (sawProcessOutput) return
        sawProcessOutput = true
        if (startupTimer) clearTimeout(startupTimer)
        startupTimer = null
      }

      try {
        this.aborted = false
        this.abortReason = null
        this.abortMessage = null
        this.reportedError = null
        this.awaitingApproval = false
        this.awaitingInput = false

        const env: Record<string, string> = { ...(process.env as Record<string, string>), FORCE_COLOR: "0" }

        // Codex CLI writes session state under CODEX_HOME
        if (agentType === "codex") {
          const codexHome = resolveCodexHome(env, workingDir)
          if (codexHome) {
            env.CODEX_HOME = codexHome
          }
        }

        // Claude Code writes to ~/.claude and ~/.claude.json. In sandboxed environments
        // HOME may not be writable, which causes Claude to fail early with EPERM.
        // If HOME isn't writable, redirect HOME to a project-local directory. We prefer
        // HOME over CLAUDE_CONFIG_DIR so Claude continues to find existing credentials.
        if (agentType === "claude") {
          env.CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING ??= "1"

          // Use subscription auth (Max/Pro) instead of API key billing
          // When enabled, remove API key to force OAuth-based auth
          if (claudeUseSubscription) {
            delete env.ANTHROPIC_API_KEY
          }

          const home = env.HOME || ""
          let homeWritable = false
          if (home) {
            try {
              accessSync(home, constants.W_OK)
              homeWritable = true
            } catch {
              homeWritable = false
            }
          }

          if (!homeWritable) {
            const redirectedHome = join(workingDir, "data", "claude-home")
            try {
              mkdirSync(redirectedHome, { recursive: true })
              env.HOME = redirectedHome
            } catch {
              // If we can't create it, leave HOME as-is and let Claude error.
            }
          }
        }

        if (agentType === "codex") {
          const warning = getCodexAuthWarning(env)
          if (warning) {
            this.emitChunk("system", warning)
          }
        }

        console.log(`[CLIRunner] Spawning: ${command} ${args.join(" ")}`)
        console.log(`[CLIRunner] Working dir: ${workingDir}`)

        this.process = spawn(command, args, {
          cwd: workingDir,
          env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
        })

        console.log(`[CLIRunner] Process spawned with PID: ${this.process.pid}`)

        // Set maximum runtime timeout
        maxRuntimeTimer = setTimeout(() => {
          if (settled) return
          if (!this.process) return
          if (this.aborted) return

          const msg =
            `${agentType} agent exceeded maximum runtime of ${Math.round(MAX_PROCESS_RUNTIME_MS / 1000 / 60)} minutes. ` +
            `Terminating to prevent resource exhaustion.`
          this.abortReason = "timeout"
          this.abortMessage = msg
          this.aborted = true

          try {
            this.process.kill("SIGTERM")
          } catch {
            // Ignore
          }
        }, MAX_PROCESS_RUNTIME_MS)

        // If the child never produces output, fail fast with a clear error.
        startupTimer = setTimeout(() => {
          if (settled) return
          if (sawProcessOutput) return
          if (!this.process) return
          if (this.aborted) return

          const msg =
            `${agentType} agent produced no output after ${Math.round(STARTUP_OUTPUT_TIMEOUT_MS / 1000)}s. ` +
            `Check CLI authentication and filesystem permissions.`
          this.abortReason = "timeout"
          this.abortMessage = msg
          this.aborted = true

          try {
            this.process.kill("SIGTERM")
          } catch {
            // Ignore
          }
        }, STARTUP_OUTPUT_TIMEOUT_MS)

        // Handle stdin
        if (this.process.stdin) {
          if (promptTransport === "stdin" && stdinPrompt) {
            this.process.stdin.write(stdinPrompt)
            if (!stdinPrompt.endsWith("\n")) {
              this.process.stdin.write("\n")
            }
            // Both Claude and Codex need EOF to process stdin input.
            // Since we use --dangerously-skip-permissions (Claude) and
            // --dangerously-bypass-approvals-and-sandbox (Codex), no interactive
            // prompts are expected, so we can safely close stdin.
            if (agentType === "claude" || agentType === "codex") {
              this.process.stdin.end()
            }
          }
        }

        // Handle stdout
        if (this.process.stdout) {
          this.process.stdout.on("data", (data: Buffer) => {
            markProcessOutput()
            this.handleOutput(data.toString(), agentType)
          })
        }

        // Handle stderr
        if (this.process.stderr) {
          this.process.stderr.on("data", (data: Buffer) => {
            markProcessOutput()
            const text = data.toString()
            console.log(`[CLIRunner] stderr: ${text.slice(0, 200)}`)
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
          console.log(`[CLIRunner] Process exited with code: ${code}`)
          this.process = null

          if (this.outputBuffer.trim()) {
            this.emitChunk("text", this.outputBuffer)
            this.outputBuffer = ""
          }

          if (this.aborted) {
            if (this.abortReason === "timeout") {
              const msg = this.abortMessage ?? "Agent timed out waiting for output"
              this.emitChunk("error", msg)
              this.emit("error", msg)
              settle(() => reject(new Error(msg)))
              return
            }
            this.emit("cancelled")
            settle(resolve)
            return
          }

          // Claude can report an error via JSON result while still exiting 0.
          if (code === 0 && this.reportedError) {
            this.emit("error", this.reportedError)
            settle(() => reject(new Error(this.reportedError!)))
            return
          }

          if (code === 0) {
            this.emit("complete", { tokensUsed: { input: 0, output: 0 } })
            settle(resolve)
          } else {
            const msg = this.reportedError
              ? `${this.reportedError} (exit code ${code})`
              : `Agent exited with code ${code}`
            this.emit("error", msg)
            settle(() => reject(new Error(msg)))
          }
        })

        this.process.on("error", (err) => {
          console.error(`[CLIRunner] Process error:`, err)
          this.process = null
          this.emit("error", err.message)
          settle(() => reject(err))
        })
      } catch (err) {
        const error = err as Error
        this.emit("error", error.message)
        settle(() => reject(error))
      }
    })
  }

  /**
   * Build CLI command and args
   */
  private buildCommand(config: CLIRunnerConfig): BuiltCommand {
    const { agentType, prompt, cliSessionId, isResume, model, attachments } = config

    const cliPath = getCLIPath(agentType as "claude" | "codex" | "opencode")
    if (!cliPath) {
      throw new Error(`CLI '${agentType}' not found`)
    }

    const promptBytes = Buffer.byteLength(prompt, "utf8")
    let promptTransport: PromptTransport =
      promptBytes > MAX_PROMPT_BYTES_IN_ARGS ? "stdin" : "args"

    // Write images to temp files if present
    let tempFiles: string[] | undefined
    if (attachments && attachments.length > 0) {
      tempFiles = writeImagesTempFiles(attachments)
    }

    return match(agentType)
      .with("claude", () => {
        // Claude Code supports reading the prompt from stdin (when no positional prompt
        // argument is provided). Prefer stdin to avoid shell escaping issues and OS
        // argv size limits for large task prompts.
        promptTransport = "stdin"
        // NOTE: --verbose must come before --output-format stream-json
        const args = [
          "-p",
          "--verbose",
          "--output-format", "stream-json",
          "--dangerously-skip-permissions",
        ]

        if (model) {
          args.push("--model", model)
        }

        // Add image files using --image flag (Claude CLI supports multiple --image flags)
        if (tempFiles && tempFiles.length > 0) {
          for (const imagePath of tempFiles) {
            args.push("--image", imagePath)
          }
        }

        if (isResume && cliSessionId) {
          args.push("--resume", cliSessionId)
        }

        console.log(`[CLIRunner] Claude command: ${cliPath} ${args.join(" ")}`)

        return {
          command: cliPath,
          args,
          promptTransport,
          stdinPrompt: prompt,
          tempFiles,
        }
      })
      .with("codex", () => {
        if (isResume && cliSessionId) {
          const args = ["resume", cliSessionId, "--json", "--dangerously-bypass-approvals-and-sandbox"]
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
          args: promptTransport === "args"
            ? ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", prompt]
            : ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox"],
          promptTransport,
          stdinPrompt: promptTransport === "stdin" ? prompt : undefined,
        }
      })
      .with("opencode", () => {
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
      })
      .otherwise(() => {
        throw new Error(`Agent type '${agentType}' is not a CLI agent`)
      })
  }

  /**
   * Handle output from the CLI
   */
  private handleOutput(data: string, agentType: AgentType) {
    this.outputBuffer += data

    // Prevent buffer overflow by limiting buffer size
    if (this.outputBuffer.length > MAX_OUTPUT_BUFFER_SIZE) {
      console.warn(
        `[CLIRunner] Output buffer exceeded ${MAX_OUTPUT_BUFFER_SIZE} bytes, flushing partial line`
      )
      // Emit the buffered content as-is and reset
      if (this.outputBuffer.trim()) {
        this.emitChunk("text", this.outputBuffer)
      }
      this.outputBuffer = ""
      return
    }

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

    match(type)
      .with("stream_event", () => {
        const event = json.event as Record<string, unknown> | undefined
        if (!event) return
        const eventType = event.type as string
        if (eventType === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined
          if (delta?.type === "text_delta" && delta.text) {
            this.emitChunk("text", String(delta.text))
          } else if (delta?.type === "thinking_delta" && delta.thinking) {
            this.emitChunk("thinking", String(delta.thinking))
          }
        }
      })
      .with("system", () => {
        const subtype = json.subtype as string | undefined
        if (subtype === "init") {
          const sessionId = json.session_id as string | undefined
          if (sessionId && !this.cliSessionId) {
            this.cliSessionId = sessionId
            this.emit("session_id", sessionId)
          }
        }
      })
      .with("assistant", () => {
        const errorCode = typeof json.error === "string" ? json.error : undefined
        let firstText: string | null = null
        // Handle assistant message with content array
        const message = json.message as Record<string, unknown> | undefined
        if (message?.content && Array.isArray(message.content)) {
          for (const block of message.content) {
            const blockObj = block as Record<string, unknown>
            if (blockObj.type === "text" && blockObj.text) {
              const text = String(blockObj.text)
              if (!firstText) firstText = text
              this.emitChunk("text", text)
            } else if (blockObj.type === "thinking" && blockObj.thinking) {
              this.emitChunk("thinking", String(blockObj.thinking))
            } else if (blockObj.type === "tool_use") {
              const toolName = blockObj.name as string
              this.emitChunk("tool_use", JSON.stringify({
                name: toolName,
                input: blockObj.input,
              }), { tool: toolName })
              // AskUserQuestion tool requires user input
              if (toolName === "AskUserQuestion") {
                this.emitWaitingInput()
              }
            }
          }
        }

        if (errorCode) {
          this.reportedError ??= firstText ?? errorCode
        }
      })
      .with("result", () => {
        // Handle final result - session complete
        const isError = json.is_error === true
        if (isError) {
          const msg = String(json.result ?? json.message ?? json.error ?? "Unknown error")
          this.reportedError ??= msg
          this.emitChunk("error", msg)
        }

        const sessionId = json.session_id as string | undefined
        if (sessionId && !this.cliSessionId) {
          this.cliSessionId = sessionId
          this.emit("session_id", sessionId)
        }
      })
      .with("tool_use", () => {
        const toolName = json.name as string
        this.emitChunk("tool_use", JSON.stringify({
          name: toolName,
          input: json.input,
        }), { tool: toolName })
        // AskUserQuestion tool requires user input
        if (toolName === "AskUserQuestion") {
          this.emitWaitingInput()
        }
      })
      .with("tool_result", () => {
        this.emitChunk("tool_result", String(json.content ?? json.output ?? ""))
      })
      .with("error", () => {
        this.reportedError ??= String(json.message ?? json.error ?? "Unknown error")
        this.emitChunk("error", this.reportedError)
      })
      .otherwise(() => {})
  }

  /**
   * Parse Codex CLI output
   */
  private parseCodexOutput(json: Record<string, unknown>) {
    const type = typeof json.type === "string" ? json.type : undefined
    const status = typeof json.status === "string" ? json.status : undefined
    const typeLower = type?.toLowerCase() ?? ""

    if (type && (type.includes("approval") || type.includes("permission"))) {
      this.emitWaitingApproval()
    }
    if (status === "waiting_approval" || status === "approval_required") {
      this.emitWaitingApproval()
    }
    if (status === "waiting_input" || status === "input_required") {
      this.emitWaitingInput()
    }

    const sessionId = coerceString(
      json.thread_id ?? json.session_id ?? json.sessionId ?? json.conversation_id ?? json.conversationId
    )
    if (sessionId && !this.cliSessionId) {
      this.cliSessionId = sessionId
      this.emit("session_id", sessionId)
    }

    if (type === "thread.started") {
      return
    }

    // Codex returns needs_follow_up to indicate if session can accept more input
    // We track this but don't block resumes - let users try anyway
    if (typeof json.needs_follow_up === "boolean") {
      this.emit("resumable", json.needs_follow_up)
      // Log but don't error - allow resume attempts even if Codex says no
      if (!json.needs_follow_up) {
        console.log(`[CLIRunner] Codex reported needs_follow_up: false for session`)
      }
    }

    const errorObj = json.error as Record<string, unknown> | undefined
    const errorMsg =
      (typeLower.includes("error")
        ? coerceString(json.message ?? json.error)
        : undefined) ??
      coerceString(errorObj?.message ?? errorObj?.error)

    if (errorMsg) {
      this.reportedError ??= errorMsg
      this.emitChunk("error", errorMsg)
      return
    }

    const item = json.item as Record<string, unknown> | undefined
    if (item) {
      const itemType = coerceString(item.type) ?? ""
      const itemTypeLower = itemType.toLowerCase()

      if (
        itemTypeLower === "tool_call" ||
        itemTypeLower === "function_call" ||
        itemTypeLower === "tool"
      ) {
        const toolName = coerceString(item.name ?? item.tool ?? item.tool_name)
        if (toolName) {
          const input = parseMaybeJson(item.arguments ?? item.args ?? item.input)
          this.emitChunk("tool_use", JSON.stringify({ name: toolName, input }), { tool: toolName })
          return
        }
      }

      if (itemTypeLower === "tool_result" || itemTypeLower === "tool_output") {
        const result = coerceString(item.output ?? item.result ?? item.content)
        if (result) {
          this.emitChunk("tool_result", result)
          return
        }
      }

      const { text, thinking } = extractContentBlocks(item.content)
      if (text.length || thinking.length) {
        for (const chunk of text) {
          this.emitChunk("text", chunk)
        }
        for (const chunk of thinking) {
          this.emitChunk("thinking", chunk)
        }
        return
      }

      const itemText = coerceString(item.text ?? item.message ?? item.content)
      if (itemText) {
        if (itemTypeLower.includes("reasoning") || itemTypeLower.includes("thinking")) {
          this.emitChunk("thinking", itemText)
        } else {
          this.emitChunk("text", itemText)
        }
        return
      }
    }

    if (typeLower.includes("output_text") || typeLower.includes("message") || typeLower.includes("text")) {
      const text = coerceString(json.delta ?? json.text ?? json.output_text ?? json.content ?? json.message)
      if (text && !typeLower.includes("completed")) {
        this.emitChunk("text", text)
        return
      }
    }

    if (typeLower.includes("thinking") || typeLower.includes("reasoning")) {
      const thinking = coerceString(
        json.delta ?? json.text ?? json.content ?? json.message ?? json.thinking ?? json.reasoning
      )
      if (thinking && !typeLower.includes("completed")) {
        this.emitChunk("thinking", thinking)
        return
      }
    }

    const toolName = coerceString(json.name ?? json.tool ?? json.tool_name)
    if (toolName && (typeLower.includes("tool") || typeLower.includes("function"))) {
      const input = parseMaybeJson(json.arguments ?? json.args ?? json.input)
      this.emitChunk("tool_use", JSON.stringify({ name: toolName, input }), { tool: toolName })
      return
    }

    if (typeLower.includes("tool_result") || typeLower.includes("tool_output")) {
      const result = coerceString(json.output ?? json.result ?? json.content)
      if (result) {
        this.emitChunk("tool_result", result)
        return
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

    match(type)
      .with("message", "text", "output", "response", () => {
        const text = (json.content ?? json.text ?? json.message) as string | undefined
        if (text) this.emitChunk("text", text)
      })
      .with("tool_call", "tool_use", () => {
        this.emitChunk("tool_use", JSON.stringify({
          name: json.name ?? json.tool,
          input: json.input ?? json.args,
        }), { tool: (json.name ?? json.tool) as string })
      })
      .with("tool_result", "tool_output", () => {
        const result = (json.output ?? json.result ?? json.content) as string | undefined
        if (result) this.emitChunk("tool_result", result)
      })
      .with("error", () => {
        const errorMsg = (json.message ?? json.error ?? "Unknown error") as string
        this.reportedError ??= errorMsg
        this.emitChunk("error", errorMsg)
      })
      .otherwise(() => {})
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
    this.abortReason = "user"
    this.abortMessage = null

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
