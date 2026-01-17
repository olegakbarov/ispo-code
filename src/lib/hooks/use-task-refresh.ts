/**
 * Task Refresh Effects Hook
 *
 * Handles task content loading and refreshing:
 * - Load content when task changes
 * - Live-refresh while agent is active
 * - Final refresh on agent completion
 */

import { useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc-client'
import type { TasksAction, EditorState } from '@/lib/stores/tasks-reducer'
import { useTaskTRPCClient } from '@/lib/hooks/use-task-client'

interface UseTaskRefreshParams {
  selectedPath: string | null
  workingDir: string | undefined
  activeSessionId: string | undefined
  editor: EditorState
  dispatch: React.Dispatch<TasksAction>
}

export function useTaskRefresh({
  selectedPath,
  workingDir,
  activeSessionId,
  editor,
  dispatch,
}: UseTaskRefreshParams) {
  const utils = trpc.useUtils()
  const taskClient = useTaskTRPCClient(selectedPath)
  const lastLoadedPathRef = useRef<string | null>(null)

  // ─────────────────────────────────────────────────────────────────────────────
  // Load Content on Task Change
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedPath || !workingDir) return
    if (lastLoadedPathRef.current === selectedPath) return

    // Check if we have optimistic data cached
    const cachedTask = utils.tasks.get.getData({ path: selectedPath })
    if (cachedTask) {
      // Use cached optimistic content immediately
      dispatch({ type: 'SET_DRAFT', payload: cachedTask.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
      lastLoadedPathRef.current = selectedPath
      return
    }

    // Otherwise fetch from server
    const client = taskClient ?? utils.client
    client.tasks.get.query({ path: selectedPath }).then((task) => {
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
      lastLoadedPathRef.current = selectedPath
    }).catch((err) => {
      console.error('Failed to load task:', err)
      dispatch({ type: 'SET_DRAFT', payload: `# Error\n\nFailed to load task content.` })
      lastLoadedPathRef.current = selectedPath
    })
  }, [selectedPath, workingDir, taskClient, utils.client, utils.tasks.get, dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Live-refresh While Agent Active
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedPath || !workingDir) return
    if (!activeSessionId) return
    if (editor.dirty) return

    const interval = globalThis.setInterval(() => {
      const client = taskClient ?? utils.client
      client.tasks.get.query({ path: selectedPath }).then((task) => {
        dispatch({ type: 'SET_DRAFT', payload: task.content })
        dispatch({ type: 'SET_DIRTY', payload: false })
      }).catch((err) => {
        console.error('Failed to refresh task:', err)
      })
    }, 2000)

    return () => globalThis.clearInterval(interval)
  }, [selectedPath, workingDir, activeSessionId, editor.dirty, taskClient, utils.client, dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // One Last Refresh on Agent Completion
  // ─────────────────────────────────────────────────────────────────────────────

  const prevActiveSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedPath || !workingDir) return

    const prev = prevActiveSessionIdRef.current
    const current = activeSessionId ?? null
    prevActiveSessionIdRef.current = current

    if (!prev || current) return
    if (editor.dirty) return

    const client = taskClient ?? utils.client
    client.tasks.get.query({ path: selectedPath }).then((task) => {
      dispatch({ type: 'SET_DRAFT', payload: task.content })
      dispatch({ type: 'SET_DIRTY', payload: false })
    }).catch((err) => {
      console.error('Failed to refresh task after agent completion:', err)
    })
  }, [selectedPath, workingDir, activeSessionId, editor.dirty, taskClient, utils.client, dispatch])

  return {
    lastLoadedPathRef,
    utils,
  }
}
