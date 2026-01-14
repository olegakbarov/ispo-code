/**
 * Session Resumption Tests
 *
 * These tests verify the session resumption functionality across all agent types.
 *
 * To run these tests:
 * 1. Install a test framework (e.g., Vitest): `pnpm add -D vitest @vitest/ui`
 * 2. Add test script to package.json: `"test": "vitest"`
 * 3. Run: `pnpm test`
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAgentManager } from './manager'
import { getSessionStore } from './session-store'

describe('Session Resumption', () => {
  beforeEach(() => {
    // Clear session store before each test
    const store = getSessionStore()
    const sessions = store.getAllSessions()
    for (const session of sessions) {
      store.deleteSession(session.id)
    }
  })

  describe('Manager.sendMessage()', () => {
    it('should reject resume for non-existent session', async () => {
      const manager = getAgentManager()
      const result = await manager.sendMessage('non-existent-id', 'test message')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should reject resume for cancelled session', async () => {
      const manager = getAgentManager()

      // Create and cancel a session
      const session = await manager.spawn({ prompt: 'test', agentType: 'cerebras' })
      manager.cancel(session.id)

      // Try to resume
      const result = await manager.sendMessage(session.id, 'test message')

      expect(result.success).toBe(false)
      expect(result.error).toContain('cancelled')
    })

    it('should reject resume for session without cliSessionId (CLI agents)', async () => {
      const manager = getAgentManager()

      // Create a session without cliSessionId
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'claude' as const,
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Try to resume
      const result = await manager.sendMessage(session.id, 'test message')

      expect(result.success).toBe(false)
      expect(result.error).toContain('cliSessionId')
    })

    it('should accept resume for valid session', async () => {
      const manager = getAgentManager()

      // Create a session with cliSessionId
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'cerebras' as const,
        cerebrasMessages: [
          { role: 'system', content: 'You are an assistant' },
          { role: 'user', content: 'test' },
          { role: 'assistant', content: 'response' },
        ],
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Resume (this will start the agent but we're just checking validation)
      const result = await manager.sendMessage(session.id, 'follow-up message')

      expect(result.success).toBe(true)
    })

    it('should track resume attempts', async () => {
      const manager = getAgentManager()

      // Create a session
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'cerebras' as const,
        cerebrasMessages: [
          { role: 'system', content: 'You are an assistant' },
        ],
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Check initial state
      expect(session.resumeAttempts).toBe(0)

      // Resume
      await manager.sendMessage(session.id, 'follow-up 1')

      // Check updated state
      const updated = store.getSession(session.id)
      expect(updated?.resumeAttempts).toBe(1)
      expect(updated?.lastResumedAt).toBeDefined()
      expect(updated?.resumeHistory).toHaveLength(1)
      expect(updated?.resumeHistory?.[0].message).toBe('follow-up 1')
    })

    it('should reject empty messages', async () => {
      const manager = getAgentManager()

      // Create a session
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'cerebras' as const,
        cerebrasMessages: [
          { role: 'system', content: 'You are an assistant' },
        ],
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Try to send empty message
      const result = await manager.sendMessage(session.id, '   ')

      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })
  })

  describe('Cerebras Agent Resume', () => {
    it('should validate message history before resume', async () => {
      const { CerebrasAgent } = await import('./cerebras')

      // Create agent without messages
      const agent = new CerebrasAgent({
        workingDir: process.cwd(),
      })

      // Try to resume - should fail validation
      const emitSpy = vi.spyOn(agent, 'emit')
      await agent.resume('test message')

      expect(emitSpy).toHaveBeenCalledWith('error', expect.stringContaining('No message history'))
    })

    it('should prune messages when approaching context limit', async () => {
      const { CerebrasAgent } = await import('./cerebras')

      // Create agent with many messages
      const messages = [
        { role: 'system' as const, content: 'You are an assistant' },
      ]

      // Add many large messages to exceed context threshold
      for (let i = 0; i < 100; i++) {
        messages.push({
          role: 'user' as const,
          content: 'This is a test message. '.repeat(1000),
        })
        messages.push({
          role: 'assistant' as const,
          content: 'This is a response. '.repeat(1000),
        })
      }

      const agent = new CerebrasAgent({
        workingDir: process.cwd(),
        messages,
      })

      const originalLength = agent.getMessages().length

      // Trigger pruning
      await agent.resume('follow-up message')

      const newLength = agent.getMessages().length

      // Should have fewer messages after pruning
      expect(newLength).toBeLessThan(originalLength)

      // Should still have system prompt
      const hasSystem = agent.getMessages().some(m => m.role === 'system')
      expect(hasSystem).toBe(true)
    })

    it('should estimate tokens correctly', () => {
      // This is a simple test - real tokenization is more complex
      const { CerebrasAgent } = require('./cerebras')

      const agent = new CerebrasAgent({
        workingDir: process.cwd(),
      })

      // Create a test message
      const message = {
        role: 'user' as const,
        content: 'This is a test message with approximately 10 words.',
      }

      // Estimate should be reasonable (roughly chars / 4)
      const estimate = agent['estimateTokens'](message)
      expect(estimate).toBeGreaterThan(0)
      expect(estimate).toBeLessThan(message.content.length)
    })
  })

  describe('CLI Agent Resume', () => {
    it('should handle resume failures gracefully', async () => {
      // This test documents expected behavior
      // Actual CLI testing requires mocking subprocess execution

      const manager = getAgentManager()

      // Create a session with cliSessionId
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'claude' as const,
        cliSessionId: 'test-cli-session',
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Expected: If CLI resume fails, manager should:
      // 1. Emit error event
      // 2. Update resume history with failure
      // 3. Not crash or hang
      // 4. Allow new session to be spawned

      // This would require mocking the CLI subprocess
      // For now, we document the expected behavior
    })
  })

  describe('Session Persistence', () => {
    it('should persist resume state across restarts', () => {
      const store = getSessionStore()

      // Create a session with resume history
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'cerebras' as const,
        resumable: true,
        resumeAttempts: 2,
        lastResumedAt: new Date().toISOString(),
        resumeHistory: [
          {
            timestamp: new Date().toISOString(),
            message: 'first follow-up',
            success: true,
          },
          {
            timestamp: new Date().toISOString(),
            message: 'second follow-up',
            success: false,
            error: 'CLI session expired',
          },
        ],
      }
      store.createSession(session)

      // Simulate app restart by getting a new store instance
      // (in real scenario, this would be a new process)
      const newStore = getSessionStore()
      const retrieved = newStore.getSession('test-session')

      expect(retrieved).toBeDefined()
      expect(retrieved?.resumable).toBe(true)
      expect(retrieved?.resumeAttempts).toBe(2)
      expect(retrieved?.lastResumedAt).toBeDefined()
      expect(retrieved?.resumeHistory).toHaveLength(2)
      expect(retrieved?.resumeHistory?.[0].success).toBe(true)
      expect(retrieved?.resumeHistory?.[1].success).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent resume attempts', async () => {
      const manager = getAgentManager()

      // Create a session
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'cerebras' as const,
        cerebrasMessages: [
          { role: 'system', content: 'You are an assistant' },
        ],
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Try concurrent resumes
      const promises = [
        manager.sendMessage(session.id, 'message 1'),
        manager.sendMessage(session.id, 'message 2'),
      ]

      // Expected: Second attempt should fail because session is now running
      const results = await Promise.all(promises)

      const successCount = results.filter(r => r.success).length
      expect(successCount).toBeLessThanOrEqual(1)
    })

    it('should handle messages with special characters', async () => {
      const manager = getAgentManager()

      // Create a session
      const store = getSessionStore()
      const session = {
        id: 'test-session',
        prompt: 'test',
        status: 'completed' as const,
        startedAt: new Date().toISOString(),
        workingDir: process.cwd(),
        output: [],
        agentType: 'cerebras' as const,
        cerebrasMessages: [
          { role: 'system', content: 'You are an assistant' },
        ],
        resumable: true,
        resumeAttempts: 0,
        resumeHistory: [],
      }
      store.createSession(session)

      // Send message with special characters
      const specialMessage = 'Test with "quotes", \'apostrophes\', and\nnewlines'
      const result = await manager.sendMessage(session.id, specialMessage)

      expect(result.success).toBe(true)

      // Verify message was stored correctly
      const updated = store.getSession(session.id)
      expect(updated?.messages?.[updated.messages.length - 1].content).toBe(specialMessage)
    })
  })
})

/**
 * Integration Test Example
 *
 * This demonstrates how to test a full resume cycle:
 *
 * ```typescript
 * describe('Full Resume Cycle', () => {
 *   it('should complete spawn -> resume -> complete cycle', async () => {
 *     const manager = getAgentManager()
 *
 *     // Spawn initial session
 *     const session = await manager.spawn({
 *       prompt: 'Create a simple hello world function',
 *       agentType: 'cerebras',
 *     })
 *
 *     // Wait for completion
 *     await waitForStatus(session.id, 'completed')
 *
 *     // Resume with follow-up
 *     await manager.sendMessage(session.id, 'Add error handling')
 *
 *     // Wait for completion again
 *     await waitForStatus(session.id, 'completed')
 *
 *     // Verify state
 *     const final = manager.getSession(session.id)
 *     expect(final?.resumeAttempts).toBe(1)
 *     expect(final?.resumeHistory).toHaveLength(1)
 *     expect(final?.resumeHistory?.[0].success).toBe(true)
 *   })
 * })
 *
 * async function waitForStatus(sessionId: string, status: string, timeout = 30000) {
 *   const start = Date.now()
 *   while (Date.now() - start < timeout) {
 *     const session = getAgentManager().getSession(sessionId)
 *     if (session?.status === status) return
 *     await sleep(100)
 *   }
 *   throw new Error(`Timeout waiting for status ${status}`)
 * }
 *
 * function sleep(ms: number) {
 *   return new Promise(resolve => setTimeout(resolve, ms))
 * }
 * ```
 */