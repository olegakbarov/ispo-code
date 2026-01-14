/**
 * Agent Control Panel Types
 */

// === Agent Session Types ===

/**
 * Enhanced session status with granular working states.
 */
export type SessionStatus =
  | "pending"
  | "working"
  | "waiting_approval"
  | "waiting_input"
  | "idle"
  | "completed"
  | "failed"
  | "cancelled"

export type AgentType = "claude" | "codex" | "opencode" | "cerebras"

// === Enhanced Metadata Types ===

export interface AgentSessionMetadata {
  contextWindow: {
    estimatedTokens: number
    modelLimit: number
    utilizationPercent: number
    includesToolResults: boolean
  }
  editedFiles: EditedFileInfo[]
  toolStats: {
    totalCalls: number
    byTool: Record<string, number>
    byType: {
      read: number
      write: number
      execute: number
      other: number
    }
  }
  outputMetrics: {
    textChunks: number
    thinkingChunks: number
    toolResultChunks: number
    errorChunks: number
    systemChunks: number
    totalCharacters: number
    toolResultCharacters: number
    estimatedOutputTokens: number
    estimatedToolResultTokens: number
  }
  currentTurn?: AgentTurnProgress
  lastTurn?: AgentTurnSummary
  turns?: AgentTurnSummary[]
}

export interface AgentTurnProgress {
  index: number
  startedAt: string
  toolCalls: number
  toolCallsByType: {
    read: number
    write: number
    execute: number
    other: number
  }
  topTools: Array<{ tool: string; count: number }>
  editedFilesCount: number
  uniqueEditedFilesCount: number
  textCharacters: number
  toolResultCharacters: number
}

export interface AgentTurnSummary extends AgentTurnProgress {
  status: "completed" | "failed" | "cancelled"
  endedAt: string
  durationMs: number
}

export interface EditedFileInfo {
  path: string
  operation: "create" | "edit" | "delete"
  timestamp: string
  toolUsed: string
  linesChanged?: number
  sizeBytes?: number
}

export interface AgentSession {
  id: string
  prompt: string
  status: SessionStatus
  agentType: AgentType
  model?: string
  startedAt: string
  completedAt?: string
  pid?: number
  workingDir: string
  output: AgentOutputChunk[]
  tokensUsed?: {
    input: number
    output: number
  }
  exitCode?: number
  error?: string
  cliSessionId?: string
  messages?: ConversationMessage[]
  taskPath?: string
  metadata?: AgentSessionMetadata
}

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface AgentOutputChunk {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "error" | "system"
  content: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface SpawnAgentParams {
  prompt: string
  workingDir?: string
  sessionId?: string
  agentType?: AgentType
  model?: string
  taskPath?: string
}

// === Git Types ===

export interface GitStatus {
  branch: string
  staged: GitFileStatus[]
  modified: GitFileStatus[]
  untracked: string[]
  ahead: number
  behind: number
}

export interface GitFileStatus {
  file: string
  status: "added" | "modified" | "deleted" | "renamed" | "copied"
}
