/**
 * Textarea Draft Persistence Hook
 *
 * Provides localStorage-backed state management for textarea drafts.
 * Drafts persist across page refreshes and are scoped per context (task, session, file, etc.)
 *
 * Usage:
 * ```tsx
 * const [draft, setDraft, clearDraft] = useTextareaDraft('task-editor:my-task.md')
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/lib/utils/debounce'

const STORAGE_PREFIX = 'agentz:draft:'

/**
 * Build a storage key from context components
 * @param context Unique identifier for the textarea context
 */
function buildStorageKey(context: string): string {
  return `${STORAGE_PREFIX}${context}`
}

/**
 * Hook for textarea draft persistence
 *
 * @param context Unique identifier for the textarea (e.g., 'task-editor:path/to/task.md')
 * @param serverValue Optional server-provided value that should override empty drafts
 * @param options Configuration options
 * @returns [draft, setDraft, clearDraft] tuple
 */
export function useTextareaDraft(
  context: string,
  serverValue?: string,
  options: {
    /** Debounce delay in ms for localStorage writes (default: 300) */
    debounceMs?: number
    /** Skip restoration on mount (useful when serverValue should always take precedence) */
    skipRestore?: boolean
  } = {}
): [string, (value: string) => void, () => void] {
  const { debounceMs = 300, skipRestore = false } = options
  const storageKey = buildStorageKey(context)
  const isInitializedRef = useRef(false)
  const serverValueRef = useRef(serverValue)

  // Update server value ref when it changes
  useEffect(() => {
    serverValueRef.current = serverValue
  }, [serverValue])

  // Initialize state - start with server value, restore from localStorage in useEffect
  const [draft, setDraftState] = useState<string>(serverValue ?? '')

  // Restore from localStorage on mount (client-side only)
  useEffect(() => {
    if (skipRestore || !context || typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        // Only restore draft if we don't have a server value, or if server value is empty
        if (!serverValue || serverValue.trim() === '') {
          setDraftState(stored)
        }
      }
    } catch (error) {
      console.warn('[useTextareaDraft] Failed to restore draft:', error)
    }
  }, []) // Only run once on mount

  // Mark as initialized after first mount
  useEffect(() => {
    isInitializedRef.current = true
  }, [])

  // Debounced localStorage write
  const debouncedSave = useDebouncedCallback(
    (key: string, value: string) => {
      try {
        if (value.trim() === '') {
          // Clear storage for empty values
          localStorage.removeItem(key)
        } else {
          localStorage.setItem(key, value)
        }
      } catch (error) {
        console.warn('[useTextareaDraft] Failed to save draft:', error)
      }
    },
    debounceMs
  )

  // Update draft and persist to localStorage
  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value)
      if (context) {
        debouncedSave(storageKey, value)
      }
    },
    [context, storageKey, debouncedSave]
  )

  // Clear draft from both state and storage
  const clearDraft = useCallback(() => {
    setDraftState('')
    if (context) {
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.warn('[useTextareaDraft] Failed to clear draft:', error)
      }
    }
  }, [context, storageKey])

  // Update draft when server value changes (but don't overwrite user's draft)
  useEffect(() => {
    // Skip if not initialized yet (handled by useState initializer)
    if (!isInitializedRef.current) return

    // Skip if no server value
    if (!serverValue) return

    // Only update if current draft is empty (user hasn't started typing)
    // This prevents overwriting user's local edits with server updates
    if (draft.trim() === '') {
      setDraftState(serverValue)
    }
  }, [serverValue, draft])

  // Cleanup: flush any pending writes when component unmounts
  useEffect(() => {
    return () => {
      debouncedSave.flush()
    }
  }, [debouncedSave])

  return [draft, setDraft, clearDraft]
}

/**
 * Clear all drafts from localStorage (useful for cleanup/testing)
 */
export function clearAllDrafts(): void {
  try {
    const keys = Object.keys(localStorage)
    const draftKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX))
    draftKeys.forEach((key) => localStorage.removeItem(key))
    console.log(`[useTextareaDraft] Cleared ${draftKeys.length} drafts`)
  } catch (error) {
    console.warn('[useTextareaDraft] Failed to clear all drafts:', error)
  }
}

/**
 * Get all draft contexts currently stored
 */
export function getAllDraftContexts(): string[] {
  try {
    const keys = Object.keys(localStorage)
    return keys
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .map((key) => key.slice(STORAGE_PREFIX.length))
  } catch (error) {
    console.warn('[useTextareaDraft] Failed to get draft contexts:', error)
    return []
  }
}
