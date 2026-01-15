/**
 * Agent configuration for task components
 *
 * Re-exports from central config with task-specific type alias.
 * PlannerAgentType here includes ALL agents (unlike lib/agent/config which excludes some).
 */

import type { AgentType } from '@/lib/agent/types'

// Re-export shared config from central location
export {
  agentTypeLabel,
  extractTaskReviewOutput,
  TASK_REVIEW_OUTPUT_START,
  TASK_REVIEW_OUTPUT_END,
  getModelsForAgentType,
  supportsModelSelection,
  getDefaultModelId,
} from '@/lib/agent/config'

// Task-specific type: all agent types can be used for task planning
export type PlannerAgentType = AgentType
