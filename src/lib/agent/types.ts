/**
 * Agent types supported by the system
 */
export type AgentType = "claude" | "codex" | "opencode" | "cerebras" | "gemini" | "mcporter"

/**
 * Image attachment for multimodal agent input
 */
export interface ImageAttachment {
  /** Discriminator for attachment type */
  type: "image"
  /** MIME type (e.g., "image/png", "image/jpeg") */
  mimeType: string
  /** Base64-encoded image data */
  data: string
  /** Optional file name for display */
  fileName?: string
}

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
 * Serialized image attachment for output chunk metadata
 * Using Record form to stay compatible with existing metadata type
 */
export interface SerializedImageAttachment {
  type: "image"
  mimeType: string
  data: string
  fileName?: string
}

/**
 * Output chunk from an agent
 */
export interface AgentOutputChunk {
  type: "text" | "tool_use" | "tool_result" | "system" | "error" | "thinking" | "user_message"
  content: string
  timestamp: string
  /** Serializable metadata - avoid using `unknown` for TanStack serialization */
  metadata?: Record<string, string | number | boolean | null>
  /** Image attachments for user_message chunks */
  attachments?: SerializedImageAttachment[]
}

/**
 * Information about a file that was edited during a session
 */
export interface EditedFileInfo {
  path: string
  /** Path relative to agent's working directory */
  relativePath?: string
  /** Path relative to git repository root */
  repoRelativePath?: string
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
 * Serializable Gemini message format for session storage (Vercel AI SDK CoreMessage)
 */
export interface GeminiMessageData {
  role: "system" | "user" | "assistant" | "tool"
  content: string | Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; args?: unknown; result?: unknown }>
}

/**
 * Serializable OpenCode message format for session storage
 */
export interface OpencodeMessageData {
  role: "user" | "assistant" | "system"
  content: string
}

/**
 * Serializable MCPorter message format for session storage (Vercel AI SDK CoreMessage)
 */
export interface MCPorterMessageData {
  role: "system" | "user" | "assistant" | "tool"
  content: string | Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; args?: unknown; result?: unknown }>
}

/**
 * Resume history entry for tracking session resumption attempts
 */
export interface ResumeHistoryEntry {
  timestamp: string
  message: string
  success: boolean
  error?: string
}

/**
 * Agent session data
 */
export interface AgentSession {
  id: string
  prompt: string
  /** Display title for sidebar (uses prompt if not set) */
  title?: string
  status: SessionStatus
  startedAt: string
  completedAt?: string
  workingDir: string
  /** Git worktree path for isolated session changes */
  worktreePath?: string
  /** Git worktree branch name (agentz/session-{sessionId}) */
  worktreeBranch?: string
  /** GitHub repository info if working in a cloned repo */
  githubRepo?: {
    owner: string
    repo: string
  }
  output: AgentOutputChunk[]
  error?: string
  agentType?: AgentType
  /** Model identifier used by the backend (varies by agent type) */
  model?: string
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
  /** Raw Gemini messages for conversation resumption (Vercel AI SDK format) */
  geminiMessages?: GeminiMessageData[]
  /** Raw MCPorter messages for conversation resumption (Vercel AI SDK format) */
  mcporterMessages?: MCPorterMessageData[]
  /** Link to a task file if this session is executing a task */
  taskPath?: string
  /** Link to a plan file if this session was created from a plan */
  planPath?: string
  /** Custom user instructions for review/verify tasks */
  instructions?: string
  /** Source file path if session originated from a file comment */
  sourceFile?: string
  /** Source line number if session originated from an inline comment */
  sourceLine?: number
  /** Debug run ID for grouping multi-agent debug sessions */
  debugRunId?: string
  /** Whether this session can be resumed */
  resumable?: boolean
  /** Timestamp of last resume attempt */
  lastResumedAt?: string
  /** Number of resume attempts */
  resumeAttempts?: number
  /** History of resume attempts */
  resumeHistory?: ResumeHistoryEntry[]
  /** User identifier for rate limiting */
  userId?: string
  /** Merge commit hash if session was merged to main */
  mergeCommitHash?: string
  /** Timestamp when session was merged to main */
  mergedAt?: string
}

/**
 * Parameters for spawning an agent
 */
export interface SpawnAgentParams {
  prompt: string
  /** Display title for sidebar (uses prompt if not set) */
  title?: string
  workingDir?: string
  sessionId?: string
  agentType?: AgentType
  model?: string
  /** Link to a task file if this session is executing a task */
  taskPath?: string
  /** Link to a plan file if this session was created from a plan */
  planPath?: string
  /** Source file path if session originated from a file comment */
  sourceFile?: string
  /** Source line number if session originated from an inline comment */
  sourceLine?: number
  /** Image attachments for multimodal input */
  attachments?: ImageAttachment[]
  /** User identifier for rate limiting (defaults to "anonymous") */
  userId?: string
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