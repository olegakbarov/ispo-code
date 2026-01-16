/**
 * Debate tRPC Router
 * Handles multi-model adversarial spec review sessions
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import { getTask, saveTask } from "@/lib/agent/task-service"
import {
  createDebateOrchestrator,
  type DebateSession,
  type DebateRound,
  type DebateConfig,
  type DebatePersona,
  DEFAULT_DEBATE_CONFIG,
  PERSONA_LABELS,
  saveDebate,
  loadDebate,
  deleteDebate,
} from "@/lib/debate"
import { agentTypeSchema, type AgentType } from "@/lib/agent/types"

/**
 * In-memory store for active debate sessions
 * Key: debateId, Value: { orchestrator, taskPath, session? }
 * Note: session is stored for resumed debates to preserve full state
 */
const activeDebates = new Map<string, {
  orchestrator: ReturnType<typeof createDebateOrchestrator>
  taskPath: string
  session?: DebateSession // For resumed debates with full state
}>()

/**
 * Zod schema for debate agent config
 */
const debateAgentSchema = z.object({
  agentType: agentTypeSchema,
  model: z.string().optional(),
  persona: z.enum(["security", "oncall", "pm", "performance", "qa"]),
})

/**
 * Zod schema for debate config
 */
const debateConfigSchema = z.object({
  agents: z.array(debateAgentSchema).min(1).max(5),
  maxRounds: z.number().min(1).max(10).default(3),
  consensusThreshold: z.number().min(0).max(1).default(0.67),
  autoSynthesize: z.boolean().default(true),
  synthesisAgent: z.object({
    agentType: agentTypeSchema,
    model: z.string().optional(),
  }).optional(),
})

export const debateRouter = router({
  /**
   * Start a new debate session for a task (or resume existing)
   */
  start: procedure
    .input(z.object({
      path: z.string().min(1),
      config: debateConfigSchema.optional(),
    }))
    .mutation(({ ctx, input }): { debateId: string; session: DebateSession; resumed: boolean } => {
      // Check for existing debate on disk
      const existingSession = loadDebate(ctx.workingDir, input.path)

      if (existingSession && existingSession.status !== 'completed') {
        // Resume existing debate - recreate orchestrator from saved state
        const orchestrator = createDebateOrchestrator(
          existingSession.taskPath,
          existingSession.originalSpec,
          existingSession.config
        )

        // Restore session state into orchestrator
        // Note: orchestrator.getSession() returns a copy, so we need to store the full session
        activeDebates.set(existingSession.id, {
          orchestrator,
          taskPath: existingSession.taskPath,
          session: existingSession, // Store the full session for state recovery
        })

        return {
          debateId: existingSession.id,
          session: existingSession,
          resumed: true,
        }
      }

      // Load the task content for new debate
      const task = getTask(ctx.workingDir, input.path)

      // Build config from input or use defaults
      const config: DebateConfig = input.config
        ? {
            agents: input.config.agents.map(a => ({
              agentType: a.agentType as AgentType,
              model: a.model,
              persona: a.persona as DebatePersona,
            })),
            maxRounds: input.config.maxRounds,
            consensusThreshold: input.config.consensusThreshold,
            autoSynthesize: input.config.autoSynthesize,
            synthesisAgent: input.config.synthesisAgent
              ? {
                  agentType: input.config.synthesisAgent.agentType as AgentType,
                  model: input.config.synthesisAgent.model,
                }
              : undefined,
          }
        : DEFAULT_DEBATE_CONFIG

      // Create orchestrator
      const orchestrator = createDebateOrchestrator(input.path, task.content, config)
      const session = orchestrator.getSession()

      // Store in active debates
      activeDebates.set(session.id, { orchestrator, taskPath: input.path })

      // Persist to disk
      saveDebate(ctx.workingDir, session)

      return {
        debateId: session.id,
        session,
        resumed: false,
      }
    }),

  /**
   * Run the next round of debate
   */
  nextRound: procedure
    .input(z.object({
      debateId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }): Promise<{ round: DebateRound | null; session: DebateSession }> => {
      const debate = activeDebates.get(input.debateId)
      if (!debate) {
        throw new Error(`Debate session not found: ${input.debateId}`)
      }

      const round = await debate.orchestrator.runRound()
      const session = debate.orchestrator.getSession()

      // Persist updated state to disk
      saveDebate(ctx.workingDir, session)

      return {
        round,
        session,
      }
    }),

  /**
   * Run the full debate until consensus or max rounds
   */
  runFull: procedure
    .input(z.object({
      debateId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }): Promise<DebateSession> => {
      const debate = activeDebates.get(input.debateId)
      if (!debate) {
        throw new Error(`Debate session not found: ${input.debateId}`)
      }

      const session = await debate.orchestrator.runDebate()

      // Persist final state to disk
      saveDebate(ctx.workingDir, session)

      return session
    }),

  /**
   * Accept the current refined spec and save to task file
   */
  acceptSpec: procedure
    .input(z.object({
      debateId: z.string().min(1),
    }))
    .mutation(({ ctx, input }): { path: string; session: DebateSession } => {
      const debate = activeDebates.get(input.debateId)
      if (!debate) {
        throw new Error(`Debate session not found: ${input.debateId}`)
      }

      const session = debate.orchestrator.acceptSpec()

      // Save refined spec to task file
      saveTask(ctx.workingDir, debate.taskPath, session.currentSpec)

      // Clean up: remove from memory and disk
      activeDebates.delete(input.debateId)
      deleteDebate(ctx.workingDir, debate.taskPath)

      return {
        path: debate.taskPath,
        session,
      }
    }),

  /**
   * Abort a running debate
   */
  abort: procedure
    .input(z.object({
      debateId: z.string().min(1),
    }))
    .mutation(({ input }): DebateSession => {
      const debate = activeDebates.get(input.debateId)
      if (!debate) {
        throw new Error(`Debate session not found: ${input.debateId}`)
      }

      debate.orchestrator.abort()
      return debate.orchestrator.getSession()
    }),

  /**
   * Get current state of a debate session by ID
   */
  get: procedure
    .input(z.object({
      debateId: z.string().min(1),
    }))
    .query(({ input }): DebateSession | null => {
      const debate = activeDebates.get(input.debateId)
      return debate?.orchestrator.getSession() ?? null
    }),

  /**
   * Get debate for a specific task (from disk or memory)
   * This is the primary way to check if a task has an active debate
   */
  getForTask: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(({ ctx, input }): DebateSession | null => {
      // First check memory (active running debates)
      for (const [, debate] of activeDebates) {
        if (debate.taskPath === input.path) {
          return debate.session ?? debate.orchestrator.getSession()
        }
      }

      // Fall back to disk (persisted debates)
      return loadDebate(ctx.workingDir, input.path)
    }),

  /**
   * Discard debate without saving changes
   */
  discard: procedure
    .input(z.object({
      debateId: z.string().min(1),
    }))
    .mutation(({ ctx, input }): { discarded: boolean } => {
      const debate = activeDebates.get(input.debateId)
      const existed = !!debate

      if (debate) {
        // Clean up: remove from memory and disk
        activeDebates.delete(input.debateId)
        deleteDebate(ctx.workingDir, debate.taskPath)
      }

      return { discarded: existed }
    }),

  /**
   * Get available personas with labels
   */
  getPersonas: procedure.query(() => {
    return Object.entries(PERSONA_LABELS).map(([id, label]) => ({
      id: id as DebatePersona,
      label,
    }))
  }),

  /**
   * Get default debate config
   */
  getDefaultConfig: procedure.query(() => {
    return DEFAULT_DEBATE_CONFIG
  }),
})
