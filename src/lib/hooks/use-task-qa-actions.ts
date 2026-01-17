/**
 * Task QA Actions Hook
 *
 * Handles QA workflow operations:
 * - Merge to main
 * - Set QA status (pass/fail)
 * - Revert merge
 * - Active worktree branch resolution
 */

import { useCallback, useMemo } from 'react'
import { trpc } from '@/lib/trpc-client'
import type { TasksAction } from '@/lib/stores/tasks-reducer'
import type { MergeHistoryEntry } from '@/lib/agent/task-service'

interface UseTaskQAActionsParams {
  selectedPath: string | null
  workingDir: string | null
  activeSessionId: string | null | undefined
  taskId?: string
  latestActiveMerge: MergeHistoryEntry | null | undefined
  dispatch: React.Dispatch<TasksAction>
  mergeBranchMutation: ReturnType<typeof trpc.git.mergeBranch.useMutation>
  recordMergeMutation: ReturnType<typeof trpc.tasks.recordMerge.useMutation>
  setQAStatusMutation: ReturnType<typeof trpc.tasks.setQAStatus.useMutation>
  revertMergeMutation: ReturnType<typeof trpc.git.revertMerge.useMutation>
  recordRevertMutation: ReturnType<typeof trpc.tasks.recordRevert.useMutation>
}

export function useTaskQAActions({
  selectedPath,
  workingDir,
  activeSessionId,
  taskId,
  latestActiveMerge,
  dispatch,
  mergeBranchMutation,
  recordMergeMutation,
  setQAStatusMutation,
  revertMergeMutation,
  recordRevertMutation,
}: UseTaskQAActionsParams) {
  const utils = trpc.useUtils()

  // ─────────────────────────────────────────────────────────────────────────────
  // QA Workflow Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleMergeSuccess = useCallback(() => {
    utils.tasks.get.invalidate()
    utils.tasks.getLatestActiveMerge.invalidate()
  }, [utils])

  const expectedWorktreeBranch = taskId
    ? `ispo-code/task-${taskId}`
    : (activeSessionId ? `ispo-code/session-${activeSessionId}` : undefined)
  const { data: branchData } = trpc.git.branches.useQuery(undefined, {
    enabled: !!workingDir && !!expectedWorktreeBranch,
  })
  const activeWorktreeBranch = useMemo(() => {
    if (!expectedWorktreeBranch || !branchData?.all) return undefined
    return branchData.all.includes(expectedWorktreeBranch) ? expectedWorktreeBranch : undefined
  }, [expectedWorktreeBranch, branchData?.all])

  const handleMergeToMain = useCallback(async () => {
    if (!selectedPath || !activeSessionId || !activeWorktreeBranch) return

    dispatch({ type: 'SET_SAVE_ERROR', payload: null })
    try {
      const mergeResult = await mergeBranchMutation.mutateAsync({
        targetBranch: 'main',
        sourceBranch: activeWorktreeBranch,
      })

      if (mergeResult.success && mergeResult.mergeCommitHash) {
        await recordMergeMutation.mutateAsync({
          path: selectedPath,
          sessionId: activeSessionId,
          commitHash: mergeResult.mergeCommitHash,
        })
      } else if (!mergeResult.success) {
        dispatch({ type: 'SET_SAVE_ERROR', payload: mergeResult.error || 'Merge failed' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Merge failed'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Merge to main failed:', err)
    }
  }, [
    selectedPath,
    activeSessionId,
    activeWorktreeBranch,
    mergeBranchMutation,
    recordMergeMutation,
    dispatch,
  ])

  const handleSetQAPass = useCallback(async () => {
    if (!selectedPath) return

    try {
      await setQAStatusMutation.mutateAsync({
        path: selectedPath,
        status: 'pass',
      })
    } catch (err) {
      console.error('Failed to set QA pass:', err)
    }
  }, [selectedPath, setQAStatusMutation])

  const handleSetQAFail = useCallback(async () => {
    if (!selectedPath) return

    try {
      await setQAStatusMutation.mutateAsync({
        path: selectedPath,
        status: 'fail',
      })
    } catch (err) {
      console.error('Failed to set QA fail:', err)
    }
  }, [selectedPath, setQAStatusMutation])

  const handleRevertMerge = useCallback(async () => {
    if (!selectedPath || !latestActiveMerge) return

    dispatch({ type: 'SET_SAVE_ERROR', payload: null })
    try {
      const revertResult = await revertMergeMutation.mutateAsync({
        mergeCommitHash: latestActiveMerge.commitHash,
      })

      if (revertResult.success && revertResult.revertCommitHash) {
        await recordRevertMutation.mutateAsync({
          path: selectedPath,
          mergeCommitHash: latestActiveMerge.commitHash,
          revertCommitHash: revertResult.revertCommitHash,
        })
      } else if (!revertResult.success) {
        dispatch({ type: 'SET_SAVE_ERROR', payload: revertResult.error || 'Revert failed' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Revert failed'
      dispatch({ type: 'SET_SAVE_ERROR', payload: msg })
      console.error('Revert merge failed:', err)
    }
  }, [
    selectedPath,
    latestActiveMerge,
    revertMergeMutation,
    recordRevertMutation,
    dispatch,
  ])

  return {
    handleMergeSuccess,
    activeWorktreeBranch,
    handleMergeToMain,
    handleSetQAPass,
    handleSetQAFail,
    handleRevertMerge,
  }
}
