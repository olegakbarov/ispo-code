/**
 * Task Commit Effects Hook
 *
 * Handles commit message pregeneration and commit/archive modal:
 * - Pre-generate commit message on agent completion
 * - Pre-generate commit message on review mode entry
 * - Commit/archive modal controls
 * - Archive success navigation
 */

import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import type { TasksAction, EditorState } from '@/lib/stores/tasks-reducer'

interface TaskSummary {
  path: string
  title: string
  archived: boolean
}

interface AgentSession {
  status?: string
}

interface UseTaskCommitEffectsParams {
  selectedPath: string | null
  mode?: 'edit' | 'review' | 'debate'
  dispatch: React.Dispatch<TasksAction>
  editor: EditorState
  tasks: TaskSummary[]
  selectedSummary: TaskSummary | null
  agentSession: AgentSession | null
  pendingCommitGenerating: boolean
  pendingCommitMessage: string | null
  buildSearchParams: (overrideReviewFile?: string | null) => {
    archiveFilter: 'all' | 'active' | 'archived'
    sortBy?: 'updated' | 'title' | 'progress'
    sortDir?: 'asc' | 'desc'
    reviewFile?: string
  }
}

export function useTaskCommitEffects({
  selectedPath,
  mode,
  dispatch,
  editor,
  tasks,
  selectedSummary,
  agentSession,
  pendingCommitGenerating,
  pendingCommitMessage,
  buildSearchParams,
}: UseTaskCommitEffectsParams) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  // ─────────────────────────────────────────────────────────────────────────────
  // Commit/Archive Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleOpenCommitArchiveModal = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: true })
  }, [dispatch])

  const handleCloseCommitArchiveModal = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: false })
    if (selectedPath) {
      dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
    }
  }, [selectedPath, dispatch])

  const handleCommitSuccess = useCallback(() => {
    dispatch({ type: 'SET_COMMIT_ARCHIVE_OPEN', payload: false })
    if (selectedPath) {
      dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
    }
  }, [selectedPath, dispatch])

  const handleArchiveSuccess = useCallback(() => {
    const topmostTask = tasks.find(
      (t) => !t.archived && t.path !== selectedPath
    )
    if (topmostTask) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(topmostTask.path) },
        search: buildSearchParams() as any,
      })
    } else {
      navigate({ to: '/tasks', search: buildSearchParams() as any })
    }
  }, [tasks, selectedPath, navigate, buildSearchParams])

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-generate Commit Message - Shared Helper
  // ─────────────────────────────────────────────────────────────────────────────

  const triggerCommitMessageGeneration = useCallback(() => {
    if (!selectedPath) return
    if (pendingCommitGenerating || pendingCommitMessage) return

    dispatch({
      type: 'SET_PENDING_COMMIT_GENERATING',
      payload: { path: selectedPath, isGenerating: true },
    })

    // OPTIMIZED: Use getReviewData (same endpoint as review panel)
    utils.client.tasks.getReviewData
      .query({ path: selectedPath })
      .then((reviewData) => {
        const files = reviewData.changedFiles
        if (files.length === 0) {
          dispatch({ type: 'RESET_PENDING_COMMIT', payload: { path: selectedPath } })
          return
        }

        const gitRelativeFiles = files.map(
          (f) => f.repoRelativePath || f.relativePath || f.path
        )
        const taskTitle = selectedSummary?.title ?? 'Task'

        return utils.client.git.generateCommitMessage
          .mutate({
            taskTitle,
            taskDescription: editor.draft,
            files: gitRelativeFiles,
          })
          .then((result) => {
            dispatch({
              type: 'SET_PENDING_COMMIT_MESSAGE',
              payload: { path: selectedPath, message: result.message },
            })
          })
      })
      .catch((err) => {
        console.error('Failed to pre-generate commit message:', err)
      })
      .finally(() => {
        dispatch({
          type: 'SET_PENDING_COMMIT_GENERATING',
          payload: { path: selectedPath, isGenerating: false },
        })
      })
  }, [
    selectedPath,
    pendingCommitGenerating,
    pendingCommitMessage,
    selectedSummary?.title,
    editor.draft,
    utils.client.tasks.getReviewData,
    utils.client.git.generateCommitMessage,
    dispatch,
  ])

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-generate on Agent Completion
  // ─────────────────────────────────────────────────────────────────────────────

  const prevAgentStatusRef = useRef<Record<string, string | undefined>>({})

  useEffect(() => {
    if (!selectedPath) return

    const prevStatus = prevAgentStatusRef.current[selectedPath]
    const currentStatus = agentSession?.status
    prevAgentStatusRef.current[selectedPath] = currentStatus

    if (prevStatus === undefined) return

    const wasActive = prevStatus === 'running' || prevStatus === 'pending'
    const isNowCompleted = currentStatus === 'completed'

    if (wasActive && isNowCompleted) {
      triggerCommitMessageGeneration()
    }
  }, [selectedPath, agentSession?.status, triggerCommitMessageGeneration])

  // ─────────────────────────────────────────────────────────────────────────────
  // Pre-generate on Review Mode Entry
  // ─────────────────────────────────────────────────────────────────────────────

  const prevModeRef = useRef<string | undefined>(undefined)
  const prevReviewPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedPath) return

    const prevMode = prevModeRef.current
    const prevPath = prevReviewPathRef.current
    prevModeRef.current = mode

    // Update path ref only when in review mode
    if (mode === 'review') {
      prevReviewPathRef.current = selectedPath
    }

    // Trigger when:
    // 1. Initial mount in review mode (prevMode === undefined && mode === 'review')
    // 2. Transitioning TO review mode (prevMode !== 'review' && mode === 'review')
    // 3. Path change while in review mode (prevPath !== selectedPath && mode === 'review')
    const isEnteringReview = (prevMode === undefined || prevMode !== 'review') && mode === 'review'
    const isPathChangeInReview = prevPath !== null && prevPath !== selectedPath && mode === 'review'

    if (isEnteringReview || isPathChangeInReview) {
      triggerCommitMessageGeneration()
    }
  }, [selectedPath, mode, triggerCommitMessageGeneration])

  return {
    handleOpenCommitArchiveModal,
    handleCloseCommitArchiveModal,
    handleCommitSuccess,
    handleArchiveSuccess,
  }
}
