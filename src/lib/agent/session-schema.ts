/**
 * Zod schemas for validating session data
 *
 * Validates session data loaded from disk to prevent crashes from corrupted data
 */

import { z } from "zod"
import { agentTypeSchema } from "./types"

/**
 * Schema for agent output chunks
 */
const AgentOutputChunkSchema = z.object({
  type: z.enum(["text", "tool_use", "tool_result", "system", "error", "thinking", "user_message"]),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

/**
 * Schema for conversation messages
 */
const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
})

/**
 * Schema for Cerebras message data
 */
const CerebrasMessageDataSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().nullable(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  tool_call_id: z.string().optional(),
})

/**
 * Schema for Gemini message data (Vercel AI SDK format)
 */
const GeminiMessageDataSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([
    z.string(),
    z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      toolCallId: z.string().optional(),
      toolName: z.string().optional(),
      args: z.unknown().optional(),
      result: z.unknown().optional(),
    })),
  ]),
})

/**
 * Schema for edited file info
 */
const EditedFileInfoSchema = z.object({
  path: z.string(),
  operation: z.enum(["create", "edit", "delete"]),
  timestamp: z.string(),
  toolUsed: z.string(),
  linesChanged: z.number().optional(),
  sizeBytes: z.number().optional(),
})

/**
 * Schema for context window info
 */
const ContextWindowInfoSchema = z.object({
  estimatedTokens: z.number(),
  modelLimit: z.number(),
  utilizationPercent: z.number(),
  includesToolResults: z.boolean().optional(),
})

/**
 * Schema for tool stats
 */
const ToolStatsSchema = z.object({
  totalCalls: z.number(),
  byTool: z.record(z.number()),
  byType: z.object({
    read: z.number(),
    write: z.number(),
    execute: z.number(),
    other: z.number(),
  }),
})

/**
 * Schema for output metrics
 */
const OutputMetricsSchema = z.object({
  textChunks: z.number(),
  thinkingChunks: z.number(),
  errorChunks: z.number(),
  systemChunks: z.number(),
  totalCharacters: z.number(),
  estimatedOutputTokens: z.number(),
  toolResultChunks: z.number().optional(),
  toolResultCharacters: z.number().optional(),
  estimatedToolResultTokens: z.number().optional(),
})

/**
 * Schema for top tool info
 */
const TopToolInfoSchema = z.object({
  tool: z.string(),
  count: z.number(),
  percent: z.number(),
})

/**
 * Schema for tool calls by type
 */
const ToolCallsByTypeSchema = z.object({
  read: z.number(),
  write: z.number(),
  execute: z.number(),
  other: z.number(),
})

/**
 * Schema for turn summary
 */
const TurnSummarySchema = z.object({
  index: z.number(),
  endedAt: z.string(),
  status: z.enum(['completed', 'failed', 'cancelled']),
  durationMs: z.number(),
})

/**
 * Schema for detailed turn info
 */
const DetailedTurnInfoSchema = z.object({
  index: z.number(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMs: z.number().optional(),
  status: z.enum(['pending', 'working', 'completed', 'failed', 'cancelled']).optional(),
  toolCalls: z.number(),
  toolCallsByType: ToolCallsByTypeSchema,
  uniqueEditedFilesCount: z.number(),
  editedFilesCount: z.number(),
  textCharacters: z.number(),
  toolResultCharacters: z.number(),
  topTools: z.array(TopToolInfoSchema),
})

/**
 * Schema for agent session metadata
 */
const AgentSessionMetadataSchema = z.object({
  contextWindow: ContextWindowInfoSchema,
  editedFiles: z.array(EditedFileInfoSchema),
  toolStats: ToolStatsSchema,
  outputMetrics: OutputMetricsSchema,
  duration: z.number(),
  taskPath: z.string().optional(),
  currentTurn: DetailedTurnInfoSchema.optional(),
  lastTurn: DetailedTurnInfoSchema.optional(),
  turns: z.array(TurnSummarySchema).optional(),
  userMessageCount: z.number(),
  assistantMessageCount: z.number(),
  messageCount: z.number(),
})

/**
 * Schema for a single agent session
 */
export const AgentSessionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  status: z.enum([
    "pending",
    "running",
    "working",
    "waiting_approval",
    "waiting_input",
    "idle",
    "completed",
    "failed",
    "cancelled",
  ]),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  workingDir: z.string(),
  worktreePath: z.string().optional(),
  worktreeBranch: z.string().optional(),
  output: z.array(AgentOutputChunkSchema),
  error: z.string().optional(),
  agentType: agentTypeSchema.optional(),
  model: z.string().optional(),
  metadata: AgentSessionMetadataSchema.nullable().optional(),
  tokensUsed: z.object({
    input: z.number(),
    output: z.number(),
  }).optional(),
  cliSessionId: z.string().optional(),
  messages: z.array(ConversationMessageSchema).optional(),
  cerebrasMessages: z.array(CerebrasMessageDataSchema).optional(),
  geminiMessages: z.array(GeminiMessageDataSchema).optional(),
  taskPath: z.string().optional(),
  planPath: z.string().optional(),
  resumable: z.boolean().optional(),
  lastResumedAt: z.string().optional(),
  resumeAttempts: z.number().optional(),
  resumeHistory: z.array(z.object({
    timestamp: z.string(),
    message: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  })).optional(),
})

/**
 * Schema for the sessions data file
 */
export const SessionsDataSchema = z.object({
  sessions: z.array(AgentSessionSchema),
})

/**
 * Type inference from schema
 */
export type ValidatedSessionsData = z.infer<typeof SessionsDataSchema>
export type ValidatedAgentSession = z.infer<typeof AgentSessionSchema>

/**
 * Validate sessions data with detailed error reporting
 *
 * @param data - Raw data to validate
 * @returns Validated sessions data
 * @throws {z.ZodError} if validation fails
 */
export function validateSessionsData(data: unknown): ValidatedSessionsData {
  return SessionsDataSchema.parse(data)
}

/**
 * Safely validate sessions data without throwing
 *
 * @param data - Raw data to validate
 * @returns Result object with success flag and data or error
 */
export function safeValidateSessionsData(data: unknown): {
  success: boolean
  data?: ValidatedSessionsData
  error?: string
} {
  try {
    const validated = SessionsDataSchema.parse(data)
    return { success: true, data: validated }
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errorMessages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
      return { success: false, error: errorMessages }
    }
    return { success: false, error: String(err) }
  }
}

/**
 * Create a backup of corrupted sessions file
 *
 * @param originalPath - Path to original file
 * @param backupPath - Path to save backup
 */
export function createSessionBackup(originalPath: string, backupPath: string): void {
  const fs = require("fs")
  try {
    if (fs.existsSync(originalPath)) {
      fs.copyFileSync(originalPath, backupPath)
      console.log(`[SessionSchema] Created backup at ${backupPath}`)
    }
  } catch (err) {
    console.error(`[SessionSchema] Failed to create backup:`, err)
  }
}
