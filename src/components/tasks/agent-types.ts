/**
 * Type definitions for agent sessions in tasks
 */

export interface AgentSession {
  id: string
  status: string
  prompt: string
  title?: string
  output: Array<{ type: string; content: string; timestamp: string }>
  error?: string
}
