/**
 * Global Hotkey Keymap
 *
 * Defines default keybindings for common operations.
 * Uses platform-aware modifiers (Cmd on Mac, Ctrl elsewhere).
 */

export interface HotkeyDefinition {
  /** Key combination (e.g., 'cmd+n', 'shift+?') */
  keys: string
  /** Human-readable description */
  description: string
  /** Category for grouping in documentation */
  category: 'navigation' | 'tasks' | 'general'
  /** Only active when this route pattern matches (regex) */
  routePattern?: RegExp
}

/**
 * Global keymap - defines all available hotkeys
 */
export const KEYMAP = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // Navigation
  // ═══════════════════════════════════════════════════════════════════════════════

  /** Focus filter input in task list sidebar */
  FOCUS_FILTER: {
    keys: 'cmd+f,ctrl+f',
    description: 'Focus task filter',
    category: 'navigation',
  } as HotkeyDefinition,

  /** Navigate to tasks (home) */
  GO_TO_TASKS: {
    keys: 'g t',
    description: 'Go to tasks',
    category: 'navigation',
  } as HotkeyDefinition,

  // ═══════════════════════════════════════════════════════════════════════════════
  // Task Actions (only active on /tasks routes)
  // ═══════════════════════════════════════════════════════════════════════════════

  /** Create new task */
  NEW_TASK: {
    keys: 'c',
    description: 'Create new task',
    category: 'tasks',
    routePattern: /^\/tasks/,
  } as HotkeyDefinition,

  /** Run implementation for selected task */
  RUN_IMPLEMENT: {
    keys: 'i',
    description: 'Implement task',
    category: 'tasks',
    routePattern: /^\/tasks\/.+/,
  } as HotkeyDefinition,

  /** Run verification for selected task */
  RUN_VERIFY: {
    keys: 'v',
    description: 'Verify task',
    category: 'tasks',
    routePattern: /^\/tasks\/.+/,
  } as HotkeyDefinition,

  /** Open review/commit UI for selected task */
  REVIEW_TASK: {
    keys: 'r',
    description: 'Review task',
    category: 'tasks',
    routePattern: /^\/tasks\/.+/,
  } as HotkeyDefinition,
} as const

export type HotkeyAction = keyof typeof KEYMAP

/**
 * Check if a hotkey should be active given the current route
 */
export function isHotkeyActive(hotkey: HotkeyDefinition, pathname: string): boolean {
  if (!hotkey.routePattern) return true
  return hotkey.routePattern.test(pathname)
}
