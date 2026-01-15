/**
 * Agent session status constants and helpers
 */

import type { SessionStatus } from './types'

/**
 * Statuses considered "active" (session is doing something)
 */
export const ACTIVE_STATUSES: SessionStatus[] = [
  'pending',
  'running',
  'working',
  'waiting_approval',
  'waiting_input',
  'idle',
]

/**
 * Statuses considered "terminal" (session is done)
 */
export const TERMINAL_STATUSES: SessionStatus[] = [
  'completed',
  'failed',
  'cancelled',
]

/**
 * Check if a status is active
 */
export function isActiveStatus(status: SessionStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

/**
 * Check if a status is terminal
 */
export function isTerminalStatus(status: SessionStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/**
 * Statuses that should display an animated spinner
 */
export const SPINNER_STATUSES: SessionStatus[] = ['running', 'working']

/**
 * Check if a status should show a spinner
 */
export function isSpinnerStatus(status: SessionStatus): boolean {
  return SPINNER_STATUSES.includes(status)
}

/**
 * Status dot color mapping for UI
 * Note: running/working use text-* colors for spinner (border-current inherits text color)
 */
export const statusColors: Record<SessionStatus, string> = {
  working: 'text-accent', // Spinner uses text color
  waiting_approval: 'bg-error animate-pulse',
  waiting_input: 'bg-green-500',
  idle: 'bg-green-500',
  pending: 'bg-muted-foreground',
  running: 'text-accent', // Spinner uses text color
  completed: 'bg-muted-foreground',
  failed: 'bg-error',
  cancelled: 'bg-muted-foreground',
}

/**
 * Get display label for status
 */
export function getStatusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    working: 'Working',
    waiting_approval: 'Needs Approval',
    waiting_input: 'Waiting for Input',
    idle: 'Idle',
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return labels[status]
}
