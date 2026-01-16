/**
 * Task Mutations Hook
 *
 * Consolidates all task-related tRPC mutations from the tasks page.
 * Handles optimistic updates, cache invalidation, and navigation on success.
 */

import { startTransition } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { generateOptimisticTaskPath } from '@/lib/utils/slugify'
import type { TasksAction, EditorState } from '@/lib/stores/tasks-reducer'

interface UseTaskMutationsParams {
  dispatch: React.Dispatch<TasksAction>
  editor: EditorState
  buildSearchParams: (overrideReviewFile?: string | null) => {
    reviewFile?: string
  }
}

export function useTaskMutations({
  dispatch,
  editor,
  buildSearchParams,
}: UseTaskMutationsParams) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  // ─────────────────────────────────────────────────────────────────────────────
  // Save Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const saveMutation = trpc.tasks.save.useMutation({
    onMutate: async ({ path, content }) => {
      await utils.tasks.get.cancel({ path })
      const previousTask = utils.tasks.get.getData({ path })
      const previousDirty = editor.dirty

      dispatch({ type: 'SET_DIRTY', payload: false })
      dispatch({ type: 'SET_SAVE_ERROR', payload: null })

      if (previousTask) {
        utils.tasks.get.setData({ path }, { ...previousTask, content })
      }

      return { previousTask, previousDirty, path }
    },
    onError: (err, _variables, context) => {
      if (context?.previousTask) {
        utils.tasks.get.setData({ path: context.path }, context.previousTask)
      }
      if (context?.previousDirty !== undefined) {
        dispatch({ type: 'SET_DIRTY', payload: context.previousDirty })
      }
      dispatch({ type: 'SET_SAVE_ERROR', payload: err instanceof Error ? err.message : 'Failed to save' })
    },
    onSettled: (_data, _error, variables) => {
      utils.tasks.list.invalidate()
      utils.tasks.get.invalidate({ path: variables.path })
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Mutation (basic, no agent)
  // ─────────────────────────────────────────────────────────────────────────────

  const createMutation = trpc.tasks.create.useMutation({
    onMutate: async ({ title }) => {
      // Cancel in-flight queries to avoid race conditions
      await utils.tasks.list.cancel()
      await utils.tasks.get.cancel()

      // Store previous list for potential rollback
      const previousList = utils.tasks.list.getData()
      const existingPaths = new Set(previousList?.map(t => t.path) ?? [])

      // Generate optimistic path using shared slugify logic
      // NOTE: handleCreate already seeded the cache before navigation,
      // but onMutate may run asynchronously, so we recalculate for context
      const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

      return { previousList, optimisticPath }
    },
    onSuccess: (data, _variables, context) => {
      const serverPath = data.path
      const optimisticPath = context?.optimisticPath

      // If server path differs from optimistic, need to reconcile
      if (optimisticPath && serverPath !== optimisticPath) {
        // Remove optimistic cache entries (old path)
        utils.tasks.get.setData({ path: optimisticPath }, undefined)

        // Redirect to actual server path (path mismatch scenario)
        navigate({
          to: '/tasks/$',
          params: { _splat: encodeTaskPath(serverPath) },
          search: buildSearchParams(),
          replace: true, // Replace history entry to avoid back button going to invalid path
        })
      }
      // If path matched, no navigation needed (we already navigated in handleCreate)

      // Invalidate to get fresh data from server (non-urgent background refresh)
      startTransition(() => {
        utils.tasks.list.invalidate()
        utils.tasks.get.invalidate({ path: serverPath })
      })
    },
    onError: (_err, _variables, context) => {
      // Roll back optimistic updates (handleCreate also does rollback via onError)
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      if (context?.optimisticPath) {
        utils.tasks.get.setData({ path: context.optimisticPath }, undefined)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Create with Agent Mutation (single agent planning)
  // ─────────────────────────────────────────────────────────────────────────────

  const createWithAgentMutation = trpc.tasks.createWithAgent.useMutation({
    onMutate: async ({ title }) => {
      // Cancel in-flight queries to avoid race conditions
      await utils.tasks.list.cancel()
      await utils.tasks.get.cancel()

      // Store previous list for potential rollback
      const previousList = utils.tasks.list.getData()
      const existingPaths = new Set(previousList?.map(t => t.path) ?? [])

      // Generate optimistic path using shared slugify logic
      // NOTE: handleCreate already seeded the cache and navigated
      const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

      return { previousList, optimisticPath }
    },
    onSuccess: (data, _variables, context) => {
      const serverPath = data.path
      const optimisticPath = context?.optimisticPath

      // Clean up optimistic cache entry if path differs
      if (optimisticPath && serverPath !== optimisticPath) {
        utils.tasks.get.setData({ path: optimisticPath }, undefined)
      }

      // Invalidate to refresh with server data (non-urgent)
      startTransition(() => {
        utils.tasks.list.invalidate()
        utils.tasks.get.invalidate({ path: serverPath })
      })

      // Stay on task page - session will be visible in sidebar
      // No navigation needed, task already loaded from optimistic navigation
    },
    onError: (_err, _variables, context) => {
      // Rollback: restore previous list and remove optimistic task.get entry
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      if (context?.optimisticPath) {
        utils.tasks.get.setData({ path: context.optimisticPath }, undefined)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Debug with Agents Mutation (multi-agent debugging)
  // ─────────────────────────────────────────────────────────────────────────────

  const debugWithAgentsMutation = trpc.tasks.debugWithAgents.useMutation({
    onMutate: async ({ title }) => {
      // Cancel in-flight queries to avoid race conditions
      await utils.tasks.list.cancel()
      await utils.tasks.get.cancel()

      // Store previous list for potential rollback
      const previousList = utils.tasks.list.getData()
      const existingPaths = new Set(previousList?.map(t => t.path) ?? [])

      // Generate optimistic path using shared slugify logic
      // NOTE: handleCreate already seeded the cache and navigated
      const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

      return { previousList, optimisticPath }
    },
    onSuccess: (data, _variables, context) => {
      const serverPath = data.path
      const optimisticPath = context?.optimisticPath

      // Clean up optimistic cache entry if path differs
      if (optimisticPath && serverPath !== optimisticPath) {
        utils.tasks.get.setData({ path: optimisticPath }, undefined)
      }

      // Invalidate to refresh with server data (non-urgent)
      startTransition(() => {
        utils.tasks.list.invalidate()
        utils.tasks.get.invalidate({ path: serverPath })
      })

      // Set orchestrator triggered for debug runs
      if (data.debugRunId) {
        dispatch({ type: 'SET_ORCHESTRATOR_TRIGGERED', payload: data.debugRunId })
      }

      // Stay on task page - debug sessions will be visible in sidebar
      // No navigation needed, task already loaded from optimistic navigation
    },
    onError: (_err, _variables, context) => {
      // Rollback: restore previous list and remove optimistic task.get entry
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      if (context?.optimisticPath) {
        utils.tasks.get.setData({ path: context.optimisticPath }, undefined)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Delete Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const deleteMutation = trpc.tasks.delete.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.list.cancel()
      const previousList = utils.tasks.list.getData()

      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.filter((task) => task.path !== path))
      }

      return { previousList, path }
    },
    onSuccess: () => {
      utils.tasks.list.invalidate()
      navigate({ to: '/tasks', search: buildSearchParams() })
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Archive Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const archiveMutation = trpc.tasks.archive.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.list.cancel()
      const previousList = utils.tasks.list.getData()

      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === path
            ? { ...task, archived: true, archivedAt: new Date().toISOString() }
            : task
        ))
      }

      return { previousList, path }
    },
    onSuccess: (_data, _variables, context) => {
      utils.tasks.list.invalidate()
      const currentList = utils.tasks.list.getData() ?? []
      const topmostTask = currentList.find(
        (t) => !t.archived && t.path !== context?.path
      )
      if (topmostTask) {
        navigate({
          to: '/tasks/$',
          params: { _splat: encodeTaskPath(topmostTask.path) },
          search: buildSearchParams(),
        })
      } else {
        navigate({ to: '/tasks', search: buildSearchParams() })
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Restore Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const restoreMutation = trpc.tasks.restore.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.list.cancel()
      const previousList = utils.tasks.list.getData()

      if (previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === path
            ? { ...task, archived: false, archivedAt: undefined }
            : task
        ))
      }

      return { previousList, path }
    },
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(data.path) },
        search: buildSearchParams(),
      })
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Assign to Agent Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      utils.tasks.getActiveAgentSessions.setData(undefined, {
        ...(previousSessions ?? {}),
        [path]: {
          sessionId: `pending-${Date.now()}`,
          status: 'pending',
        },
      })

      return { previousSessions, path }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
    onSettled: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Cancel Agent Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const cancelAgentMutation = trpc.agent.cancel.useMutation({
    onMutate: async ({ id }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      if (previousSessions !== undefined) {
        const updatedSessions = { ...previousSessions }
        for (const [taskPath, session] of Object.entries(previousSessions)) {
          if (session.sessionId === id) {
            delete updatedSessions[taskPath]
            break
          }
        }
        utils.tasks.getActiveAgentSessions.setData(undefined, updatedSessions)
      }

      return { previousSessions }
    },
    onSuccess: (data, _variables, _context) => {
      console.log('[cancelAgentMutation] Success:', data)
      utils.tasks.list.invalidate()
    },
    onError: (error, _variables, context) => {
      console.error('[cancelAgentMutation] Error:', error)
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      }
    },
    onSettled: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
      utils.tasks.getSessionsForTask.invalidate()
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Verify with Agent Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const verifyWithAgentMutation = trpc.tasks.verifyWithAgent.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      utils.tasks.getActiveAgentSessions.setData(undefined, {
        ...(previousSessions ?? {}),
        [path]: {
          sessionId: `pending-verify-${Date.now()}`,
          status: 'pending',
        },
      })

      return { previousSessions, path }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
    onSettled: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Rewrite with Agent Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const rewriteWithAgentMutation = trpc.tasks.rewriteWithAgent.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      utils.tasks.getActiveAgentSessions.setData(undefined, {
        ...(previousSessions ?? {}),
        [path]: {
          sessionId: `pending-rewrite-${Date.now()}`,
          status: 'pending',
        },
      })

      return { previousSessions, path }
    },
    onSuccess: () => {
      // Stay on task page - rewrite session will be visible in sidebar
      // No navigation needed, already on task page
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
    onSettled: () => {
      utils.tasks.getActiveAgentSessions.invalidate()
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Split Task Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const splitTaskMutation = trpc.tasks.splitTask.useMutation({
    onMutate: async ({ sourcePath, archiveOriginal }) => {
      await utils.tasks.list.cancel()
      const previousList = utils.tasks.list.getData()

      if (archiveOriginal && previousList) {
        utils.tasks.list.setData(undefined, previousList.map((task) =>
          task.path === sourcePath
            ? { ...task, archived: true, archivedAt: new Date().toISOString() }
            : task
        ))
      }

      return { previousList, sourcePath }
    },
    onSuccess: (data) => {
      utils.tasks.list.invalidate()
      dispatch({ type: 'SET_SPLIT_MODAL_OPEN', payload: false })

      if (data.newPaths.length > 0) {
        navigate({
          to: '/tasks/$',
          params: { _splat: encodeTaskPath(data.newPaths[0]) },
          search: buildSearchParams(),
        })
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Orchestrate Debug Run Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const orchestrateMutation = trpc.tasks.orchestrateDebugRun.useMutation({
    onSuccess: (data, variables) => {
      dispatch({
        type: 'SET_ORCHESTRATOR',
        payload: {
          debugRunId: variables.debugRunId,
          sessionId: data.sessionId,
        },
      })
    },
    onError: (err) => {
      console.error('Failed to start orchestrator:', err)
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // QA Workflow Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const mergeBranchMutation = trpc.git.mergeBranch.useMutation({
    onError: (err) => {
      dispatch({ type: 'SET_SAVE_ERROR', payload: `Merge failed: ${err.message}` })
    },
  })

  const recordMergeMutation = trpc.tasks.recordMerge.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
    },
    onError: (err) => {
      console.error('Failed to record merge:', err.message)
    },
  })

  const setQAStatusMutation = trpc.tasks.setQAStatus.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
    },
    onError: (err) => {
      dispatch({ type: 'SET_SAVE_ERROR', payload: `Failed to set QA status: ${err.message}` })
    },
  })

  const revertMergeMutation = trpc.git.revertMerge.useMutation({
    onError: (err) => {
      dispatch({ type: 'SET_SAVE_ERROR', payload: `Revert failed: ${err.message}` })
    },
  })

  const recordRevertMutation = trpc.tasks.recordRevert.useMutation({
    onSuccess: () => {
      utils.tasks.get.invalidate()
      utils.tasks.getLatestActiveMerge.invalidate()
    },
    onError: (err) => {
      console.error('Failed to record revert:', err.message)
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Computed Loading States
  // ─────────────────────────────────────────────────────────────────────────────

  const isCreating =
    createMutation.isPending ||
    createWithAgentMutation.isPending ||
    debugWithAgentsMutation.isPending

  return {
    // Mutations
    saveMutation,
    createMutation,
    createWithAgentMutation,
    debugWithAgentsMutation,
    deleteMutation,
    archiveMutation,
    restoreMutation,
    assignToAgentMutation,
    cancelAgentMutation,
    verifyWithAgentMutation,
    rewriteWithAgentMutation,
    splitTaskMutation,
    orchestrateMutation,

    // QA Workflow Mutations
    mergeBranchMutation,
    recordMergeMutation,
    setQAStatusMutation,
    revertMergeMutation,
    recordRevertMutation,

    // Utils for external use
    utils,

    // Computed loading states
    isCreating,
  }
}
