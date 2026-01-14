/**
 * Skills Framework Types
 *
 * Skills are reusable agent behaviors that can be triggered by phrases
 * or programmatically. They orchestrate agents and tools to accomplish
 * complex multi-step tasks.
 */

import type { AgentManager } from "../agent/manager"
import type { AgentOutputChunk, AgentType } from "../agent/types"

/**
 * Event types emitted during skill execution
 */
export type SkillEventType =
  | "started"
  | "progress"
  | "subagent_spawned"
  | "subagent_completed"
  | "output"
  | "completed"
  | "failed"

/**
 * Progress event for tracking skill execution
 */
export interface SkillProgressEvent {
  type: "progress"
  phase: string
  message: string
  percent?: number
  timestamp: string
}

/**
 * Subagent spawn event
 */
export interface SkillSubagentSpawnEvent {
  type: "subagent_spawned"
  subagentId: string
  assignment: string
  timestamp: string
}

/**
 * Subagent completion event
 */
export interface SkillSubagentCompleteEvent {
  type: "subagent_completed"
  subagentId: string
  result: string
  timestamp: string
}

/**
 * Output event (text chunks from skill)
 */
export interface SkillOutputEvent {
  type: "output"
  chunk: AgentOutputChunk
  timestamp: string
}

/**
 * Skill started event
 */
export interface SkillStartedEvent {
  type: "started"
  skillName: string
  timestamp: string
}

/**
 * Skill completed event
 */
export interface SkillCompletedEvent {
  type: "completed"
  result: SkillResult
  timestamp: string
}

/**
 * Skill failed event
 */
export interface SkillFailedEvent {
  type: "failed"
  error: string
  timestamp: string
}

/**
 * Union of all skill events
 */
export type SkillEvent =
  | SkillStartedEvent
  | SkillProgressEvent
  | SkillSubagentSpawnEvent
  | SkillSubagentCompleteEvent
  | SkillOutputEvent
  | SkillCompletedEvent
  | SkillFailedEvent

/**
 * Result returned when a skill completes
 */
export interface SkillResult {
  success: boolean
  artifacts?: SkillArtifact[]
  summary?: string
  error?: string
}

/**
 * Artifact produced by a skill (files, reports, etc.)
 */
export interface SkillArtifact {
  type: "file" | "report" | "data"
  path?: string
  content?: string
  name: string
}

/**
 * Context provided to skill execution
 */
export interface SkillContext {
  /** Working directory for the skill */
  workingDir: string
  /** Agent manager for spawning subagents */
  agentManager: AgentManager
  /** Emit events during execution */
  emit: (event: SkillEvent) => void
  /** Optional parameters passed to the skill */
  params?: Record<string, unknown>
  /** Abort signal for cancellation */
  signal?: AbortSignal
}

/**
 * Skill definition
 */
export interface Skill {
  /** Unique skill identifier */
  name: string
  /** Human-readable display name */
  displayName: string
  /** Description of what the skill does */
  description: string
  /** Phrases that trigger this skill */
  triggers: string[]
  /** Agent type to use for subagents (default: claude) */
  subagentType?: AgentType
  /** Model to use for subagents */
  subagentModel?: string
  /** Execute the skill */
  execute: (context: SkillContext) => Promise<SkillResult>
}

/**
 * Skill execution status
 */
export type SkillExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

/**
 * Skill execution record
 */
export interface SkillExecution {
  id: string
  skillName: string
  status: SkillExecutionStatus
  startedAt: string
  completedAt?: string
  workingDir: string
  events: SkillEvent[]
  result?: SkillResult
  error?: string
}
