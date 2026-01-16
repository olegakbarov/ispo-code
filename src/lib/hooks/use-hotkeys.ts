/**
 * Hotkey Registration Hook
 *
 * Provides a simple API for components to register hotkey handlers.
 * Handles cleanup on unmount.
 */

import { useEffect, useRef } from 'react'

export interface HotkeyHandler {
  /** Key combination (comma-separated for alternatives, e.g., 'cmd+f,ctrl+f') */
  keys: string
  /** Handler function */
  handler: (event: KeyboardEvent) => void
  /** Optional: only trigger when conditions are met */
  enabled?: boolean
  /** Optional: prevent default browser behavior */
  preventDefault?: boolean
  /** Optional: stop event propagation */
  stopPropagation?: boolean
}

/**
 * Parse key combination and check if event matches
 */
function matchesKeys(keys: string, event: KeyboardEvent): boolean {
  // Support comma-separated alternatives (e.g., 'cmd+f,ctrl+f')
  const alternatives = keys.split(',').map((k) => k.trim())

  return alternatives.some((combo) => {
    const parts = combo.toLowerCase().split('+')
    const key = parts[parts.length - 1]
    const modifiers = parts.slice(0, -1)

    // Check key match
    const keyMatch = event.key.toLowerCase() === key

    // Check modifiers
    const cmdMatch = modifiers.includes('cmd') ? event.metaKey : true
    const ctrlMatch = modifiers.includes('ctrl') ? event.ctrlKey : true
    const shiftMatch = modifiers.includes('shift') ? event.shiftKey : true
    const altMatch = modifiers.includes('alt') ? event.altKey : true

    // Ensure no extra modifiers are pressed
    const noExtraCmd = !modifiers.includes('cmd') ? !event.metaKey : true
    const noExtraCtrl = !modifiers.includes('ctrl') ? !event.ctrlKey : true
    const noExtraShift = !modifiers.includes('shift') ? !event.shiftKey : true
    const noExtraAlt = !modifiers.includes('alt') ? !event.altKey : true

    return (
      keyMatch &&
      cmdMatch &&
      ctrlMatch &&
      shiftMatch &&
      altMatch &&
      noExtraCmd &&
      noExtraCtrl &&
      noExtraShift &&
      noExtraAlt
    )
  })
}

/**
 * Register a hotkey handler
 *
 * @example
 * ```tsx
 * useHotkey({
 *   keys: 'cmd+f,ctrl+f',
 *   handler: () => inputRef.current?.focus(),
 *   preventDefault: true,
 * })
 * ```
 */
export function useHotkey(config: HotkeyHandler) {
  const { keys, handler, enabled = true, preventDefault = false, stopPropagation = false } = config

  // Use ref to avoid recreating listener on every render
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const listener = (event: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = event.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Allow Cmd+F and Ctrl+F even in inputs (common pattern)
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'

      if (isInput && !isSearchShortcut) return

      if (matchesKeys(keys, event)) {
        if (preventDefault) event.preventDefault()
        if (stopPropagation) event.stopPropagation()
        handlerRef.current(event)
      }
    }

    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [keys, enabled, preventDefault, stopPropagation])
}

/**
 * Register multiple hotkey handlers at once
 *
 * @example
 * ```tsx
 * useHotkeys([
 *   { keys: 'cmd+s', handler: handleSave, preventDefault: true },
 *   { keys: 'escape', handler: handleCancel },
 * ])
 * ```
 */
export function useHotkeys(configs: HotkeyHandler[]) {
  configs.forEach((config) => useHotkey(config))
}
