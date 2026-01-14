/**
 * Agent types supported by the system
 */
export type AgentType = "claude" | "codex" | "opencode" | "cerebras"

/**
 * Agent session status
 */
export type SessionStatus =
  | "pending"
  | "running"
  | "working"
  | "waiting_approval"
  | "waiting_input"
  | "idle"
  | "completed"
  | "failed"
  | "cancelled"

/**
 * Output chunk from an agent
 */
export interface AgentOutputChunk {
  type: "text" | "tool_use" | "tool_result" | "system" | "error" | "thinking"
  content: string
  timestamp: string
  /** Serializable metadata - avoid using `unknown` for TanStack serialization */
  metadata?: Record<string, string | number | boolean | null>
}

/**
 * Information about a file that was edited during a session
 */
export interface EditedFileInfo {
  path: string
  operation: "create" | "edit" | "delete"
  timestamp: string
  toolUsed: string
  linesChanged?: number
  sizeBytes?: number
}

/**
 * Context window usage tracking
 */
export interface ContextWindowInfo {
  estimatedTokens: number
  modelLimit: number
  utilizationPercent: number
  /** Whether the context includes tool result content */
  includesToolResults?: boolean
}

/**
 * Tool usage statistics
 */
export interface ToolStats {
  totalCalls: number
  byTool: Record<string, number>
  byType: {
    read: number
    write: number
    execute: number
    other: number
  }
}

/**
 * Output metrics for a session
 */
export interface OutputMetrics {
  textChunks: number
  thinkingChunks: number
  errorChunks: number
  systemChunks: number
  totalCharacters: number
  estimatedOutputTokens: number
  /** Tool result chunks count */
  toolResultChunks?: number
  /** Total characters in tool results */
  toolResultCharacters?: number
  /** Estimated tokens in tool results */
  estimatedToolResultTokens?: number
}

/**
 * Tool call counts by type
 */
export interface ToolCallsByType {
  read: number
  write: number
  execute: number
  other: number
}

/**
 * Top tool usage info
 */
export interface TopToolInfo {
  tool: string
  count: number
}

/**
 * Turn information for conversation tracking
 */
export interface TurnInfo {
  turnNumber: number
  userMessage?: string
  assistantMessage?: string
  toolCalls?: number
  timestamp: string
}

/**
 * Detailed turn information for sidebar display
 */
export interface DetailedTurnInfo {
  index: number
  startedAt: string
  endedAt?: string
  durationMs?: number
  status?: 'pending' | 'working' | 'completed' | 'failed' | 'cancelled'
  toolCalls: number
  toolCallsByType: ToolCallsByType
  uniqueEditedFilesCount: number
  editedFilesCount: number
  textCharacters: number
  toolResultCharacters: number
  topTools: TopToolInfo[]
}

/**
 * Turn summary for turn history list
 */
export interface TurnSummary {
  index: number
  endedAt: string
  status: 'completed' | 'failed' | 'cancelled'
  durationMs: number
}

/**
 * Metadata derived from agent session output
 */
export interface AgentSessionMetadata {
  contextWindow: ContextWindowInfo
  editedFiles: EditedFileInfo[]
  toolStats: ToolStats
  outputMetrics: OutputMetrics
  /** Duration of the session in milliseconds */
  duration: number
  /** Path to associated task file */
  taskPath?: string
  /** Current active turn (if working) */
  currentTurn?: DetailedTurnInfo
  /** Most recently completed turn */
  lastTurn?: DetailedTurnInfo
  /** Historical turn summaries */
  turns?: TurnSummary[]
  /** Number of user messages */
  userMessageCount: number
  /** Number of assistant messages */
  assistantMessageCount: number
  /** Total message count */
  messageCount: number
}

/**
 * Conversation message for multi-turn support
 */
export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

/**
 * Serializable Cerebras message format for session storage
 */
export interface CerebrasMessageData {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

/**
 * Agent session data
 */
export interface AgentSession {
  id: string
  prompt: string
  status: SessionStatus
  startedAt: string
  completedAt?: string
  workingDir: string
  output: AgentOutputChunk[]
  error?: string
  agentType?: AgentType
  metadata?: AgentSessionMetadata | null
  tokensUsed?: {
    input: number
    output: number
  }
  /** CLI session ID for resume support */
  cliSessionId?: string
  /** Conversation history for multi-turn */
  messages?: ConversationMessage[]
  /** Raw Cerebras messages for conversation resumption */
  cerebrasMessages?: CerebrasMessageData[]
  /** Link to a task file if this session is executing a task */
  taskPath?: string
}

/**
 * Parameters for spawning an agent
 */
export interface SpawnAgentParams {
  prompt: string
  workingDir?: string
  sessionId?: string
  agentType?: AgentType
  model?: string
  /** Link to a task file if this session is executing a task */
  taskPath?: string
}

/**
 * WebSocket client message
 */
export interface WSClientMessage {
  type: "subscribe" | "unsubscribe" | "cancel"
  sessionId?: string
}

/**
 * WebSocket server message
 */
export interface WSServerMessage {
  type: "output" | "status" | "error" | "sessions"
  sessionId?: string
  data: unknown
}
