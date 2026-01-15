/**
 * Agent Module - Multi-agent orchestration system
 *
 * Supports multiple agent backends:
 * - Cerebras GLM (tool-calling via SDK)
 * - OpenCode SDK (embedded server)
 * - Claude CLI (subprocess)
 * - Codex CLI (subprocess)
 * - MCPorter (MCP-powered QA agent)
 */

// Types
export * from "./types"

// Core
export { getAgentManager, AgentManager } from "./manager"
export { getSessionStore } from "./session-store"

// Git utilities
export { getGitStatus, getFileDiff, getStagedDiff } from "./git-service"
export type { GitStatus } from "./git-service"

// Agent implementations
export { CerebrasAgent, createCerebrasAgent, CEREBRAS_MODELS } from "./cerebras"
export type { CerebrasAgentOptions, CerebrasEvents } from "./cerebras"

export { GeminiAgent, createGeminiAgent, GEMINI_MODELS } from "./gemini"
export type { GeminiAgentOptions, GeminiEvents } from "./gemini"

export { OpencodeAgent, createOpencodeAgent } from "./opencode"
export type { OpencodeAgentOptions, OpencodeEvents } from "./opencode"

export { MCPorterAgent, createMCPorterAgent, isMCPorterAvailable, checkMCPorterAvailableSync, MCPORTER_MODELS } from "./mcporter"
export type { MCPorterAgentOptions, MCPorterEvents } from "./mcporter"

// MCP Server validation
export {
  loadAndValidateConfigs,
  validateUrlFormat,
  validateHostname,
  isBlacklistedHost,
  createConnectionPool,
  MAX_CONNECTIONS_PER_SERVER,
  MAX_TOTAL_CONNECTIONS,
  IDLE_CONNECTION_TIMEOUT_MS,
  BLACKLISTED_HOSTS,
} from "./mcp-server-validator"
export type { MCPServerConfig, ValidationResult, ValidatedServer, ConnectionPoolState } from "./mcp-server-validator"

// CLI runner for subprocess agents
export { CLIAgentRunner, checkCLIAvailable, getAvailableAgentTypes } from "./cli-runner"

// Metadata analysis
export { MetadataAnalyzer } from "./metadata-analyzer"

// Task service
export { listTasks, getTask, saveTask, createTask, deleteTask } from "./task-service"
export type { TaskSource, TaskProgress, TaskSummary, TaskFile } from "./task-service"
