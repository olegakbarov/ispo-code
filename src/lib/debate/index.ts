/**
 * Debate Module Exports
 * Multi-model adversarial spec review system
 */

export * from './types'
export * from './personas'
export * from './synthesis'
export { DebateOrchestrator, createDebateOrchestrator, type DebateEvents } from './orchestrator'
export { saveDebate, loadDebate, deleteDebate, debateExists, listActiveDebates } from './storage'
