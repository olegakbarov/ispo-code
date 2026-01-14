/**
 * Agent tRPC Router
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import { getAgentManager } from "@/lib/agent/manager"

const agentTypeSchema = z.enum(["claude", "codex", "opencode", "cerebras"])

export const agentRouter = router({
  // === Queries ===

  list: procedure.query(() => {
    const manager = getAgentManager()
    return manager.getAllSessions()
  }),

  get: procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const manager = getAgentManager()
      return manager.getSession(input.id)
    }),

  /** Get session with metadata for thread sidebar display */
  getSessionWithMetadata: procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const manager = getAgentManager()
      const session = manager.getSession(input.id)
      if (!session) return null
      // Return session with metadata (metadata is computed by MetadataAnalyzer)
      return {
        ...session,
        metadata: session.metadata ?? null,
      }
    }),

  availableTypes: procedure.query(() => {
    const manager = getAgentManager()
    return manager.getAvailableAgentTypes()
  }),

  // === Mutations ===

  spawn: procedure
    .input(z.object({
      prompt: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      /** Model for opencode in format "provider/model" (e.g., "anthropic/claude-sonnet-4-20250514") */
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = getAgentManager()
      const session = await manager.spawn({
        prompt: input.prompt,
        workingDir: ctx.workingDir,
        agentType: input.agentType,
        model: input.model,
      })
      return { sessionId: session.id, status: session.status, agentType: session.agentType }
    }),

  cancel: procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const manager = getAgentManager()
      const success = manager.cancel(input.id)
      return { success }
    }),

  delete: procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const manager = getAgentManager()
      const success = manager.delete(input.id)
      return { success }
    }),

  /**
   * Send a follow-up message to an existing session (resume conversation)
   * TODO: Implement proper session resumption in manager
   */
  sendMessage: procedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // TODO: Implement sendMessage in AgentManager
      // This requires keeping the CLI process alive and writing to stdin
      console.warn(`sendMessage not yet implemented for session ${input.sessionId}`)
      return { success: false }
    }),

  /**
   * Send approval response to a running agent
   * TODO: Implement in manager with stdin support
   */
  approve: procedure
    .input(z.object({
      sessionId: z.string(),
      approved: z.boolean(),
    }))
    .mutation(({ input }) => {
      // TODO: Implement sendApproval in AgentManager
      console.warn(`approve not yet implemented for session ${input.sessionId}`)
      return { success: false }
    }),
})
