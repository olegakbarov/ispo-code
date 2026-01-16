/**
 * Cancelling Sessions Store
 *
 * Tracks session IDs that are currently being cancelled.
 * Used to prevent race condition where 2s polling refetch
 * re-adds a session before server completes cancellation.
 */

import { create } from 'zustand'

interface CancellingSessionsState {
  /** Set of session IDs currently being cancelled */
  cancellingIds: Set<string>
  /** Add a session to the cancelling set */
  addCancelling: (sessionId: string) => void
  /** Remove a session from the cancelling set */
  removeCancelling: (sessionId: string) => void
}

export const useCancellingSessionsStore = create<CancellingSessionsState>((set) => ({
  cancellingIds: new Set(),
  addCancelling: (sessionId) =>
    set((state) => ({
      cancellingIds: new Set([...state.cancellingIds, sessionId]),
    })),
  removeCancelling: (sessionId) =>
    set((state) => {
      const newSet = new Set(state.cancellingIds)
      newSet.delete(sessionId)
      return { cancellingIds: newSet }
    }),
}))
