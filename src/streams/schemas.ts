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

export interface SessionCreatedEvent {
  type: "session_created"
  sessionId: string
  agentType: AgentType
  prompt: string
  workingDir: string
  model?: string
  taskPath?: string
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
