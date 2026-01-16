/**
 * Shared form content for creating new tasks
 * Used by both CreateTaskModal and inline form on tasks index
 * Styled to match cmdk (command palette) aesthetic
 */

import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { agentTypeLabel, supportsModelSelection, getModelsForAgentType, type PlannerAgentType } from '@/lib/agent/config'
import type { AgentType } from '@/lib/agent/types'
import type { DebugAgentSelection } from '@/lib/stores/tasks-reducer'
import { Sparkles, Bug, Zap, Bot, Cpu, HelpCircle } from 'lucide-react'

export type TaskType = 'bug' | 'feature'

/** All planner agent type candidates (shown in UI, some may be unavailable) */
export const ALL_PLANNER_CANDIDATES: PlannerAgentType[] = ['claude', 'codex', 'cerebras', 'opencode', 'mcporter', 'openrouter']

/** cmdk-style group heading */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1.5 py-2 text-xs font-vcr text-muted-foreground/60 uppercase tracking-wider">
      {children}
    </div>
  )
}

export interface CreateTaskFormProps {
  isCreating: boolean
  newTitle: string
  taskType: TaskType
  useAgent: boolean
  createAgentType: PlannerAgentType
  createModel: string
  availableTypes: AgentType[] | undefined
  availablePlannerTypes: PlannerAgentType[]
  /** Debug agent selections for multi-agent debugging (bug type only) */
  debugAgents: DebugAgentSelection[]
  /** Auto-run phases: planning→impl→verify */
  autoRun: boolean
  /** Include clarifying questions in AI planning */
  includeQuestions: boolean
  /** Implementation agent type (for !useAgent create) */
  runAgentType: AgentType
  /** Implementation model (for !useAgent create) */
  runModel: string
  onCreate: () => void
  onTitleChange: (title: string) => void
  onTaskTypeChange: (taskType: TaskType) => void
  onUseAgentChange: (useAgent: boolean) => void
  onAgentTypeChange: (agentType: PlannerAgentType) => void
  onModelChange: (model: string) => void
  onAutoRunChange: (autoRun: boolean) => void
  onIncludeQuestionsChange: (includeQuestions: boolean) => void
  onToggleDebugAgent: (agentType: PlannerAgentType) => void
  onDebugAgentModelChange: (agentType: PlannerAgentType, model: string) => void
  /** Set implementation agent type (for !useAgent create) */
  onRunAgentTypeChange: (agentType: AgentType) => void
  /** Set implementation model (for !useAgent create) */
  onRunModelChange: (model: string) => void
  /** Optional: called on Escape key (only used in modal context) */
  onCancel?: () => void
  /** Whether to auto-focus the title input */
  autoFocus?: boolean
}

