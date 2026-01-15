/**
 * Task State Store
 *
 * Zustand store for managing task editor state shared between
 * tasks page and global sidebar.
 */

import { create } from 'zustand'
import type { AgentType } from '@/lib/agent/types'
import type { PlannerAgentType } from '@/lib/agent/config'
import type { AgentSession } from '@/components/tasks/agent-types'

export interface TaskState {
  // Selected task
  selectedPath: string | null

  // Editor state
  draft: string
  dirty: boolean
  mode: 'edit' | 'preview'
  view: 'editor' | 'review'

  // Save state
  isSaving: boolean
  saveError: string | null

  // Agent states
  runAgentType: AgentType
  runModel: string
  createAgentType: PlannerAgentType
  createModel: string
  rewriteAgentType: AgentType
  rewriteModel: string
  rewriteComment: string

  // Modal states
  reviewModalOpen: boolean
  reviewMode: 'review' | 'verify'
  splitModalOpen: boolean

  // Active session info
  activeSessionId: string | null
  agentSession: AgentSession | null

  // Actions
  setSelectedPath: (path: string | null) => void
  setDraft: (draft: string) => void
  setDirty: (dirty: boolean) => void
  setMode: (mode: 'edit' | 'preview') => void
  setView: (view: 'editor' | 'review') => void
  setIsSaving: (isSaving: boolean) => void
  setSaveError: (error: string | null) => void
  setRunAgentType: (type: AgentType) => void
  setRunModel: (model: string) => void
  setCreateAgentType: (type: PlannerAgentType) => void
  setCreateModel: (model: string) => void
  setRewriteAgentType: (type: AgentType) => void
  setRewriteModel: (model: string) => void
  setRewriteComment: (comment: string) => void
  setReviewModalOpen: (open: boolean) => void
  setReviewMode: (mode: 'review' | 'verify') => void
  setSplitModalOpen: (open: boolean) => void
  setActiveSessionId: (id: string | null) => void
  setAgentSession: (session: AgentSession | null) => void

  // Reset state when switching tasks
  reset: () => void
}

const initialState = {
  selectedPath: null,
  draft: '',
  dirty: false,
  mode: 'edit' as const,
  view: 'editor' as const,
  isSaving: false,
  saveError: null,
  runAgentType: 'claude' as AgentType,
  runModel: '',
  createAgentType: 'claude' as PlannerAgentType,
  createModel: '',
  rewriteAgentType: 'claude' as AgentType,
  rewriteModel: '',
  rewriteComment: '',
  reviewModalOpen: false,
  reviewMode: 'review' as const,
  splitModalOpen: false,
  activeSessionId: null,
  agentSession: null,
}

export const useTaskState = create<TaskState>((set) => ({
  ...initialState,

  setSelectedPath: (path) => set({ selectedPath: path }),
  setDraft: (draft) => set({ draft }),
  setDirty: (dirty) => set({ dirty }),
  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setSaveError: (saveError) => set({ saveError }),
  setRunAgentType: (runAgentType) => set({ runAgentType }),
  setRunModel: (runModel) => set({ runModel }),
  setCreateAgentType: (createAgentType) => set({ createAgentType }),
  setCreateModel: (createModel) => set({ createModel }),
  setRewriteAgentType: (rewriteAgentType) => set({ rewriteAgentType }),
  setRewriteModel: (rewriteModel) => set({ rewriteModel }),
  setRewriteComment: (rewriteComment) => set({ rewriteComment }),
  setReviewModalOpen: (reviewModalOpen) => set({ reviewModalOpen }),
  setReviewMode: (reviewMode) => set({ reviewMode }),
  setSplitModalOpen: (splitModalOpen) => set({ splitModalOpen }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setAgentSession: (agentSession) => set({ agentSession }),

  reset: () => set(initialState),
}))
