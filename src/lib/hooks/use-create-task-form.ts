/**
 * Create Task Form Hook
 *
 * Encapsulates all state management for task creation form.
 * Used by both TaskCommandPalette and inline form on tasks page.
 *
 * Includes:
 * - Form state (title, taskType, useAgent, etc.)
 * - Agent type synchronization
 * - Debug agents initialization
 * - Settings defaults
 * - Form handlers
 * - Create mutation
 */

import { useReducer, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { match } from 'ts-pattern'
import { trpc } from '@/lib/trpc-client'
import { useTextareaDraft } from '@/lib/hooks/use-textarea-draft'
import { useSynchronizeAgentType } from '@/lib/hooks/use-synchronize-agent-type'
import { useSettingsStore } from '@/lib/stores/settings'
import { encodeTaskPath } from '@/lib/utils/task-routing'
import { generateOptimisticTaskPath } from '@/lib/utils/slugify'
import { getDefaultModelId, type PlannerAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import type { TaskType } from '@/components/tasks/create-task-form'
import { ALL_PLANNER_CANDIDATES } from '@/components/tasks/create-task-form'

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DebugAgentSelection {
  agentType: PlannerAgentType
  model: string
  selected: boolean
}

interface CreateFormState {
  title: string
  taskType: TaskType
  useAgent: boolean
  agentType: PlannerAgentType
  model: string
  debugAgents: DebugAgentSelection[]
  autoRun: boolean
  includeQuestions: boolean
  runAgentType: AgentType
  runModel: string
}

type CreateFormAction =
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_TASK_TYPE'; payload: TaskType }
  | { type: 'SET_USE_AGENT'; payload: boolean }
  | { type: 'SET_AGENT_TYPE'; payload: PlannerAgentType }
  | { type: 'SET_MODEL'; payload: string }
  | { type: 'SET_AUTO_RUN'; payload: boolean }
  | { type: 'SET_INCLUDE_QUESTIONS'; payload: boolean }
  | { type: 'TOGGLE_DEBUG_AGENT'; payload: PlannerAgentType }
  | { type: 'SET_DEBUG_AGENT_MODEL'; payload: { agentType: PlannerAgentType; model: string } }
  | { type: 'INIT_DEBUG_AGENTS'; payload: PlannerAgentType[] }
  | { type: 'SET_RUN_AGENT_TYPE'; payload: AgentType }
  | { type: 'SET_RUN_MODEL'; payload: string }
  | { type: 'RESET' }

const initialState: CreateFormState = {
  title: '',
  taskType: 'feature',
  useAgent: true,
  agentType: 'codex',
  model: getDefaultModelId('codex'),
  debugAgents: [],
  autoRun: true,
  includeQuestions: false,
  runAgentType: 'codex',
  runModel: getDefaultModelId('codex'),
}

function createFormReducer(state: CreateFormState, action: CreateFormAction): CreateFormState {
  return match(action)
    .with({ type: 'SET_TITLE' }, ({ payload }) => ({ ...state, title: payload }))
    .with({ type: 'SET_TASK_TYPE' }, ({ payload }) => ({ ...state, taskType: payload }))
    .with({ type: 'SET_USE_AGENT' }, ({ payload }) => ({ ...state, useAgent: payload }))
    .with({ type: 'SET_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      agentType: payload,
      model: getDefaultModelId(payload),
    }))
    .with({ type: 'SET_MODEL' }, ({ payload }) => ({ ...state, model: payload }))
    .with({ type: 'SET_AUTO_RUN' }, ({ payload }) => ({ ...state, autoRun: payload }))
    .with({ type: 'SET_INCLUDE_QUESTIONS' }, ({ payload }) => ({ ...state, includeQuestions: payload }))
    .with({ type: 'TOGGLE_DEBUG_AGENT' }, ({ payload }) => ({
      ...state,
      debugAgents: state.debugAgents.map((da) =>
        da.agentType === payload ? { ...da, selected: !da.selected } : da
      ),
    }))
    .with({ type: 'SET_DEBUG_AGENT_MODEL' }, ({ payload }) => ({
      ...state,
      debugAgents: state.debugAgents.map((da) =>
        da.agentType === payload.agentType ? { ...da, model: payload.model } : da
      ),
    }))
    .with({ type: 'INIT_DEBUG_AGENTS' }, ({ payload }) => ({
      ...state,
      debugAgents: payload.map((agentType) => ({
        agentType,
        model: getDefaultModelId(agentType),
        selected: false,
      })),
    }))
    .with({ type: 'SET_RUN_AGENT_TYPE' }, ({ payload }) => ({
      ...state,
      runAgentType: payload,
      runModel: getDefaultModelId(payload),
    }))
    .with({ type: 'SET_RUN_MODEL' }, ({ payload }) => ({ ...state, runModel: payload }))
    .with({ type: 'RESET' }, () => ({
      ...initialState,
      agentType: state.agentType,
      model: state.model,
      runAgentType: state.runAgentType,
      runModel: state.runModel,
      debugAgents: state.debugAgents.map((da) => ({ ...da, selected: false })),
    }))
    .exhaustive()
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Interface
// ─────────────────────────────────────────────────────────────────────────────

interface TaskSummary {
  path: string
  title: string
  archived: boolean
}

interface UseCreateTaskFormParams {
  /** Existing tasks for optimistic path generation */
  tasks?: TaskSummary[]
  /** Called after successful creation with the task path */
  onCreated?: (path: string) => void
  /** Custom search params builder for navigation */
  buildSearchParams?: () => Record<string, string | undefined>
  /** Whether to navigate to task after creation (default: true) */
  navigateOnCreate?: boolean
}

export function useCreateTaskForm({
  tasks = [],
  onCreated,
  buildSearchParams,
  navigateOnCreate = true,
}: UseCreateTaskFormParams = {}) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  // Form state
  const [state, dispatch] = useReducer(createFormReducer, initialState)

  // Draft persistence
  const [titleDraft, setTitleDraft, clearTitleDraft] = useTextareaDraft('create-task-title', '')

  // Sync draft with form state
  useEffect(() => {
    if (titleDraft !== state.title) {
      dispatch({ type: 'SET_TITLE', payload: titleDraft })
    }
  }, [titleDraft, state.title])

  // ─────────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: availableTypes = [] } = trpc.agent.availableTypes.useQuery()
  const availablePlannerTypes = availableTypes.filter((t): t is PlannerAgentType =>
    ALL_PLANNER_CANDIDATES.includes(t as PlannerAgentType)
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent Type Synchronization
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAgentTypeChange = useCallback((newType: PlannerAgentType) => {
    dispatch({ type: 'SET_AGENT_TYPE', payload: newType })
  }, [])

  const handleRunAgentTypeChange = useCallback((newType: AgentType) => {
    dispatch({ type: 'SET_RUN_AGENT_TYPE', payload: newType })
  }, [])

  useSynchronizeAgentType({
    currentType: state.agentType,
    availableTypes: availablePlannerTypes,
    preferredOrder: ['claude', 'codex', 'cerebras', 'opencode', 'openrouter'],
    onTypeChange: handleAgentTypeChange,
  })

  useSynchronizeAgentType({
    currentType: state.runAgentType,
    availableTypes,
    preferredOrder: ['claude', 'codex', 'cerebras', 'opencode', 'gemini'],
    onTypeChange: handleRunAgentTypeChange,
  })

  // Initialize debug agents
  useEffect(() => {
    if (state.debugAgents.length === 0) {
      dispatch({ type: 'INIT_DEBUG_AGENTS', payload: ALL_PLANNER_CANDIDATES })
    }
  }, [state.debugAgents.length])

  // Apply settings defaults
  const { defaultPlanningAgentType, defaultImplementAgentType, defaultImplementModelId } = useSettingsStore()
  const hasAppliedSettingsRef = useRef(false)

  useEffect(() => {
    if (hasAppliedSettingsRef.current) return
    hasAppliedSettingsRef.current = true

    if (defaultPlanningAgentType && availablePlannerTypes.includes(defaultPlanningAgentType)) {
      dispatch({ type: 'SET_AGENT_TYPE', payload: defaultPlanningAgentType })
    }
    if (defaultImplementAgentType && availableTypes.includes(defaultImplementAgentType)) {
      dispatch({ type: 'SET_RUN_AGENT_TYPE', payload: defaultImplementAgentType })
      if (defaultImplementModelId) {
        dispatch({ type: 'SET_RUN_MODEL', payload: defaultImplementModelId })
      }
    }
  }, [defaultPlanningAgentType, defaultImplementAgentType, defaultImplementModelId, availablePlannerTypes, availableTypes])

  // ─────────────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────────────

  const createMutation = trpc.tasks.create.useMutation({
    onError: (err) => console.error('Failed to create task:', err),
  })
  const createWithAgentMutation = trpc.tasks.createWithAgent.useMutation({
    onError: (err) => console.error('Failed to create task with agent:', err),
  })
  const debugWithAgentsMutation = trpc.tasks.debugWithAgents.useMutation({
    onError: (err) => console.error('Failed to create debug task:', err),
  })
  const assignToAgentMutation = trpc.tasks.assignToAgent.useMutation({
    onError: (err) => console.error('Failed to auto-start implementation:', err),
  })

  const isCreating =
    createMutation.isPending || createWithAgentMutation.isPending || debugWithAgentsMutation.isPending

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  const handleTitleChange = useCallback((title: string) => {
    setTitleDraft(title)
    dispatch({ type: 'SET_TITLE', payload: title })
  }, [setTitleDraft])

  const handleCreate = useCallback(() => {
    const title = state.title.trim()
    if (!title) return

    // Generate optimistic path
    const existingPaths = new Set(tasks.map((t) => t.path))
    const optimisticPath = generateOptimisticTaskPath(title, existingPaths)
    const now = new Date().toISOString()

    // Seed optimistic cache
    const optimisticContent = state.useAgent
      ? `# ${title}\n\n_${state.taskType === 'bug' ? 'Investigating bug...' : 'Generating detailed task plan...'}_\n`
      : `# ${title}\n\n## Plan\n\n- [ ] Define scope\n- [ ] Implement\n- [ ] Validate\n`

    const optimisticTask = {
      path: optimisticPath,
      title,
      archived: false,
      createdAt: now,
      updatedAt: now,
      source: 'tasks-dir' as const,
      progress: { total: state.useAgent ? 0 : 3, done: 0, inProgress: 0 },
      subtaskCount: 0,
      hasSubtasks: false,
      content: optimisticContent,
      subtasks: [],
      version: 1,
      mergeHistory: [],
    }

    utils.tasks.get.setData({ path: optimisticPath }, optimisticTask)

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

    // Reset form state
    dispatch({ type: 'RESET' })
    clearTitleDraft()

    // Navigate if enabled
    if (navigateOnCreate) {
      navigate({
        to: '/tasks/$',
        params: { _splat: encodeTaskPath(optimisticPath) },
        search: buildSearchParams?.() ?? {},
      })
    }

    // Notify caller
    onCreated?.(optimisticPath)

    // Fire mutation
    if (state.useAgent) {
      if (state.taskType === 'bug') {
        const selectedAgents = state.debugAgents
          .filter((da) => da.selected)
          .map((da) => ({ agentType: da.agentType, model: da.model || undefined }))

        if (selectedAgents.length > 0) {
          debugWithAgentsMutation.mutate({
            title,
            agents: selectedAgents,
            autoRun: state.autoRun,
          })
        }
      } else {
        createWithAgentMutation.mutate({
          title,
          taskType: state.taskType,
          agentType: state.agentType,
          model: state.model || undefined,
          autoRun: state.autoRun,
          includeQuestions: state.includeQuestions,
        })
      }
    } else {
      createMutation.mutate(
        { title },
        {
          onSuccess: (result) => {
            // Auto-start implementation
            setTimeout(() => {
              assignToAgentMutation.mutate({
                path: result.path,
                agentType: state.runAgentType,
                model: state.runModel,
                instructions: undefined,
              })
            }, 500)
          },
          onError: () => {
            // Rollback optimistic data
            utils.tasks.get.setData({ path: optimisticPath }, undefined)
            if (previousList) {
              utils.tasks.list.setData(undefined, previousList)
            }
          },
        }
      )
    }
  }, [
    state,
    tasks,
    navigateOnCreate,
    onCreated,
    buildSearchParams,
    clearTitleDraft,
    navigate,
    utils.tasks.get,
    utils.tasks.list,
    createMutation,
    createWithAgentMutation,
    debugWithAgentsMutation,
    assignToAgentMutation,
  ])

  const canCreate =
    state.title.trim().length > 0 &&
    (!state.useAgent || availablePlannerTypes.length > 0) &&
    (!state.useAgent || state.taskType !== 'bug' || state.debugAgents.some((da) => da.selected))

  // ─────────────────────────────────────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    // State
    title: state.title,
    taskType: state.taskType,
    useAgent: state.useAgent,
    agentType: state.agentType,
    model: state.model,
    debugAgents: state.debugAgents,
    autoRun: state.autoRun,
    includeQuestions: state.includeQuestions,
    runAgentType: state.runAgentType,
    runModel: state.runModel,

    // Derived
    isCreating,
    canCreate,
    availableTypes,
    availablePlannerTypes,

    // Handlers
    onTitleChange: handleTitleChange,
    onTaskTypeChange: (taskType: TaskType) => dispatch({ type: 'SET_TASK_TYPE', payload: taskType }),
    onUseAgentChange: (useAgent: boolean) => dispatch({ type: 'SET_USE_AGENT', payload: useAgent }),
    onAgentTypeChange: handleAgentTypeChange,
    onModelChange: (model: string) => dispatch({ type: 'SET_MODEL', payload: model }),
    onAutoRunChange: (autoRun: boolean) => dispatch({ type: 'SET_AUTO_RUN', payload: autoRun }),
    onIncludeQuestionsChange: (inc: boolean) => dispatch({ type: 'SET_INCLUDE_QUESTIONS', payload: inc }),
    onToggleDebugAgent: (agentType: PlannerAgentType) => dispatch({ type: 'TOGGLE_DEBUG_AGENT', payload: agentType }),
    onDebugAgentModelChange: (agentType: PlannerAgentType, model: string) =>
      dispatch({ type: 'SET_DEBUG_AGENT_MODEL', payload: { agentType, model } }),
    onRunAgentTypeChange: handleRunAgentTypeChange,
    onRunModelChange: (model: string) => dispatch({ type: 'SET_RUN_MODEL', payload: model }),
    onCreate: handleCreate,
    reset: () => dispatch({ type: 'RESET' }),
  }
}
