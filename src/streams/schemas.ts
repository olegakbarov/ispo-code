/**
 * Durable Streams Schema Definitions
 *
 * Defines the event types and structures used in the durable streams system.
 * Streams are append-only logs that persist agent session data and lifecycle events.
 */

import type { AgentOutputChunk, AgentType, SessionStatus, AgentSessionMetadata } from "../lib/agent/types"

/**
 * Registry events - lifecycle events for all sessions
 * Published to: /__registry__
 */
export type RegistryEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionCompletedEvent
  | SessionFailedEvent
  | SessionCancelledEvent
  | SessionDeletedEvent

export interface SessionCreatedEvent {
  type: "session_created"
  sessionId: string
  agentType: AgentType
  prompt: string
  workingDir: string
  /** Git worktree path for isolated session changes */
  worktreePath?: string
  /** Git worktree branch name (ispo-code/session-{sessionId}) */
  worktreeBranch?: string
  model?: string
  taskPath?: string
  /** Display title for sidebar (e.g., "Review: Task Name") */
  title?: string
  /** Custom user instructions for review/verify tasks */
  instructions?: string
  /** Source file path if session originated from a file comment */
  sourceFile?: string
  /** Source line number if session originated from an inline comment */
  sourceLine?: number
  /** Debug run ID for grouping multi-agent debug sessions */
  debugRunId?: string
  /** GitHub repository info if working in a cloned repo */
  githubRepo?: {
    owner: string
    repo: string
  }
  timestamp: string
}

export interface SessionUpdatedEvent {
  type: "session_updated"
  sessionId: string
  status: SessionStatus
  timestamp: string
}

export interface SessionCompletedEvent {
  type: "session_completed"
  sessionId: string
  metadata?: AgentSessionMetadata
  tokensUsed?: {
    input: number
    output: number
  }
  timestamp: string
}

export interface SessionFailedEvent {
  type: "session_failed"
  sessionId: string
  error: string
  metadata?: AgentSessionMetadata
  timestamp: string
}

export interface SessionCancelledEvent {
  type: "session_cancelled"
  sessionId: string
  timestamp: string
}

export interface SessionDeletedEvent {
  type: "session_deleted"
  sessionId: string
  timestamp: string
}

/**
 * Control stream events - commands sent to daemon
 * Published to: /control/{sessionId}
 * Daemon polls this stream for commands
 */
export type ControlStreamEvent =
  | ApprovalResponseEvent
  | InputResponseEvent
  | CancelCommandEvent

export interface ApprovalResponseEvent {
  type: "approval_response"
  approved: boolean
  timestamp: string
}

export interface InputResponseEvent {
  type: "input_response"
  input: string
  timestamp: string
}

export interface CancelCommandEvent {
  type: "cancel"
  timestamp: string
}

/**
 * Session stream events - agent output and interactions
 * Published to: /sessions/{sessionId}
 */
export type SessionStreamEvent =
  | AgentOutputEvent
  | StatusChangeEvent
  | ApprovalRequestEvent
  | InputRequestEvent
  | CLISessionIdEvent
  | DaemonStartedEvent
  | AgentStateEvent

export interface AgentOutputEvent {
  type: "output"
  chunk: AgentOutputChunk
  timestamp: string
}

export interface StatusChangeEvent {
  type: "status_change"
  status: SessionStatus
  timestamp: string
}

export interface ApprovalRequestEvent {
  type: "approval_request"
  timestamp: string
}

export interface InputRequestEvent {
  type: "input_request"
  timestamp: string
}

export interface CLISessionIdEvent {
  type: "cli_session_id"
  cliSessionId: string
  timestamp: string
}

export interface DaemonStartedEvent {
  type: "daemon_started"
  pid: number
  daemonNonce: string
  timestamp: string
}

/**
 * Agent state event - persists conversation state for SDK agents (Cerebras, Gemini, OpenCode, OpenRouter)
 * Published after each turn completion for resume support
 */
export interface AgentStateEvent {
  type: "agent_state"
  agentType: "cerebras" | "gemini" | "opencode" | "openrouter"
  /** Serialized conversation messages (format depends on agentType) */
  messages: unknown[]
  timestamp: string
}

/**
 * Stream paths
 */
export const REGISTRY_STREAM = "/__registry__"
export const getSessionStreamPath = (sessionId: string) => `/sessions/${sessionId}`
export const getControlStreamPath = (sessionId: string) => `/control/${sessionId}`

/**
 * Helper to create registry events
 */
export const createRegistryEvent = {
  created: (data: Omit<SessionCreatedEvent, "type" | "timestamp">): SessionCreatedEvent => ({
    type: "session_created",
    ...data,
    timestamp: new Date().toISOString(),
  }),

  updated: (data: Omit<SessionUpdatedEvent, "type" | "timestamp">): SessionUpdatedEvent => ({
    type: "session_updated",
    ...data,
    timestamp: new Date().toISOString(),
  }),

  completed: (data: Omit<SessionCompletedEvent, "type" | "timestamp">): SessionCompletedEvent => ({
    type: "session_completed",
    ...data,
    timestamp: new Date().toISOString(),
  }),

  failed: (data: Omit<SessionFailedEvent, "type" | "timestamp">): SessionFailedEvent => ({
    type: "session_failed",
    ...data,
    timestamp: new Date().toISOString(),
  }),

  cancelled: (data: Omit<SessionCancelledEvent, "type" | "timestamp">): SessionCancelledEvent => ({
    type: "session_cancelled",
    ...data,
    timestamp: new Date().toISOString(),
  }),

  deleted: (data: Omit<SessionDeletedEvent, "type" | "timestamp">): SessionDeletedEvent => ({
    type: "session_deleted",
    ...data,
    timestamp: new Date().toISOString(),
  }),
}

/**
 * Helper to create session stream events
 */
export const createSessionEvent = {
  output: (chunk: AgentOutputChunk): AgentOutputEvent => ({
    type: "output",
    chunk,
    timestamp: new Date().toISOString(),
  }),

  statusChange: (status: SessionStatus): StatusChangeEvent => ({
    type: "status_change",
    status,
    timestamp: new Date().toISOString(),
  }),

  approvalRequest: (): ApprovalRequestEvent => ({
    type: "approval_request",
    timestamp: new Date().toISOString(),
  }),

  inputRequest: (): InputRequestEvent => ({
    type: "input_request",
    timestamp: new Date().toISOString(),
  }),

  cliSessionId: (cliSessionId: string): CLISessionIdEvent => ({
    type: "cli_session_id",
    cliSessionId,
    timestamp: new Date().toISOString(),
  }),

  daemonStarted: (pid: number, daemonNonce: string): DaemonStartedEvent => ({
    type: "daemon_started",
    pid,
    daemonNonce,
    timestamp: new Date().toISOString(),
  }),

  agentState: (
    agentType: "cerebras" | "gemini" | "opencode" | "openrouter",
    messages: unknown[]
  ): AgentStateEvent => ({
    type: "agent_state",
    agentType,
    messages,
    timestamp: new Date().toISOString(),
  }),
}

/**
 * Helper to create control stream events
 */
export const createControlEvent = {
  approvalResponse: (approved: boolean): ApprovalResponseEvent => ({
    type: "approval_response",
    approved,
    timestamp: new Date().toISOString(),
  }),

  inputResponse: (input: string): InputResponseEvent => ({
    type: "input_response",
    input,
    timestamp: new Date().toISOString(),
  }),

  cancel: (): CancelCommandEvent => ({
    type: "cancel",
    timestamp: new Date().toISOString(),
  }),
}
