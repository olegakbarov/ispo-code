/**
 * MetadataAnalyzer - Derives session metadata from output chunks
 *
 * This service processes agent output chunks in real-time to calculate:
 * - Context window usage estimates
 * - File operations (create/edit/delete)
 * - Tool usage statistics
 * - Output metrics
 *
 * Design: Observer pattern - passively watches chunk events without side effects
 */

import type {
  AgentOutputChunk,
  AgentSessionMetadata,
  EditedFileInfo,
  AgentType,
} from "./types"
import { calculateRelativePaths } from "../utils/path-utils"

/**
 * Default context window limits by agent type
 */
const MODEL_CONTEXT_LIMITS: Record<AgentType, number> = {
  claude: 200_000, // Claude Sonnet 4.5
  codex: 128_000, // GPT-4o
  opencode: 200_000, // Varies by provider, default to Claude
  cerebras: 8_192, // GLM-4.7 / Llama-3.3-70b
}

/**
 * Estimated system prompt tokens (rough baseline)
 */
const ESTIMATED_SYSTEM_PROMPT_TOKENS = 2000

/**
 * Token estimation heuristic: ~4 characters per token
 * (Works reasonably well for English text; less accurate for code)
 */
const CHARS_PER_TOKEN = 4

export class MetadataAnalyzer {
  private metadata: AgentSessionMetadata
  private readonly agentType: AgentType
  private readonly workingDir: string

  constructor(agentType: AgentType, workingDir: string, modelLimit?: number) {
    this.agentType = agentType
    this.workingDir = workingDir
    this.metadata = this.initializeMetadata(agentType, modelLimit)
  }

  /**
   * Initialize metadata with defaults based on agent type
   */
  private initializeMetadata(
    agentType: AgentType,
    modelLimit?: number
  ): AgentSessionMetadata {
    return {
      contextWindow: {
        estimatedTokens: ESTIMATED_SYSTEM_PROMPT_TOKENS,
        modelLimit: modelLimit ?? MODEL_CONTEXT_LIMITS[agentType],
        utilizationPercent: 0,
      },
      editedFiles: [],
      toolStats: {
        totalCalls: 0,
        byTool: {},
        byType: {
          read: 0,
          write: 0,
          execute: 0,
          other: 0,
        },
      },
      outputMetrics: {
        textChunks: 0,
        thinkingChunks: 0,
        errorChunks: 0,
        systemChunks: 0,
        totalCharacters: 0,
        estimatedOutputTokens: 0,
      },
      duration: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      messageCount: 0,
    }
  }

  /**
   * Process a single output chunk and update metadata
   */
  processChunk(chunk: AgentOutputChunk): void {
    switch (chunk.type) {
      case "tool_use":
        this.processToolUse(chunk)
        break
      case "tool_result":
        this.processToolResult(chunk)
        break
      case "text":
        this.processText(chunk)
        break
      case "thinking":
        this.processThinking(chunk)
        break
      case "error":
        this.metadata.outputMetrics.errorChunks++
        break
      case "system":
        this.metadata.outputMetrics.systemChunks++
        break
    }

    // Update context window estimate after each chunk
    this.updateContextWindowEstimate()
  }

  /**
   * Process tool_use chunk to extract tool stats and file operations
   */
  private processToolUse(chunk: AgentOutputChunk): void {
    // Parse tool use from content
    let toolData: { name: string; input?: Record<string, unknown> }
    try {
      toolData = JSON.parse(chunk.content)
    } catch {
      // If parsing fails, try to get tool name from metadata
      const toolName = chunk.metadata?.toolName as string
      if (toolName) {
        toolData = { name: toolName }
      } else {
        return
      }
    }

    const toolName =
      (chunk.metadata?.toolName as string) ?? toolData.name ?? "unknown"

    // Update tool stats
    this.metadata.toolStats.totalCalls++
    this.metadata.toolStats.byTool[toolName] =
      (this.metadata.toolStats.byTool[toolName] ?? 0) + 1

    // Categorize tool by type
    this.categorizeToolCall(toolName)

    // Track file operations
    if (toolData.input) {
      this.trackFileOperation(toolName, toolData.input, chunk.timestamp)
    }
  }

  /**
   * Categorize tool call into read/write/execute/other
   */
  private categorizeToolCall(toolName: string): void {
    const lowerTool = toolName.toLowerCase()

    // Read operations
    const readTools = [
      "read_file",
      "read",
      "glob",
      "grep",
      "list_files",
      "ls",
      "cat",
    ]
    if (readTools.some((tool) => lowerTool.includes(tool))) {
      this.metadata.toolStats.byType.read++
      return
    }

    // Write operations
    const writeTools = [
      "write_file",
      "write",
      "edit",
      "create_file",
      "notebook_edit",
    ]
    if (writeTools.some((tool) => lowerTool.includes(tool))) {
      this.metadata.toolStats.byType.write++
      return
    }

    // Execute operations
    const executeTools = ["bash", "exec_command", "execute", "shell", "run"]
    if (executeTools.some((tool) => lowerTool.includes(tool))) {
      this.metadata.toolStats.byType.execute++
      return
    }

    // Everything else
    this.metadata.toolStats.byType.other++
  }

