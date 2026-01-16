/**
 * Task CRUD Actions Hook
 *
 * Handles basic task operations:
 * - Delete
 * - Archive
 * - Restore
 * - Split task modal controls
 */

import { useCallback } from 'react'
import { trpc } from '@/lib/trpc-client'
import type { TasksAction } from '@/lib/stores/tasks-reducer'

interface UseTaskCRUDActionsParams {
  selectedPath: string | null
  dispatch: React.Dispatch<TasksAction>
  deleteMutation: ReturnType<typeof trpc.tasks.delete.useMutation>
  archiveMutation: ReturnType<typeof trpc.tasks.archive.useMutation>
  restoreMutation: ReturnType<typeof trpc.tasks.restore.useMutation>
  splitTaskMutation: ReturnType<typeof trpc.tasks.splitTask.useMutation>
}

export function useTaskCRUDActions({
  selectedPath,
  dispatch,
  deleteMutation,
  archiveMutation,
  restoreMutation,
  splitTaskMutation,
}: UseTaskCRUDActionsParams) {
  // ─────────────────────────────────────────────────────────────────────────────
  // Delete Handler
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!selectedPath) return

    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      payload: {
        open: true,
        title: 'Delete Task',
        message: 'Are you sure you want to delete this task?',
        confirmText: 'Delete',
        variant: 'danger',
        onConfirm: async () => {
          try {
            await deleteMutation.mutateAsync({ path: selectedPath })
          } catch (err) {
            console.error('Failed to delete task:', err)
          }
        },
      },
    })
  }, [selectedPath, deleteMutation, dispatch])

  // ─────────────────────────────────────────────────────────────────────────────
  // Archive/Restore Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleArchive = useCallback(async () => {
    if (!selectedPath) return

    dispatch({
      type: 'SET_CONFIRM_DIALOG',
      payload: {
        open: true,
        title: 'Archive Task',
        message: 'Archive this task? It will be moved to tasks/archive/',
        confirmText: 'Archive',
        variant: 'default',
        onConfirm: async () => {
          try {
            await archiveMutation.mutateAsync({ path: selectedPath })
          } catch (err) {
            console.error('Failed to archive task:', err)
          }
        },
      },
    })
  }, [selectedPath, archiveMutation, dispatch])

  const handleRestore = useCallback(async () => {
    if (!selectedPath) return
    try {
      await restoreMutation.mutateAsync({ path: selectedPath })
    } catch (err) {
      console.error('Failed to restore task:', err)
    }
  }, [selectedPath, restoreMutation])

  // ─────────────────────────────────────────────────────────────────────────────
  // Split Task Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleOpenSplitModal = useCallback(() => {
    dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: true })
  }, [dispatch])

  const handleCloseSplitModal = useCallback(() => {
    dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: false })
  }, [dispatch])

  const handleSplitTask = useCallback(async (sectionIndices: number[], archiveOriginal: boolean) => {
    if (!selectedPath) return

    try {
      await splitTaskMutation.mutateAsync({
        sourcePath: selectedPath,
        sectionIndices,
        archiveOriginal,
      })
    } catch (err) {
      console.error('Failed to split task:', err)
    }
  }, [selectedPath, splitTaskMutation])

  return {
    handleDelete,
    handleArchive,
    handleRestore,
    handleOpenSplitModal,
    handleCloseSplitModal,
    handleSplitTask,
  }
}
