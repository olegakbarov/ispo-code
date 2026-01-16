/**
 * Global Hotkeys Provider
 *
 * Registers app-wide keyboard shortcuts for navigation and common actions.
 * Must be mounted once in the app root.
 */

import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useHotkey } from '@/lib/hooks/use-hotkeys'
import { KEYMAP, isHotkeyActive } from '@/lib/hotkeys/keymap'

export function GlobalHotkeysProvider() {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  // ═══════════════════════════════════════════════════════════════════════════════
  // Navigation Hotkeys
  // ═══════════════════════════════════════════════════════════════════════════════

  // Focus task filter (Cmd/Ctrl+F)
  useHotkey({
    keys: KEYMAP.FOCUS_FILTER.keys,
    handler: () => {
      const filterInput = document.querySelector('[data-hotkey-target="task-filter"]') as HTMLInputElement
      if (filterInput) {
        filterInput.focus()
        filterInput.select()
      }
    },
    enabled: isHotkeyActive(KEYMAP.FOCUS_FILTER, pathname),
    preventDefault: true,
  })

  // Go to tasks (g then t)
  useHotkey({
    keys: KEYMAP.GO_TO_TASKS.keys,
    handler: () => {
      navigate({ to: '/tasks' })
    },
    enabled: isHotkeyActive(KEYMAP.GO_TO_TASKS, pathname),
    preventDefault: true,
  })

  // Create new task (c)
  useHotkey({
    keys: KEYMAP.NEW_TASK.keys,
    handler: () => {
      navigate({ to: '/tasks/new' })
    },
    enabled: isHotkeyActive(KEYMAP.NEW_TASK, pathname),
    preventDefault: true,
  })

  return null
}