  /**
   * Track file operations for editedFiles list
   *
   * TODO: Decision needed - Should we check the filesystem to distinguish
   * "create" vs "edit" operations? Or assume all writes are "edit"?
   *
   * Trade-off:
   * - Filesystem check: More accurate, but adds I/O overhead
   * - Assume edit: Fast, but may incorrectly label new file creation
   *
   * Current implementation: Assumes "edit" for simplicity
   */
  private trackFileOperation(
    toolName: string,
    input: Record<string, unknown>,
    timestamp: string
  ): void {
    // Extract file path from tool input (various possible keys)
    const path =
      (input.path as string) ??
      (input.file_path as string) ??
      (input.file as string) ??
      (input.notebook_path as string)

    if (!path) return

    // Determine operation type based on tool name
    let operation: "create" | "edit" | "delete" | null = null

    const lowerTool = toolName.toLowerCase()

    if (lowerTool.includes("write") || lowerTool.includes("edit")) {
      // TODO: Could check filesystem here with existsSync(path)
      // For now, assume "edit" (most common case)
      operation = "edit"
    } else if (lowerTool.includes("create")) {
      operation = "create"
    } else if (lowerTool.includes("delete") || lowerTool.includes("remove")) {
      operation = "delete"
    }

    if (operation) {
      // Calculate relative paths
      const { relativePath, repoRelativePath } = calculateRelativePaths(
        path,
        this.workingDir
      )

      const editInfo: EditedFileInfo = {
        path,
        relativePath,
        repoRelativePath: repoRelativePath || undefined,
        operation,
        timestamp,
        toolUsed: toolName,
        // linesChanged and sizeBytes could be derived from tool_result
        // if we parse the result content
      }

      this.metadata.editedFiles.push(editInfo)
    }
  }

  /**
   * Process tool_result chunk
   *
   * Currently just counts results. Could be extended to:
   * - Parse file sizes from write_file results
   * - Count lines changed from edit results
   * - Add tool results to context window estimate
   */
  private processToolResult(_chunk: AgentOutputChunk): void {
    // For now, just count it
    // Future: Parse content to extract file sizes, line counts, etc.

    // Tool results can be large (especially for read_file)
    // Should we count them toward context window?
    // TODO: Decision needed
  }

  /**
   * Process text chunk for output metrics
   */
  private processText(chunk: AgentOutputChunk): void {
    this.metadata.outputMetrics.textChunks++
    this.metadata.outputMetrics.totalCharacters += chunk.content.length

    // Rough token estimate: ~4 chars per token
    const estimatedTokens = Math.ceil(chunk.content.length / CHARS_PER_TOKEN)
    this.metadata.outputMetrics.estimatedOutputTokens += estimatedTokens
  }

  /**
   * Process thinking chunk (extended thinking mode)
   */
  private processThinking(chunk: AgentOutputChunk): void {
    this.metadata.outputMetrics.thinkingChunks++
    this.metadata.outputMetrics.totalCharacters += chunk.content.length

    // Thinking tokens count toward context window
    const estimatedTokens = Math.ceil(chunk.content.length / CHARS_PER_TOKEN)
    this.metadata.outputMetrics.estimatedOutputTokens += estimatedTokens
  }

  /**
   * Update context window estimate based on accumulated data
   *
   * Estimates total context tokens from:
   * 1. System prompts (~2000 tokens baseline)
   * 2. Accumulated output tokens (text + thinking)
   * 3. User input tokens (will be updated in updateTokenCounts)
   *
   * TODO: Should tool results count toward context? They can be large.
   * Current implementation: No, only text/thinking output
   */
  private updateContextWindowEstimate(): void {
    const systemPromptTokens = ESTIMATED_SYSTEM_PROMPT_TOKENS
    const outputTokens = this.metadata.outputMetrics.estimatedOutputTokens

    // This is just the output estimate; will be refined when we get
    // actual token counts from the completion event
    const estimatedTotal = systemPromptTokens + outputTokens

    this.metadata.contextWindow.estimatedTokens = estimatedTotal
    this.metadata.contextWindow.utilizationPercent =
      (estimatedTotal / this.metadata.contextWindow.modelLimit) * 100
  }

  /**
   * Update metadata with actual token counts from completion event
   *
   * This refines our estimates using the actual token counts returned
   * by the model API (much more accurate than our char/4 heuristic)
   */
  updateTokenCounts(inputTokens: number, outputTokens: number): void {
    const systemPromptTokens = ESTIMATED_SYSTEM_PROMPT_TOKENS

    // Use actual token counts instead of estimates
    this.metadata.contextWindow.estimatedTokens =
      systemPromptTokens + inputTokens + outputTokens

    this.metadata.contextWindow.utilizationPercent =
      (this.metadata.contextWindow.estimatedTokens /
        this.metadata.contextWindow.modelLimit) *
      100

    // Also update the output tokens estimate to match reality
    this.metadata.outputMetrics.estimatedOutputTokens = outputTokens
  }

  /**
   * Get current metadata snapshot (returns a copy)
   */
  getMetadata(): AgentSessionMetadata {
    return {
      contextWindow: { ...this.metadata.contextWindow },
      editedFiles: [...this.metadata.editedFiles],
      toolStats: {
        totalCalls: this.metadata.toolStats.totalCalls,
        byTool: { ...this.metadata.toolStats.byTool },
        byType: { ...this.metadata.toolStats.byType },
      },
      outputMetrics: { ...this.metadata.outputMetrics },
      duration: this.metadata.duration,
      userMessageCount: this.metadata.userMessageCount,
      assistantMessageCount: this.metadata.assistantMessageCount,
      messageCount: this.metadata.messageCount,
      currentTurn: this.metadata.currentTurn,
      lastTurn: this.metadata.lastTurn,
      turns: this.metadata.turns ? [...this.metadata.turns] : undefined,
      taskPath: this.metadata.taskPath,
    }
  }

  /**
   * Get list of files changed since session start
   * Returns a copy of edited files array
   */
  getChangedFilesSinceStart(): EditedFileInfo[] {
    return [...this.metadata.editedFiles]
  }
}