export function CreateTaskForm({
  isCreating,
  newTitle,
  taskType,
  useAgent,
  createAgentType,
  createModel,
  availablePlannerTypes,
  debugAgents,
  autoRun,
  includeQuestions,
  runAgentType,
  runModel,
  onCreate,
  onTitleChange,
  onTaskTypeChange,
  onUseAgentChange,
  onAgentTypeChange,
  onModelChange,
  onAutoRunChange,
  onIncludeQuestionsChange,
  onToggleDebugAgent,
  onDebugAgentModelChange,
  onRunAgentTypeChange,
  onRunModelChange,
  onCancel,
  autoFocus = true,
}: CreateTaskFormProps) {
  const canUseAgent = availablePlannerTypes.length > 0

  return (
    <div className="space-y-6">
      {/* Description section */}
      <div>
        <GroupHeading>Description</GroupHeading>
        <Textarea
          value={newTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="What do you want to accomplish?"
          className="bg-background/50 border-border/50 focus:border-accent/50 text-sm p-4"
          rows={4}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onCreate()
            }
            if (e.key === 'Escape' && onCancel) onCancel()
          }}
        />
      </div>

      {/* Task type section */}
      <div>
        <GroupHeading>Type</GroupHeading>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onTaskTypeChange('feature')}
            disabled={isCreating}
            className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-vcr transition-colors cursor-pointer ${
              taskType === 'feature'
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-background/50 text-muted-foreground border border-border/50 hover:bg-accent/10 hover:text-foreground hover:border-accent/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Sparkles className="w-5 h-5" />
            Feature
          </button>
          <button
            type="button"
            onClick={() => onTaskTypeChange('bug')}
            disabled={isCreating}
            className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-vcr transition-colors cursor-pointer ${
              taskType === 'bug'
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-background/50 text-muted-foreground border border-border/50 hover:bg-accent/10 hover:text-foreground hover:border-accent/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Bug className="w-5 h-5" />
            Bug
          </button>
        </div>
      </div>

      {/* Options section */}
      <div>
        <GroupHeading>Options</GroupHeading>
        <div className="space-y-2">
          <label className={`flex items-center gap-4 px-4 py-3 rounded-md cursor-pointer transition-colors ${
            useAgent ? 'bg-accent/10' : 'hover:bg-accent/5'
          } ${(!canUseAgent && !useAgent) ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Checkbox
              checked={useAgent}
              onChange={() => onUseAgentChange(!useAgent)}
              disabled={isCreating || (!canUseAgent && !useAgent)}
              size="lg"
            />
            <Bot className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-vcr text-foreground">
              {taskType === 'bug' ? 'Debug with AI' : 'Plan with AI'}
            </span>
          </label>

          {useAgent && canUseAgent && (
            <label className={`flex items-center gap-4 px-4 py-3 rounded-md cursor-pointer transition-colors ${
              autoRun ? 'bg-accent/10' : 'hover:bg-accent/5'
            }`}>
              <Checkbox
                checked={autoRun}
                onChange={() => onAutoRunChange(!autoRun)}
                disabled={isCreating}
                size="lg"
              />
              <Zap className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-vcr text-foreground">Auto-run phases</span>
              <span className="text-xs text-muted-foreground/60 ml-auto">
                plan → impl → verify
              </span>
            </label>
          )}

          {useAgent && canUseAgent && taskType === 'feature' && (
            <label className={`flex items-center gap-4 px-4 py-3 rounded-md cursor-pointer transition-colors ${
              includeQuestions ? 'bg-accent/10' : 'hover:bg-accent/5'
            }`}>
              <Checkbox
                checked={includeQuestions}
                onChange={() => onIncludeQuestionsChange(!includeQuestions)}
                disabled={isCreating}
                size="lg"
              />
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-vcr text-foreground">Ask clarifying questions</span>
              <span className="text-xs text-muted-foreground/60 ml-auto">
                refine plan
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Agent configuration - only when not using AI planning */}
      {!useAgent && (
        <div>
          <GroupHeading>Implementation Agent</GroupHeading>
          <div className="space-y-3">
            <Select
              value={runAgentType}
              onChange={(e) => onRunAgentTypeChange(e.target.value as AgentType)}
              disabled={isCreating}
              className="bg-background/50 border-border/50 text-sm py-2.5 px-3"
            >
              {availablePlannerTypes.map((t) => (
                <option key={t} value={t}>
                  {agentTypeLabel[t]}
                </option>
              ))}
            </Select>

            {supportsModelSelection(runAgentType as PlannerAgentType) && (
              <Select
                value={runModel}
                onChange={(e) => onRunModelChange(e.target.value)}
                disabled={isCreating}
                className="bg-background/50 border-border/50 text-sm py-2.5 px-3"
              >
                {getModelsForAgentType(runAgentType as PlannerAgentType).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}{m.description ? ` - ${m.description}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      )}

      {/* Debug agents - multi-select for bug type */}
      {useAgent && canUseAgent && taskType === 'bug' && (
        <div>
          <GroupHeading>
            Debug Agents
            <span className="ml-1.5 normal-case tracking-normal">(select 1+)</span>
          </GroupHeading>
          <div className="space-y-2">
            {debugAgents.map((da) => {
              const isAvailable = availablePlannerTypes.includes(da.agentType)
              return (
                <div
                  key={da.agentType}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                    da.selected ? 'bg-accent/10' : isAvailable ? 'hover:bg-accent/5' : ''
                  } ${!isAvailable ? 'opacity-40' : ''}`}
                >
                  <label className="flex items-center gap-4 cursor-pointer flex-1 min-w-0">
                    <Checkbox
                      checked={da.selected}
                      onChange={() => onToggleDebugAgent(da.agentType)}
                      disabled={isCreating || !isAvailable}
                      size="lg"
                    />
                    <Cpu className="w-5 h-5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-vcr text-foreground truncate">
                      {agentTypeLabel[da.agentType]}
                      {!isAvailable && ' (N/A)'}
                    </span>
                  </label>
                  {da.selected && supportsModelSelection(da.agentType) && (
                    <Select
                      value={da.model}
                      onChange={(e) => onDebugAgentModelChange(da.agentType, e.target.value)}
                      disabled={isCreating}
                      className="bg-background/50 border-border/50 w-40 text-sm py-2 px-2.5"
                    >
                      {getModelsForAgentType(da.agentType).map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Planner agent - for feature type */}
      {useAgent && canUseAgent && taskType === 'feature' && (
        <div>
          <GroupHeading>Planner Agent</GroupHeading>
          <div className="space-y-3">
            <Select
              value={createAgentType}
              onChange={(e) => onAgentTypeChange(e.target.value as PlannerAgentType)}
              disabled={isCreating}
              className="bg-background/50 border-border/50 text-sm py-2.5 px-3"
            >
              {ALL_PLANNER_CANDIDATES.map((t) => {
                const isAvailable = availablePlannerTypes.includes(t)
                return (
                  <option key={t} value={t} disabled={!isAvailable}>
                    {agentTypeLabel[t]}{!isAvailable ? ' (Not available)' : ''}
                  </option>
                )
              })}
            </Select>

            {supportsModelSelection(createAgentType) && (
              <Select
                value={createModel}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={isCreating}
                className="bg-background/50 border-border/50 text-sm py-2.5 px-3"
              >
                {getModelsForAgentType(createAgentType).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}{m.description ? ` - ${m.description}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export interface CreateTaskActionsProps {
  isCreating: boolean
  canCreate: boolean
  onCreate: () => void
  onCancel?: () => void
}

export function CreateTaskActions({
  isCreating,
  canCreate,
  onCreate,
  onCancel,
}: CreateTaskActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-vcr">
        <kbd className="px-1.5 py-0.5 bg-border/30 rounded">⌘↵</kbd>
        <span>to create</span>
      </div>
      <div className="flex items-center gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isCreating}
            className="px-3 py-1.5 rounded text-xs font-vcr text-muted-foreground hover:text-foreground hover:bg-accent/10 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onCreate}
          disabled={isCreating || !canCreate}
          className="px-3 py-1.5 rounded text-xs font-vcr bg-accent text-accent-foreground cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}
