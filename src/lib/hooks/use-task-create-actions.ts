/**
 * Task Creation Actions Hook
 *
 * Handles task creation with optimistic updates:
 * - Basic task creation (no-plan)
 * - Task creation with agent (planning)
 * - Debug task creation (multi-agent)
 * - Optimistic cache seeding
 * - Auto-start implementation for no-plan tasks
 */

import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { trpc } from '@/lib/trpc-client'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { generateOptimisticTaskPath } from '@/lib/utils/slugify'
import type { TasksAction, CreateModalState, RunAgentState } from '@/lib/stores/tasks-reducer'

interface TaskSummary {
  path: string
  title: string
  archived: boolean
}

interface UseTaskCreateActionsParams {
  dispatch: React.Dispatch<TasksAction>
  create: CreateModalState
  run: RunAgentState
  tasks: TaskSummary[]
  buildSearchParams: (overrideReviewFile?: string | null) => {
    archiveFilter: 'all' | 'active' | 'archived'
    sortBy?: 'updated' | 'title' | 'progress'
    sortDir?: 'asc' | 'desc'
    reviewFile?: string
  }
  createMutation: ReturnType<typeof trpc.tasks.create.useMutation>
  createWithAgentMutation: ReturnType<typeof trpc.tasks.createWithAgent.useMutation>
  debugWithAgentsMutation: ReturnType<typeof trpc.tasks.debugWithAgents.useMutation>
  assignToAgentMutation: any // TODO: Type this properly
  clearCreateTitleDraft: () => void
}

export function useTaskCreateActions({
  dispatch,
  create,
  run,
  tasks,
  buildSearchParams,
  createMutation,
  createWithAgentMutation,
  debugWithAgentsMutation,
  assignToAgentMutation,
  clearCreateTitleDraft,
}: UseTaskCreateActionsParams) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const handleCreate = useCallback(() => {
    const title = create.title.trim()
    if (!title) return

    // Performance mark: create click
    performance.mark('task-create-start')

    // Generate optimistic path for immediate navigation
    const existingPaths = new Set(tasks.map(t => t.path))
    const optimisticPath = generateOptimisticTaskPath(title, existingPaths)
    const now = new Date().toISOString()

    // Seed optimistic cache BEFORE navigation (0ms latency requirement)
    // This ensures the editor has content immediately when it renders
    // For agent creates, show the title with "planning" placeholder
    const optimisticContent = create.useAgent
      ? `# ${title}\n\n_${create.taskType === 'bug' ? 'Investigating bug...' : 'Generating detailed task plan...'}_\n`
      : `# ${title}\n\n## Plan\n\n- [ ] Define scope\n- [ ] Implement\n- [ ] Validate\n`
    const optimisticTask = {
      path: optimisticPath,
      title,
      archived: false,
      createdAt: now,
      updatedAt: now,
      source: 'tasks-dir' as const,
      progress: { total: create.useAgent ? 0 : 3, done: 0, inProgress: 0 },
      subtaskCount: 0,
      hasSubtasks: false,
      content: optimisticContent,
      subtasks: [],
      version: 1,
      mergeHistory: [],
    }

    // Seed tasks.get cache synchronously BEFORE navigation
    utils.tasks.get.setData({ path: optimisticPath }, optimisticTask)

    // Also seed tasks.list for sidebar visibility
    const previousList = utils.tasks.list.getData()
    if (previousList) {
      utils.tasks.list.setData(undefined, [
        {
          path: optimisticPath,
          title,
          archived: false,
          createdAt: now,
          updatedAt: now,
          source: 'tasks-dir' as const,
          progress: { total: 3, done: 0, inProgress: 0 },
          subtaskCount: 0,
          hasSubtasks: false,
        },
        ...previousList,
      ])
    }

    // Reset UI state and clear draft
    dispatch({ type: 'RESET_CREATE_MODAL' })
    clearCreateTitleDraft()

    // Navigate immediately to optimistic path (0ms latency)
    // Cache is already seeded, so editor will have content immediately
    // For agent creates, navigate to task editor first, then mutation onSuccess redirects to agent session
    navigate({
      to: '/tasks/$',
      params: { _splat: encodeTaskPath(optimisticPath) },
      search: buildSearchParams(),
    })

    // Performance mark: navigation complete
    performance.mark('task-create-navigated')

    // Fire mutation without await (fire-and-forget pattern)
    // The mutation will handle reconciliation and redirect if server path differs
    if (create.useAgent) {
      if (create.taskType === 'bug') {
        const selectedAgents = create.debugAgents
          .filter((da) => da.selected)
          .map((da) => ({ agentType: da.agentType, model: da.model || undefined }))

        if (selectedAgents.length > 0) {
          debugWithAgentsMutation.mutate(
            { title, agents: selectedAgents, autoRun: create.autoRun },
            { onError: (err) => console.error('Failed to create debug task:', err) }
          )
        }
      } else {
        createWithAgentMutation.mutate(
          {
            title,
            taskType: create.taskType,
            agentType: create.agentType,
            model: create.model || undefined,
            autoRun: create.autoRun,
          },
          { onError: (err) => console.error('Failed to create task with agent:', err) }
        )
      }
    } else {
      // For basic create (no-plan), auto-start implementation after creation
      // Pass optimisticPath so mutation can clean up if path differs
      createMutation.mutate(
        { title },
        {
          onSuccess: (result) => {
            // Auto-start implementation with selected agent/model
            const taskPath = result.path
            const agentType = run.agentType
            const model = run.model

            console.log('[auto-start] No-plan task created, auto-starting implementation...', {
              taskPath,
              agentType,
              model,
            })

            // Delay slightly to allow UI to update
            setTimeout(() => {
              assignToAgentMutation.mutate(
                {
                  path: taskPath,
                  agentType,
                  model,
                  instructions: undefined,
                },
                {
                  onError: (err: any) => {
                    console.error('[auto-start] Failed to auto-start implementation:', err)
                  },
                }
              )
            }, 500)
          },
          onError: (err: any) => {
            console.error('Failed to create task:', err)
            // Rollback: remove optimistic data
            utils.tasks.get.setData({ path: optimisticPath }, undefined)
            if (previousList) {
              utils.tasks.list.setData(undefined, previousList)
            }
          },
        }
      )
    }

    // Log performance timing
    performance.mark('task-create-end')
    performance.measure('task-create-total', 'task-create-start', 'task-create-end')
    performance.measure('task-create-to-navigate', 'task-create-start', 'task-create-navigated')
  }, [
    create.title,
    create.useAgent,
    create.taskType,
    create.debugAgents,
    create.agentType,
    create.model,
    create.autoRun,
    run.agentType,
    run.model,
    tasks,
    debugWithAgentsMutation,
    createWithAgentMutation,
    createMutation,
    assignToAgentMutation,
    dispatch,
    clearCreateTitleDraft,
    navigate,
    buildSearchParams,
    utils.tasks.get,
    utils.tasks.list,
  ])

  return {
    handleCreate,
  }
}
