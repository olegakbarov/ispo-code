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
import { useCancellingSessionsStore } from '@/lib/stores/cancelling-sessions'

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
  const { addCancelling, removeCancelling } = useCancellingSessionsStore()

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
      await utils.tasks.getActiveAgentSessions.cancel()

      // Store previous list for potential rollback
      const previousList = utils.tasks.list.getData()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()
      const existingPaths = new Set(previousList?.map(t => t.path) ?? [])

      // Generate optimistic path using shared slugify logic
      // NOTE: handleCreate already seeded the cache and navigated
      const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

      // Set optimistic active session so live-refresh and completion detection work
      // This is critical for the plan update to show in the UI
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [optimisticPath]: {
          sessionId: `pending-plan-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousList, previousSessions, optimisticPath }
    },
    onSuccess: (data, _variables, context) => {
      const serverPath = data.path
      const optimisticPath = context?.optimisticPath

      // Clean up optimistic cache entry if path differs
      if (optimisticPath && serverPath !== optimisticPath) {
        utils.tasks.get.setData({ path: optimisticPath }, undefined)
        // Remove optimistic session entry for old path
        utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => {
          if (!prev) return prev
          const updated = { ...prev }
          delete updated[optimisticPath]
          return updated
        })
      }

      // Update active session with real session ID
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [serverPath]: {
          sessionId: data.sessionId,
          status: data.status,
        },
      }))

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
      // Rollback active sessions
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
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
      await utils.tasks.getActiveAgentSessions.cancel()

      // Store previous list for potential rollback
      const previousList = utils.tasks.list.getData()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()
      const existingPaths = new Set(previousList?.map(t => t.path) ?? [])

      // Generate optimistic path using shared slugify logic
      // NOTE: handleCreate already seeded the cache and navigated
      const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

      // Set optimistic active session so live-refresh and completion detection work
      // This is critical for the plan update to show in the UI
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [optimisticPath]: {
          sessionId: `pending-debug-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousList, previousSessions, optimisticPath }
    },
    onSuccess: (data, _variables, context) => {
      const serverPath = data.path
      const optimisticPath = context?.optimisticPath

      // Clean up optimistic cache entry if path differs
      if (optimisticPath && serverPath !== optimisticPath) {
        utils.tasks.get.setData({ path: optimisticPath }, undefined)
        // Remove optimistic session entry for old path
        utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => {
          if (!prev) return prev
          const updated = { ...prev }
          delete updated[optimisticPath]
          return updated
        })
      }

      // Update active session with first debug session ID
      // Note: debug runs spawn multiple sessions, we track the first one for UI
      if (data.sessionIds && data.sessionIds.length > 0) {
        utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
          ...(prev ?? {}),
          [serverPath]: {
            sessionId: data.sessionIds[0],
            status: 'pending',
          },
        }))
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
      // Rollback active sessions
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Plan with Agents Mutation (multi-agent planning)
  // ─────────────────────────────────────────────────────────────────────────────

  const planWithAgentsMutation = trpc.tasks.planWithAgents.useMutation({
    onMutate: async ({ title }) => {
      // Cancel in-flight queries to avoid race conditions
      await utils.tasks.list.cancel()
      await utils.tasks.get.cancel()
      await utils.tasks.getActiveAgentSessions.cancel()

      // Store previous list for potential rollback
      const previousList = utils.tasks.list.getData()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()
      const existingPaths = new Set(previousList?.map(t => t.path) ?? [])

      // Generate optimistic path using shared slugify logic
      const optimisticPath = generateOptimisticTaskPath(title, existingPaths)

      // Set optimistic active session
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [optimisticPath]: {
          sessionId: `pending-plan-multi-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousList, previousSessions, optimisticPath }
    },
    onSuccess: (data, _variables, context) => {
      const serverPath = data.path
      const optimisticPath = context?.optimisticPath

      // Clean up optimistic cache entry if path differs
      if (optimisticPath && serverPath !== optimisticPath) {
        utils.tasks.get.setData({ path: optimisticPath }, undefined)
        utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => {
          if (!prev) return prev
          const updated = { ...prev }
          delete updated[optimisticPath]
          return updated
        })
      }

      // Update active session with first planning session ID
      if (data.sessionIds && data.sessionIds.length > 0) {
        utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
          ...(prev ?? {}),
          [serverPath]: {
            sessionId: data.sessionIds[0],
            status: 'pending',
          },
        }))
      }

      // Invalidate to refresh with server data
      startTransition(() => {
        utils.tasks.list.invalidate()
        utils.tasks.get.invalidate({ path: serverPath })
      })

      // Set plan orchestrator triggered for plan runs
      if (data.planRunId && data.planPaths) {
        dispatch({
          type: 'SET_PLAN_ORCHESTRATOR_TRIGGERED',
          payload: {
            planRunId: data.planRunId,
            planPaths: data.planPaths as [string, string],
            parentTaskPath: data.path,
          },
        })
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousList) {
        utils.tasks.list.setData(undefined, context.previousList)
      }
      if (context?.optimisticPath) {
        utils.tasks.get.setData({ path: context.optimisticPath }, undefined)
      }
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Orchestrate Plan Run Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const orchestratePlanMutation = trpc.tasks.orchestratePlanRun.useMutation({
    onSuccess: (data, variables) => {
      dispatch({
        type: 'SET_PLAN_ORCHESTRATOR',
        payload: {
          planRunId: variables.planRunId,
          sessionId: data.sessionId,
        },
      })
    },
    onError: (err) => {
      console.error('Failed to start plan orchestrator:', err)
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
  // Unarchive with Context Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const unarchiveWithContextMutation = trpc.tasks.unarchiveWithContext.useMutation({
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
      utils.agent.list.invalidate()
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
    onMutate: async ({ path, agentType, model }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      await utils.tasks.getSessionsForTask.cancel({ path })

      const previousSessions = utils.tasks.getActiveAgentSessions.getData()
      const previousTaskSessions = utils.tasks.getSessionsForTask.getData({ path })

      const optimisticSessionId = `pending-impl-${Date.now()}`
      const optimisticTimestamp = new Date().toISOString()

      // Update active sessions cache (for progress indicator)
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [path]: {
          sessionId: optimisticSessionId,
          status: 'pending',
        },
      }))

      // Update task sessions cache (for sidebar display)
      const optimisticSession = {
        sessionId: optimisticSessionId,
        agentType: agentType ?? 'claude',
        title: 'Implementing...',
        status: 'pending' as const,
        timestamp: optimisticTimestamp,
        sessionType: 'execution' as const,
        model,
      }

      utils.tasks.getSessionsForTask.setData({ path }, (prev) => {
        if (!prev) {
          return {
            all: [optimisticSession],
            grouped: {
              planning: [],
              review: [],
              verify: [],
              execution: [optimisticSession],
              rewrite: [],
              comment: [],
              orchestrator: [],
            },
          }
        }
        return {
          all: [optimisticSession, ...prev.all],
          grouped: {
            ...prev.grouped,
            execution: [optimisticSession, ...prev.grouped.execution],
          },
        }
      })

      return { previousSessions, previousTaskSessions, path, optimisticSessionId }
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic active session with real session
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [data.path]: {
          sessionId: data.sessionId,
          status: data.status,
        },
      }))

      // Replace optimistic task session with real session data
      utils.tasks.getSessionsForTask.setData({ path: data.path }, (prev) => {
        if (!prev) return prev
        const optimisticId = context?.optimisticSessionId
        const realSession = {
          sessionId: data.sessionId,
          agentType: _variables.agentType ?? 'claude',
          title: `Run: ${data.path.split('/').pop()?.replace('.md', '') ?? 'Task'}`,
          status: data.status,
          timestamp: new Date().toISOString(),
          sessionType: 'execution' as const,
          model: _variables.model,
        }

        return {
          all: prev.all.map((s) => s.sessionId === optimisticId ? realSession : s),
          grouped: {
            ...prev.grouped,
            execution: prev.grouped.execution.map((s) => s.sessionId === optimisticId ? realSession : s),
          },
        }
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback active sessions
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
      // Rollback task sessions
      if (context?.previousTaskSessions !== undefined) {
        utils.tasks.getSessionsForTask.setData({ path: context.path }, context.previousTaskSessions)
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Cancel Agent Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const cancelAgentMutation = trpc.agent.cancel.useMutation({
    onMutate: async ({ id }) => {
      console.log('[cancelAgentMutation] onMutate: Cancelling session', id)

      // Add to cancelling store to prevent polling from re-adding this session
      addCancelling(id)

      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()
      console.log('[cancelAgentMutation] onMutate: Previous sessions count:', Object.keys(previousSessions ?? {}).length)

      if (previousSessions !== undefined) {
        const updatedSessions = { ...previousSessions }
        for (const [taskPath, session] of Object.entries(previousSessions)) {
          if (session.sessionId === id) {
            console.log('[cancelAgentMutation] onMutate: Removing session from taskPath:', taskPath)
            delete updatedSessions[taskPath]
            break
          }
        }
        utils.tasks.getActiveAgentSessions.setData(undefined, updatedSessions)
        console.log('[cancelAgentMutation] onMutate: Updated sessions count:', Object.keys(updatedSessions).length)
      }

      return { previousSessions }
    },
    onSuccess: (data, variables, _context) => {
      console.log('[cancelAgentMutation] onSuccess:', data)
      // Keep session in cancelling store until settled to prevent race condition
      utils.tasks.list.invalidate()
    },
    onError: (error, variables, context) => {
      console.error('[cancelAgentMutation] onError:', error)
      // Remove from cancelling store on error
      removeCancelling(variables.id)
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      }
    },
    onSettled: (_data, _error, variables) => {
      console.log('[cancelAgentMutation] onSettled: Invalidating queries and removing from cancelling store')
      // Remove from cancelling store after server confirms cancellation
      removeCancelling(variables.id)
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

      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [path]: {
          sessionId: `pending-verify-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousSessions, path }
    },
    onSuccess: (data) => {
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [data.path]: {
          sessionId: data.sessionId,
          status: data.status,
        },
      }))
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
    },
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Rewrite with Agent Mutation
  // ─────────────────────────────────────────────────────────────────────────────

  const rewriteWithAgentMutation = trpc.tasks.rewriteWithAgent.useMutation({
    onMutate: async ({ path }) => {
      await utils.tasks.getActiveAgentSessions.cancel()
      const previousSessions = utils.tasks.getActiveAgentSessions.getData()

      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [path]: {
          sessionId: `pending-rewrite-${Date.now()}`,
          status: 'pending',
        },
      }))

      return { previousSessions, path }
    },
    onSuccess: (data) => {
      utils.tasks.getActiveAgentSessions.setData(undefined, (prev) => ({
        ...(prev ?? {}),
        [data.path]: {
          sessionId: data.sessionId,
          status: data.status,
        },
      }))
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSessions !== undefined) {
        utils.tasks.getActiveAgentSessions.setData(undefined, context.previousSessions)
      } else {
        utils.tasks.getActiveAgentSessions.setData(undefined, {})
      }
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
    debugWithAgentsMutation.isPending ||
    planWithAgentsMutation.isPending

  return {
    // Mutations
    saveMutation,
    createMutation,
    createWithAgentMutation,
    debugWithAgentsMutation,
    planWithAgentsMutation,
    deleteMutation,
    archiveMutation,
    restoreMutation,
    unarchiveWithContextMutation,
    assignToAgentMutation,
    cancelAgentMutation,
    verifyWithAgentMutation,
    rewriteWithAgentMutation,
    splitTaskMutation,
    orchestrateMutation,
    orchestratePlanMutation,

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
