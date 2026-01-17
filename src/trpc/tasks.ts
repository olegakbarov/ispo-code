/**
 * Tasks tRPC Router
 *
 * Tasks are markdown files stored in the repo (see task-service).
 */

import { z } from "zod"
import { randomBytes } from "crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import { router, procedure } from "./trpc"
import { taskLogger } from "@/lib/logger"
import { createTask, deleteTask, getTask, listTasks, saveTask, archiveTask, restoreTask, parseSections, searchArchivedTasks, addSubtasksToTask, updateSubtask, deleteSubtask as deleteSubtaskFromTask, getSubtask, MAX_SUBTASKS_PER_TASK, findSplitFromTasks, migrateAllSplitFromTasks, recordMerge, setQAStatus, recordRevert, getLatestActiveMerge, generateArchiveCommitMessage } from "@/lib/agent/task-service"
import { buildTaskVerifyPrompt } from "@/lib/tasks/verify-prompt"
import type { SubTask, CheckboxItem } from "@/lib/agent/task-service"
import { getActiveSessionIdsForTask, resolveTaskSessionIdsFromRegistry, getTaskFailedSessionsMap } from "@/lib/agent/task-session"
import { getProcessMonitor } from "@/daemon/process-monitor"
import { getStreamServerUrl } from "@/streams/server"
import { getStreamAPI } from "@/streams/client"
import { getGitStatus, getGitRoot, commitScopedChanges } from "@/lib/agent/git-service"
import { getWorktreeForSession, getTaskWorktreeForId, deleteWorktree, isWorktreeIsolationEnabled } from "@/lib/agent/git-worktree"
import { ensureTaskWorktreeForPath } from "@/lib/agent/task-worktree"
import { agentTypeSchema, type SessionStatus, type AgentType, type EditedFileInfo, type AgentOutputChunk } from "@/lib/agent/types"
import { supportsAskUserQuestion } from "@/lib/agent/config"
import { checkCLIAvailable } from "@/lib/agent/cli-runner"
import type { RegistryEvent, SessionStreamEvent, AgentOutputEvent } from "@/streams/schemas"
import { createRegistryEvent } from "@/streams/schemas"
import { calculateRelativePaths } from "@/lib/utils/path-utils"

/** CLI agent types that require the CLI to be installed */
const CLI_AGENT_TYPES: AgentType[] = ["claude", "codex", "opencode", "research", "qa"]

/**
 * Validate that CLI is available for CLI-based agent types.
 * Throws an error if the CLI is not installed.
 */
function validateCLIAvailability(agentType: AgentType): void {
  if (CLI_AGENT_TYPES.includes(agentType)) {
    // Research and QA agents use Claude CLI
    const cliName = (agentType === "research" || agentType === "qa")
      ? "claude"
      : agentType as "claude" | "codex" | "opencode"
    if (!checkCLIAvailable(cliName)) {
      const displayName = (agentType === "research" || agentType === "qa")
        ? `${agentType} (Claude CLI)`
        : agentType
      throw new Error(`${displayName} CLI is not installed. Please install it first.`)
    }
  }
}

function ensureTaskWorktreeForTaskPath(workingDir: string, taskPath: string) {
  try {
    ensureTaskWorktreeForPath({ taskPath, baseWorkingDir: workingDir })
  } catch (error) {
    taskLogger.warn("worktree", `Failed to ensure task worktree for ${taskPath}`, error)
  }
}

/**
 * Extract edited files from session stream events.
 * This is an inlined/optimized version of agent.ts reconstructEditedFilesFromChunks
 * that works directly with session stream events to avoid full session reconstruction.
 */
function extractEditedFilesFromSessionEvents(
  sessionEvents: SessionStreamEvent[],
  workingDir: string
): EditedFileInfo[] {
  const editedFiles: EditedFileInfo[] = []

  for (const event of sessionEvents) {
    if (event.type !== "output") continue
    const chunk = (event as AgentOutputEvent).chunk
    if (chunk.type !== "tool_use") continue

    try {
      const content = JSON.parse(chunk.content)
      const toolName = content.name || content.tool_name
      const input = content.input || {}

      if (!toolName) continue

      const path =
        (input.path as string) ??
        (input.file_path as string) ??
        (input.file as string) ??
        (input.notebook_path as string)

      if (!path) continue

      let operation: "create" | "edit" | "delete" | null = null
      const lowerTool = toolName.toLowerCase()

      if (lowerTool.includes("write") || lowerTool.includes("edit")) {
        operation = "edit"
      } else if (lowerTool.includes("create")) {
        operation = "create"
      } else if (lowerTool.includes("delete") || lowerTool.includes("remove")) {
        operation = "delete"
      }

      if (operation) {
        const { relativePath, repoRelativePath } = calculateRelativePaths(path, workingDir)
        editedFiles.push({
          path,
          relativePath,
          repoRelativePath: repoRelativePath || undefined,
          operation,
          timestamp: chunk.timestamp,
          toolUsed: toolName,
        })
      }
    } catch {
      continue
    }
  }

  return editedFiles
}

/**
 * Get edited files for a session from registry events and session stream.
 * Prioritizes metadata.editedFiles for completed sessions (faster),
 * falls back to parsing session stream for running sessions.
 */
async function getEditedFilesForSession(
  sessionId: string,
  registryEvents: RegistryEvent[],
  streamAPI: ReturnType<typeof getStreamAPI>
): Promise<{ files: EditedFileInfo[]; workingDir: string }> {
  // Find session_created event for workingDir
  const createdEvent = registryEvents.find(
    (e) => e.type === "session_created" && e.sessionId === sessionId
  )
  if (!createdEvent || createdEvent.type !== "session_created") {
    return { files: [], workingDir: "" }
  }
  const workingDir = createdEvent.worktreePath ?? createdEvent.workingDir

  // Check for completed/failed events with metadata.editedFiles (fast path)
  const sessionRegistryEvents = registryEvents.filter((e) => e.sessionId === sessionId)
  for (const event of sessionRegistryEvents.reverse()) {
    if (
      (event.type === "session_completed" || event.type === "session_failed") &&
      event.metadata?.editedFiles &&
      event.metadata.editedFiles.length > 0
    ) {
      return { files: event.metadata.editedFiles, workingDir }
    }
  }

  // Slow path: read session stream and parse tool_use events
  const sessionEvents = await streamAPI.readSession(sessionId)
  const files = extractEditedFilesFromSessionEvents(sessionEvents, workingDir)
  return { files, workingDir }
}

/** Maximum characters per session output in orchestrator prompt */
const MAX_SESSION_OUTPUT_CHARS = 30000

/** Maximum total characters for all session outputs combined */
const MAX_TOTAL_OUTPUT_CHARS = 100000

/**
 * Build orchestrator prompt that aggregates output from all debug sessions.
 * Truncates individual session outputs to fit within context limits.
 */
function buildDebugOrchestratorPrompt(params: {
  title: string
  taskPath: string
  workingDir: string
  sessions: Array<{
    sessionId: string
    agentType: string
    title?: string
    status: SessionStatus
    output: string
  }>
}): string {
  const { title, taskPath, sessions } = params

  // Build session summaries with truncated outputs
  let totalChars = 0
  const sessionSummaries = sessions.map((session, idx) => {
    // Calculate remaining budget
    const remainingBudget = MAX_TOTAL_OUTPUT_CHARS - totalChars
    const sessionBudget = Math.min(MAX_SESSION_OUTPUT_CHARS, remainingBudget)

    // Truncate output if needed
    let output = session.output
    if (output.length > sessionBudget) {
      output = output.slice(0, sessionBudget) + "\n\n[... output truncated ...]"
    }
    totalChars += output.length

    const statusLabel = session.status === "completed"
      ? "✓ Completed"
      : session.status === "failed"
        ? "✗ Failed"
        : "⊘ Cancelled"

    return `### Session ${idx + 1}: ${session.title || session.agentType} (${statusLabel})
Agent: ${session.agentType}
Status: ${session.status}

#### Output:
\`\`\`
${output}
\`\`\`
`
  })

  const completedCount = sessions.filter((s) => s.status === "completed").length
  const failedCount = sessions.filter((s) => s.status === "failed").length
  const cancelledCount = sessions.filter((s) => s.status === "cancelled").length

  return `You are a debugging orchestrator synthesizing findings from ${sessions.length} parallel debug sessions.

## Bug Report
"${title}"

## Session Summary
- Total sessions: ${sessions.length}
- Completed: ${completedCount}
- Failed: ${failedCount}
- Cancelled: ${cancelledCount}

## Session Outputs

${sessionSummaries.join("\n---\n\n")}

## Your Task

Review all session outputs above and synthesize findings:

1. **Root Cause Analysis**: What is the root cause based on the collective findings?
2. **Solution Consensus**: Do the sessions agree on a solution? What approach is best?
3. **Action Items**: What specific changes need to be made?
4. **Conflicts**: Are there any conflicting findings that need resolution?

## Output Requirements

Write your synthesis to ${taskPath} with this structure:

\`\`\`markdown
# ${title}

## Root Cause
[Synthesized root cause from all sessions]

## Recommended Solution
[Best solution based on session findings]

## Implementation Steps
- [ ] Step 1
- [ ] Step 2
...

## Session Notes
- Session 1: [Key finding]
- Session 2: [Key finding]
...

## Conflicts to Resolve
[Any disagreements between sessions, if any]
\`\`\`

Begin synthesis now. Focus on extracting actionable insights from all sessions.`
}

/**
 * System prompt for debugging task with systematic-debugging skill.
 * Invokes the systematic-debugging skill to investigate and fix bugs.
 * Searches archived tasks for related bug patterns to provide context.
 */
function buildTaskDebugPrompt(params: {
  title: string
  taskPath: string
  workingDir: string
}): string {
  // Search archived tasks for related bugs
  const relatedBugs = searchArchivedTasks(params.workingDir, params.title, 3)

  // Build related bugs section if matches found
  let relatedBugsSection = ""
  if (relatedBugs.length > 0) {
    const bugEntries = relatedBugs.map((bug) => {
      const lines = [`### ${bug.title}`, `Path: \`${bug.path}\``]

      if (bug.context) {
        if (bug.context.rootCause) {
          lines.push(`**Root Cause**: ${bug.context.rootCause}`)
        }
        if (bug.context.solution) {
          lines.push(`**Solution**: ${bug.context.solution}`)
        }
        if (bug.context.keyFiles.length > 0) {
          lines.push(`**Key Files**: ${bug.context.keyFiles.map((f) => `\`${f}\``).join(", ")}`)
        }
      } else if (bug.snippet) {
        lines.push(`**Snippet**: ${bug.snippet}`)
      }

      return lines.join("\n")
    })

    relatedBugsSection = `
## Related Archived Bugs

The following previously fixed bugs may be relevant. Review them before investigating:

${bugEntries.join("\n\n")}

---
`
  }

  return `You are investigating and fixing a bug. Use the systematic-debugging skill to methodically diagnose and resolve the issue.

## Bug Report
"${params.title}"
${relatedBugsSection}
## Instructions
1. ${relatedBugs.length > 0 ? "Review the related archived bugs above for patterns and prior solutions\n2. " : ""}Use the Skill tool to invoke systematic-debugging: skill: "systematic-debugging", args: "${params.title}"
${relatedBugs.length > 0 ? "3" : "2"}. Follow the systematic debugging methodology (four phases)
${relatedBugs.length > 0 ? "4" : "3"}. **CRITICAL: Write findings to ${params.taskPath} after EACH phase**

## Documentation Requirements

After each phase, update ${params.taskPath} with your findings using this structure:

\`\`\`markdown
# ${params.title}

## Investigation Findings

### Phase 1: Root Cause Investigation
- **Symptom**: [Where error manifests]
- **Immediate Cause**: [Code directly producing error]
- **Call Chain**: [Trace backward through stack]
- **Original Trigger**: [Where problem started]
- **Evidence**: [Logs, stack traces, state dumps]

### Phase 2: Pattern Analysis
- **Working Examples**: [Similar code that works]
- **Key Differences**: [What differs between working and broken]
- **Dependencies**: [What this code depends on]

### Phase 3: Hypothesis & Testing
- **Hypothesis**: [Clear statement: "Error occurs because X"]
- **Test Design**: [Minimal test changing ONE variable]
- **Prediction**: [Expected outcome if hypothesis correct]
- **Result**: [What actually happened]
- **Conclusion**: [Hypothesis confirmed/refuted]

### Phase 4: Implementation
- **Root Cause**: [Final determination]
- **Solution**: [Fix addressing root cause]
- **Test Case**: [Failing test capturing bug]
- **Verification**: [Test passes, full suite passes]
- **Changes Made**: [Files modified with brief description]

## Success Criteria
- [ ] Root cause identified and documented
- [ ] Fix addresses root cause (not symptoms)
- [ ] Test created reproducing bug
- [ ] All tests pass
\`\`\`

## Checkpoint Reminders

- **After Phase 1**: Write Root Cause Investigation findings to ${params.taskPath}
- **After Phase 2**: Write Pattern Analysis findings to ${params.taskPath}
- **After Phase 3**: Write Hypothesis & Testing results to ${params.taskPath}
- **After Phase 4**: Write Implementation details to ${params.taskPath}

## Working Directory
${params.workingDir}

Begin by ${relatedBugs.length > 0 ? "reviewing the related bugs, then " : ""}invoking the systematic-debugging skill now. Remember to update ${params.taskPath} after each phase completes.`
}

/**
 * System prompt for task expansion agent.
 * The agent receives the user's prompt and generates a detailed task plan.
 * Optionally asks clarifying questions first when includeQuestions is true.
 */
function buildTaskExpansionPrompt(params: {
  title: string
  taskPath: string
  workingDir: string
  includeQuestions?: boolean
}): string {
  // When includeQuestions is enabled, ask questions first, then refine plan
  if (params.includeQuestions) {
    return `Task planning agent. Convert brief description into concise, actionable plan.

## Task
"${params.title}"

## Instructions
1. Explore codebase for context
2. **Ask 2-4 clarifying questions** using the AskUserQuestion tool to refine requirements
3. Wait for user response
4. Write refined plan to: ${params.taskPath}

## Question Guidelines
- Ask about ambiguous requirements, scope boundaries, or implementation preferences
- Focus on questions that would significantly change the plan
- Use the AskUserQuestion tool (NOT text output) to ask questions

## Format (for final plan after questions answered)

\`\`\`markdown
# ${params.title}

## Problem Statement
What & why (2-3 sentences max)

## Scope
**In:** bullet list
**Out:** bullet list

## Implementation Plan

### Phase: [Name]
- [ ] Action (one clear step, no elaboration)
- [ ] Action

## Key Files
- \`path/file.ts\` - changes needed

## Success Criteria
- [ ] Measurable outcome

## Unresolved Questions
- Any remaining questions, if any
\`\`\`

## Rules (CRITICAL)
- **BE CONCISE** - Follow CLAUDE.md style: sacrifice grammar for concision
- Use fragments, not full sentences
- No marketing language or filler
- Each checkbox: one action, no elaboration
- Specific file paths, no vague terms
- Working dir: ${params.workingDir}

Start by exploring codebase, then ask clarifying questions using AskUserQuestion tool.`
  }

  return `Task planning agent. Convert brief description into concise, actionable plan.

## Task
"${params.title}"

## Instructions
1. Explore codebase for context
2. Write plan to: ${params.taskPath}

## Format

\`\`\`markdown
# ${params.title}

## Problem Statement
What & why (2-3 sentences max)

## Scope
**In:** bullet list
**Out:** bullet list

## Implementation Plan

### Phase: [Name]
- [ ] Action (one clear step, no elaboration)
- [ ] Action

## Key Files
- \`path/file.ts\` - changes needed

## Success Criteria
- [ ] Measurable outcome
\`\`\`

## Rules (CRITICAL)
- **BE CONCISE** - Follow CLAUDE.md style: sacrifice grammar for concision
- Use fragments, not full sentences
- No marketing language or filler
- Each checkbox: one action, no elaboration
- Specific file paths, no vague terms
- Working dir: ${params.workingDir}

Explore codebase, write terse plan.`
}

/**
 * System prompt for task execution agent.
 * The agent receives an existing task plan and executes it.
 */
function buildTaskExecutionPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  instructions?: string
}): string {
  const customInstructionsSection = params.instructions
    ? `\n## Custom Instructions\n\n${params.instructions}\n`
    : ''

  return `You are a coding assistant. Your job is to execute a task plan that has been prepared for you.

## Task Plan

The following task plan is stored at: ${params.taskPath}

---
${params.taskContent}
---
${customInstructionsSection}
## Instructions

1. Read and understand the task plan above
2. Execute each step in the implementation plan
3. Check off completed items by changing \`- [ ]\` to \`- [x]\` in the task file
4. Update the task file as you make progress
5. If you encounter issues, add notes to the task file

## Working Directory

All work should be done in: ${params.workingDir}

## Progress Tracking

As you complete each step:
1. Make the code changes
2. Update ${params.taskPath} to mark the step as done: \`- [x]\`
3. Add any notes or findings to the task file

Begin executing the task plan now.`
}

/**
 * System prompt for spec review agent.
 * Reviews the quality of the task specification itself (not the codebase).
 */
function buildTaskSpecReviewPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  instructions?: string
}): string {
  const userInstructions = params.instructions?.trim()
    ? `\n## Additional Review Instructions\n${params.instructions.trim()}\n`
    : ""

  return `You are a senior engineering lead reviewing a TASK SPECIFICATION. Your job is to assess the quality of this spec and suggest improvements.

## Context

- Working directory: ${params.workingDir}
- Task file path: ${params.taskPath}

## Current Task Content

${params.taskContent}

## Review Criteria

Evaluate this spec against these criteria:

1. **Clarity** - Is each item unambiguous? Could someone else understand exactly what to do?
2. **Completeness** - Are there missing steps? Edge cases not considered?
3. **Actionability** - Can each checkbox item be completed in a single work session?
4. **Scope** - Is the scope well-defined? Are boundaries clear?
5. **Dependencies** - Are prerequisites and dependencies documented?
6. **Testability** - Can success be objectively measured?

## What to Look For

- Vague language ("improve", "clean up", "handle better")
- Missing error handling or edge cases
- Steps that are too large and should be broken down
- Unclear success criteria
- Missing context that an implementer would need
- Assumptions that should be made explicit
${userInstructions}
## Output

Provide a brief review with:
1. Overall assessment (1-2 sentences)
2. Specific issues found (bulleted list)
3. Suggested improvements (bulleted list)

Keep feedback constructive and actionable. Focus on the top 3-5 most impactful issues.`
}

/**
 * System prompt for task rewrite agent.
 * The agent rewrites the task plan based on user feedback/comments.
 */
function buildTaskRewritePrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  userComment: string
}): string {
  return `You are a task planning expert. Your job is to rewrite an existing task plan based on user feedback.

## Context

- Working directory: ${params.workingDir}
- Task file path: ${params.taskPath}

## Current Task Plan

--- CURRENT_TASK ---
${params.taskContent}
--- END_CURRENT_TASK ---

## User Feedback

The user has requested changes to this task plan:

"""
${params.userComment}
"""

## Your Mission

1. **Understand the feedback**: Analyze what the user wants changed
2. **Explore the codebase**: Use tools (read, glob, grep) to gather context if needed
3. **Rewrite the plan**: Generate a new task plan that incorporates the user's feedback
4. **Maintain quality**: Keep the plan concise, actionable, and well-structured

## Output Requirements

Write the rewritten task plan directly to: ${params.taskPath}

Use the same format as task expansion:

\`\`\`markdown
# [Task Title]

## Problem Statement
What & why (2-3 sentences max)

## Scope
**In:** bullet list
**Out:** bullet list

## Implementation Plan

### Phase: [Name]
- [ ] Action (one clear step, no elaboration)
- [ ] Action

## Key Files
- \`path/file.ts\` - changes needed

## Success Criteria
- [ ] Measurable outcome
\`\`\`

## Rules (CRITICAL)

- **BE CONCISE** - Follow CLAUDE.md style: sacrifice grammar for concision
- Use fragments, not full sentences
- No marketing language or filler
- Each checkbox: one action, no elaboration
- Specific file paths, no vague terms
- **Incorporate user feedback** - address all points they mentioned
- **Keep what works** - if parts of the original plan are good and user didn't mention them, keep them

Begin now. Explore codebase if needed, then write the rewritten plan to ${params.taskPath}.`
}

/**
 * System prompt for multi-agent planning - Implementation Focus Agent.
 * Focuses on code structure, file organization, and dependencies.
 */
function buildPlanAgentPrompt(params: {
  agentIndex: 1 | 2
  title: string
  planPath: string
  workingDir: string
}): string {
  const focus = params.agentIndex === 1
    ? `IMPLEMENTATION DETAILS:
- Code structure and architecture
- File organization and module boundaries
- Dependencies and imports
- API design and interfaces
- Data flow and state management`
    : `EDGE CASES & RISKS:
- Error handling strategies
- Testing approach and coverage
- Rollback plans and recovery
- Performance pitfalls
- Security considerations
- Migration concerns`

  return `You are Planning Agent ${params.agentIndex}. Your role is to analyze a task and create a focused plan.

## Task
"${params.title}"

## Your Focus
${focus}

## Instructions
1. Explore the codebase to understand existing patterns
2. Analyze the task requirements through your specific lens
3. Write your plan to: ${params.planPath}

## Output Format

Write your plan using this structure:

\`\`\`markdown
# Plan: ${params.title} (Agent ${params.agentIndex})

## Analysis
[Your analysis through your specific lens - ${params.agentIndex === 1 ? 'implementation' : 'edge cases'}]

## Proposed Approach
[Key decisions and trade-offs from your perspective]

## Key Files
- \`path/file.ts\` - reason for involvement

## ${params.agentIndex === 1 ? 'Implementation Steps' : 'Risk Mitigation'}
- [ ] Step 1
- [ ] Step 2
...

## Questions & Concerns
- Any unresolved questions
\`\`\`

## Rules
- Be CONCISE - sacrifice grammar for clarity
- Focus ONLY on your assigned perspective
- Specific file paths, not vague descriptions
- Working dir: ${params.workingDir}

Begin exploring the codebase and write your focused plan.`
}

/**
 * System prompt for synthesizing two agent plans into one final plan.
 * Cross-examines both plans and produces a unified approach.
 */
function buildPlanSynthesisPrompt(params: {
  title: string
  parentTaskPath: string
  plan1Path: string
  plan1Content: string
  plan2Path: string
  plan2Content: string
  plan1Failed: boolean
  plan2Failed: boolean
  workingDir: string
}): string {
  const failureNote = (params.plan1Failed || params.plan2Failed)
    ? `\n## Note on Failures
${params.plan1Failed ? `- Agent 1 (Implementation) FAILED - synthesize from available content or note gaps` : ''}
${params.plan2Failed ? `- Agent 2 (Edge Cases) FAILED - synthesize from available content or note gaps` : ''}\n`
    : ''

  return `You are a Planning Synthesizer. Two agents have independently analyzed a task. Your job is to cross-examine their plans and create one unified plan.

## Task
"${params.title}"
${failureNote}
## Agent 1 Plan (Implementation Focus)
Path: ${params.plan1Path}

${params.plan1Content || '_No content available_'}

---

## Agent 2 Plan (Edge Cases Focus)
Path: ${params.plan2Path}

${params.plan2Content || '_No content available_'}

---

## Your Mission

1. **Identify Agreements**: What do both agents agree on?
2. **Resolve Conflicts**: Where do they disagree? Choose the best approach.
3. **Fill Gaps**: What did one agent catch that the other missed?
4. **Combine Strengths**: Merge implementation details with risk mitigation.

## Output

Write the unified plan to: ${params.parentTaskPath}

Use this format:

\`\`\`markdown
# ${params.title}

## Problem Statement
[Synthesized understanding from both agents]

## Scope
**In:** bullet list
**Out:** bullet list

## Implementation Plan

### Phase: [Name]
- [ ] Step (with risk mitigation noted inline where needed)
- [ ] Step

## Key Files
- \`path/file.ts\` - combined rationale

## Risk Mitigation
[Key risks from Agent 2 and how they're addressed]

## Success Criteria
- [ ] Measurable outcome

## Unresolved Questions
- Questions from either agent that need answers
\`\`\`

## Rules
- Be CONCISE - this is the final plan humans will use
- Prefer specificity over generality
- If agents conflict, explain your choice briefly
- Working dir: ${params.workingDir}

Begin synthesis now.`
}

export const tasksRouter = router({
  list: procedure.query(({ ctx }) => {
    return listTasks(ctx.workingDir)
  }),

  get: procedure
    .input(z.object({ path: z.string().min(1) }))
    .query(({ ctx, input }) => {
      return getTask(ctx.workingDir, input.path)
    }),

  /**
   * Get a specific subtask from a parent task.
   */
  getSubtask: procedure
    .input(z.object({
      taskPath: z.string().min(1),
      subtaskId: z.string().min(1),
    }))
    .query(({ ctx, input }) => {
      return getSubtask(ctx.workingDir, input.taskPath, input.subtaskId)
    }),

  /**
   * Update a specific subtask (status, checkboxes, title).
   * Supports optimistic locking via expectedVersion.
   */
  updateSubtask: procedure
    .input(z.object({
      taskPath: z.string().min(1),
      subtaskId: z.string().min(1),
      updates: z.object({
        title: z.string().min(1).optional(),
        status: z.enum(['pending', 'in_progress', 'completed']).optional(),
        checkboxes: z.array(z.object({
          text: z.string(),
          checked: z.boolean(),
        })).optional(),
      }),
      expectedVersion: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return updateSubtask(
        ctx.workingDir,
        input.taskPath,
        input.subtaskId,
        input.updates,
        input.expectedVersion
      )
    }),

  /**
   * Delete a subtask from a parent task.
   */
  deleteSubtask: procedure
    .input(z.object({
      taskPath: z.string().min(1),
      subtaskId: z.string().min(1),
      expectedVersion: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return deleteSubtaskFromTask(
        ctx.workingDir,
        input.taskPath,
        input.subtaskId,
        input.expectedVersion
      )
    }),

  /**
   * Add subtasks to a parent task manually (not from split).
   * Useful for adding individual subtasks via UI.
   */
  addSubtask: procedure
    .input(z.object({
      taskPath: z.string().min(1),
      subtask: z.object({
        title: z.string().min(1),
        checkboxes: z.array(z.object({
          text: z.string(),
          checked: z.boolean(),
        })).default([]),
        status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
      }),
      expectedVersion: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      return addSubtasksToTask(
        ctx.workingDir,
        input.taskPath,
        [input.subtask],
        input.expectedVersion
      )
    }),

  save: procedure
    .input(z.object({
      path: z.string().min(1),
      content: z.string(),
    }))
    .mutation(({ ctx, input }) => {
      return saveTask(ctx.workingDir, input.path, input.content)
    }),

  create: procedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      taskLogger.info('create', `Creating task: ${input.title}`)
      const result = createTask(ctx.workingDir, { title: input.title, content: input.content })
      ensureTaskWorktreeForTaskPath(ctx.workingDir, result.path)
      taskLogger.info('create', 'Task created', { path: result.path })
      return result
    }),

  /**
   * Create a task with agent-powered expansion.
   * Spawns an agent to convert the prompt into a detailed task plan.
   */
  createWithAgent: procedure
    .input(z.object({
      title: z.string().min(1),
      taskType: z.enum(["bug", "feature"]).default("feature"),
      agentType: agentTypeSchema.default("claude"),
      model: z.string().optional(),
      autoRun: z.boolean().default(true),
      /** Include clarifying questions before generating final plan */
      includeQuestions: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate CLI availability before creating task
      validateCLIAvailability(input.agentType)

      // Create the task file first with placeholder content, including autoRun metadata
      const { updateAutoRunInContent } = await import("@/lib/agent/task-service")
      let initialContent = `# ${input.title}\n\n_${input.taskType === 'bug' ? 'Investigating bug...' : 'Generating detailed task plan...'}_\n`
      initialContent = updateAutoRunInContent(initialContent, input.autoRun)

      const { path: taskPath } = createTask(ctx.workingDir, {
        title: input.title,
        content: initialContent,
      })
      ensureTaskWorktreeForTaskPath(ctx.workingDir, taskPath)

      // Build the appropriate prompt based on task type
      // Gate includeQuestions: only pass true if agent supports AskUserQuestion
      const effectiveIncludeQuestions = input.includeQuestions && supportsAskUserQuestion(input.agentType)

      const prompt = input.taskType === 'bug'
        ? buildTaskDebugPrompt({
            title: input.title,
            taskPath,
            workingDir: ctx.workingDir,
          })
        : buildTaskExpansionPrompt({
            title: input.title,
            taskPath,
            workingDir: ctx.workingDir,
            includeQuestions: effectiveIncludeQuestions,
          })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      await monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath,
        title: `${input.taskType === 'bug' ? 'Debug' : 'Plan'}: ${input.title}`,
      })

      return {
        path: taskPath,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Delete a task file.
   * Also terminates and soft-deletes all agent sessions attached to this task.
   */
  delete: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      taskLogger.warn('delete', `Deleting task: ${input.path}`)

      // Get task info (for splitFrom fallback)
      let splitFrom: string | undefined
      try {
        const task = getTask(ctx.workingDir, input.path)
        splitFrom = task.splitFrom
      } catch {
        // Task file may not exist, continue with deletion
      }

      // Read registry to find all sessions attached to this task
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Get all active (non-deleted) sessions for this task
      const sessionIds = getActiveSessionIdsForTask(registryEvents, input.path, splitFrom)

      // Kill daemon processes and soft-delete each session
      if (sessionIds.length > 0) {
        taskLogger.info('delete', `Cleaning up ${sessionIds.length} attached sessions`)
      }
      const monitor = getProcessMonitor()
      for (const sessionId of sessionIds) {
        // Kill daemon if running
        monitor.killDaemon(sessionId)

        // Soft-delete by appending session_deleted event
        await streamAPI.appendToRegistry(
          createRegistryEvent.deleted({ sessionId })
        )
      }

      // Delete the task file
      const result = deleteTask(ctx.workingDir, input.path)
      taskLogger.info('delete', 'Task deleted', { path: input.path, sessionsRemoved: sessionIds.length })
      return result
    }),

  /**
   * Archive a task by moving it to tasks/archive/YYYY-MM/
   * Validates that all task changes are committed before archiving.
   * Commits the archive rename automatically.
   */
  archive: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      taskLogger.info('archive', `Archiving task: ${input.path}`)
      // Check for uncommitted changes before archiving
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const task = getTask(ctx.workingDir, input.path)
      const repoRoot = getGitRoot(ctx.workingDir)
      const taskWorktree = task.taskId && repoRoot
        ? getTaskWorktreeForId(task.taskId, repoRoot)
        : null
      const statusWorkingDir = taskWorktree?.path ?? ctx.workingDir

      // Get active (non-deleted) sessions for this task
      const taskSessionIds = getActiveSessionIdsForTask(registryEvents, input.path, task.splitFrom)

      if (taskSessionIds.length > 0) {
        const changedFilePaths = new Set<string>()
        const { agentRouter } = await import("./agent")
        const caller = agentRouter.createCaller({ workingDir: "" })

        for (const sessionId of taskSessionIds) {
          try {
            const changedFiles = await caller.getChangedFiles({ sessionId })
            for (const file of changedFiles) {
              const pathToCheck = file.repoRelativePath || file.relativePath || file.path
              changedFilePaths.add(pathToCheck)
            }
          } catch {
            continue
          }
        }

        if (changedFilePaths.size > 0) {
          const gitStatus = getGitStatus(statusWorkingDir)
          const uncommittedInGit = new Set<string>()
          for (const f of gitStatus.staged) uncommittedInGit.add(f.file)
          for (const f of gitStatus.modified) uncommittedInGit.add(f.file)
          for (const f of gitStatus.untracked) uncommittedInGit.add(f)

          const uncommittedFiles: string[] = []
          for (const taskFile of changedFilePaths) {
            if (uncommittedInGit.has(taskFile)) {
              uncommittedFiles.push(taskFile)
            }
          }

          if (uncommittedFiles.length > 0) {
            throw new Error(`Cannot archive: ${uncommittedFiles.length} file(s) have uncommitted changes. Commit changes before archiving.`)
          }
        }
      }

      if (taskWorktree && taskWorktree.path !== ctx.workingDir) {
        const worktreeTaskPath = path.join(taskWorktree.path, input.path)
        const baseTaskPath = path.join(ctx.workingDir, input.path)
        if (existsSync(worktreeTaskPath)) {
          mkdirSync(path.dirname(baseTaskPath), { recursive: true })
          const content = readFileSync(worktreeTaskPath, "utf-8")
          writeFileSync(baseTaskPath, content, "utf-8")
        }
      }

      // Check for unrelated staged files before archiving
      const gitStatus = getGitStatus(ctx.workingDir)
      if (gitStatus.staged.length > 0) {
        throw new Error(`Cannot archive: ${gitStatus.staged.length} file(s) are staged. Commit or unstage them before archiving.`)
      }

      // Cleanup worktrees for all task sessions (best-effort, don't fail archive on cleanup errors)
      if (isWorktreeIsolationEnabled() && taskSessionIds.length > 0) {
        if (repoRoot) {
          for (const sessionId of taskSessionIds) {
            try {
              const worktreeInfo = getWorktreeForSession(sessionId, repoRoot)
              if (worktreeInfo) {
                deleteWorktree(worktreeInfo.path, { branch: worktreeInfo.branch, force: true })
              }
            } catch (error) {
              // Log but don't fail archive on worktree cleanup errors
              taskLogger.warn('archive', `Failed to cleanup worktree for session ${sessionId}`, error)
            }
          }
        }
      }

      // Move the file
      const result = archiveTask(ctx.workingDir, input.path)

      // Commit the archive rename
      const commitMessage = generateArchiveCommitMessage(task.title, result.path)
      const commitResult = commitScopedChanges(
        ctx.workingDir,
        [input.path, result.path], // Both old and new paths (git tracks rename)
        commitMessage
      )

      if (!commitResult.success) {
        taskLogger.error('archive', 'Archive commit failed', new Error(commitResult.error))
        throw new Error(`Archive commit failed: ${commitResult.error}`)
      }

      taskLogger.info('archive', 'Task archived successfully', { newPath: result.path, commitHash: commitResult.hash })
      return { ...result, commitHash: commitResult.hash }
    }),

  /**
   * Restore an archived task back to tasks/
   */
  restore: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => {
      taskLogger.info('restore', `Restoring task: ${input.path}`)
      const result = restoreTask(ctx.workingDir, input.path)
      taskLogger.info('restore', 'Task restored', { newPath: result.path })
      return result
    }),

  /**
   * Unarchive a task with context gathering and spawn a new agent session.
   * Restores the task, gathers context from task content + session outputs,
   * and spawns a new agent with user message + context.
   */
  unarchiveWithContext: procedure
    .input(z.object({
      path: z.string().min(1),
      message: z.string().min(1),
      agentType: agentTypeSchema.default("codex"),
      model: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate CLI availability
      validateCLIAvailability(input.agentType)

      // Restore the task first
      const { path: restoredPath } = restoreTask(ctx.workingDir, input.path)

      // Get full task data
      const task = getTask(ctx.workingDir, restoredPath)

      // Gather context from task and sessions
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const sessionIds = resolveTaskSessionIdsFromRegistry(registryEvents, task.path, task.splitFrom)

      // Build context from session outputs
      const sessionContexts: Array<{ sessionId: string; output: string; files: string[] }> = []
      for (const sessionId of sessionIds.slice(-3)) { // Limit to last 3 sessions
        try {
          const sessionEvents = await streamAPI.readSession(sessionId)
          // Extract output text from session events
          const output = sessionEvents
            .filter((e): e is AgentOutputEvent => e.type === "output")
            .map((e) => {
              const chunk = e.chunk
              if (chunk.type === "text") {
                return chunk.content
              }
              return ""
            })
            .join("")
            .slice(-5000) // Limit to last 5000 chars per session

          // Extract edited files
          const { files } = await getEditedFilesForSession(sessionId, registryEvents, streamAPI)
          const filePaths = files.map((f) => f.repoRelativePath || f.relativePath || f.path)

          sessionContexts.push({
            sessionId,
            output,
            files: filePaths,
          })
        } catch {
          // Skip sessions that fail to load
          continue
        }
      }

      // Build prompt with context
      const contextSection = sessionContexts.length > 0
        ? `\n## Previous Session Context\n\nThe following sessions were run on this task before archiving:\n\n${sessionContexts.map((s, i) => `### Session ${i + 1}\nFiles modified: ${s.files.length > 0 ? s.files.map(f => `\`${f}\``).join(", ") : "none"}\n\nRecent output:\n\`\`\`\n${s.output}\n\`\`\`\n`).join("\n")}\n---\n\n`
        : ""

      const prompt = `You are resuming work on an archived task. The user has provided new instructions.

## Task: ${task.title}

### Task Content
\`\`\`markdown
${task.content}
\`\`\`
${contextSection}
## User Instructions

${input.message}

## Your Task

1. Review the task content and previous session context above
2. Follow the user's instructions to resume work on this task
3. Update the task file ${task.path} as you make progress
4. Execute the necessary steps to address the user's instructions

Working directory: ${ctx.workingDir}

Begin working on the task now.`

      // Spawn agent session
      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      await monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: task.path,
        title: `Resume: ${task.title}`,
      })

      return {
        path: task.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Get sections from a task for splitting.
   * Returns sections with 3+ checkboxes each.
   */
  getSections: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const sections = parseSections(task.content)
      return {
        sections,
        title: task.title,
        canSplit: sections.length > 1,
      }
    }),

  /**
   * Split a task into subtasks by section.
   * Appends subtasks to the parent task's ## Subtasks section.
   * If splitting an archived task, restores it first automatically.
   * No longer creates separate files - subtasks are inline in parent.
   */
  splitTask: procedure
    .input(z.object({
      sourcePath: z.string().min(1),
      sectionIndices: z.array(z.number().int().min(0)),
      // archiveOriginal is now ignored (kept for backward compat during transition)
      archiveOriginal: z.boolean().default(false),
      // Optional version for optimistic locking
      expectedVersion: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      let sourcePath = input.sourcePath

      // Handle archived task: restore first, update source path
      const initialTask = getTask(ctx.workingDir, sourcePath)
      if (initialTask.archived) {
        const restored = restoreTask(ctx.workingDir, sourcePath)
        sourcePath = restored.path
      }

      const task = getTask(ctx.workingDir, sourcePath)
      const sections = parseSections(task.content)

      // Validate section indices
      for (const idx of input.sectionIndices) {
        if (idx >= sections.length) {
          throw new Error(`Invalid section index: ${idx}`)
        }
      }

      if (input.sectionIndices.length === 0) {
        throw new Error("No sections selected for split")
      }

      // Check subtask limit
      const newSubtaskCount = input.sectionIndices.length
      if (task.subtasks.length + newSubtaskCount > MAX_SUBTASKS_PER_TASK) {
        throw new Error(
          `Cannot add ${newSubtaskCount} subtasks: would exceed limit of ${MAX_SUBTASKS_PER_TASK}. ` +
          `Current: ${task.subtasks.length}`
        )
      }

      // Build subtasks from selected sections
      const newSubtasks: Omit<SubTask, 'id'>[] = input.sectionIndices.map((idx) => {
        const section = sections[idx]
        return {
          title: section.title,
          checkboxes: section.checkboxes.map((text): CheckboxItem => ({
            text,
            checked: false,
          })),
          status: 'pending' as const,
        }
      })

      // Add subtasks to the parent task
      const updatedTask = addSubtasksToTask(
        ctx.workingDir,
        sourcePath,
        newSubtasks,
        input.expectedVersion
      )

      // Return the new subtask IDs (last N subtasks added)
      const addedSubtaskIds = updatedTask.subtasks
        .slice(-newSubtaskCount)
        .map((st) => st.id)

      return {
        // For backward compat: return empty newPaths (no files created)
        newPaths: [] as string[],
        archivedSource: undefined as string | undefined,
        // New fields for subtask-aware clients
        parentPath: sourcePath,
        subtaskIds: addedSubtaskIds,
        subtaskCount: updatedTask.subtasks.length,
      }
    }),

  /**
   * Assign an existing task to an agent for execution.
   * Spawns an agent that will work through the task plan.
   */
  assignToAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      model: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      taskLogger.info('assignToAgent', `Assigning task to ${input.agentType}`, { path: input.path, model: input.model })
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskExecutionPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        instructions: input.instructions,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      await monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Run: ${task.title}`,
      })

      taskLogger.info('assignToAgent', 'Agent session spawned', { sessionId, agentType: input.agentType })
      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Review the quality of a task spec (clarity, completeness, actionability).
   * Spawns an independent agent session for spec review.
   */
  reviewWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      model: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskSpecReviewPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        instructions: input.instructions,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      await monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Review: ${task.title}`,
        instructions: input.instructions,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Verify completed items against the codebase.
   * Spawns an agent that reads files, runs tests, and checks if items are actually done.
   */
  verifyWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      model: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskVerifyPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        instructions: input.instructions,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      await monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Verify: ${task.title}`,
        instructions: input.instructions,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Rewrite a task plan based on user feedback.
   * Spawns an agent that rewrites the plan according to the user's comment.
   */
  rewriteWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: agentTypeSchema.default("claude"),
      model: z.string().optional(),
      userComment: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskRewritePrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        userComment: input.userComment,
      })

      const sessionId = randomBytes(6).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const daemonNonce = randomBytes(16).toString("hex")

      const monitor = getProcessMonitor()
      await monitor.spawnDaemon({
        sessionId,
        agentType: input.agentType,
        model: input.model,
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.path,
        title: `Rewrite: ${task.title}`,
      })

      return {
        path: input.path,
        sessionId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Get active agent sessions for tasks.
   * Returns a map of taskPath -> session for all tasks with active agents.
   *
   * Uses durable streams instead of process monitor for reliability:
   * - No race conditions during daemon spawn
   * - Survives server restarts
   * - Always consistent with actual session state
   */
  getActiveAgentSessions: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    // Track deleted sessions
    const deletedSessionIds = new Set<string>()
    for (const event of registryEvents) {
      if (event.type === "session_deleted") {
        deletedSessionIds.add(event.sessionId)
      }
    }

    // Find all session_created events with taskPath (exclude deleted sessions)
    const taskSessions: Record<string, { sessionId: string; status: SessionStatus }> = {}

    for (const event of registryEvents) {
      if (
        event.type === "session_created" &&
        event.taskPath &&
        !deletedSessionIds.has(event.sessionId)
      ) {
        // Find the latest status for this session
        const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
        const latestStatusEvent = [...sessionEvents]
          .reverse()
          .find((e) =>
            e.type === "session_updated" ||
            e.type === "session_completed" ||
            e.type === "session_failed" ||
            e.type === "session_cancelled"
          )

        let status: SessionStatus = "pending"
        if (latestStatusEvent) {
          if (latestStatusEvent.type === "session_updated") {
            status = latestStatusEvent.status
          } else if (latestStatusEvent.type === "session_completed") {
            status = "completed"
          } else if (latestStatusEvent.type === "session_failed") {
            status = "failed"
          } else if (latestStatusEvent.type === "session_cancelled") {
            status = "cancelled"
          }
        }

        // Only include active sessions (not completed, failed, or cancelled)
        const activeStatuses: SessionStatus[] = ["pending", "running", "working", "waiting_approval", "waiting_input", "idle"]
        if (activeStatuses.includes(status)) {
          // Use the most recent active session for each task
          taskSessions[event.taskPath] = {
            sessionId: event.sessionId,
            status,
          }
        }
      }
    }

    return taskSessions
  }),

  /**
   * Get tasks that have failed sessions (for sidebar error indicators).
   * Returns a record of taskPath -> true for tasks with at least one failed session.
   * Excludes deleted sessions.
   */
  getTasksWithFailedSessions: procedure.query(async () => {
    const streamAPI = getStreamAPI()
    const registryEvents = await streamAPI.readRegistry()

    const failedMap = getTaskFailedSessionsMap(registryEvents)

    // Convert Map to plain object for JSON serialization
    const result: Record<string, boolean> = {}
    for (const [taskPath, hasFailed] of failedMap) {
      result[taskPath] = hasFailed
    }

    return result
  }),

  /**
   * Get all sessions related to a task (planning, review, verify, execution).
   * Returns sessions grouped by type and sorted by timestamp.
   */
  getSessionsForTask: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Find all session_created events for this task
      const taskSessions = registryEvents
        .filter((event): event is Extract<RegistryEvent, { type: "session_created" }> =>
          event.type === "session_created" && event.taskPath === input.path
        )
        .map((event) => {
          // Find the latest status for this session
          const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
          const latestStatusEvent = [...sessionEvents]
            .reverse()
            .find((e) =>
              e.type === "session_updated" ||
              e.type === "session_completed" ||
              e.type === "session_failed" ||
              e.type === "session_cancelled"
            )

          let status: SessionStatus = "pending"
          if (latestStatusEvent) {
            if (latestStatusEvent.type === "session_updated") {
              status = latestStatusEvent.status
            } else if (latestStatusEvent.type === "session_completed") {
              status = "completed"
            } else if (latestStatusEvent.type === "session_failed") {
              status = "failed"
            } else if (latestStatusEvent.type === "session_cancelled") {
              status = "cancelled"
            }
          }

          // Determine session type based on title prefix or sourceFile presence
          let sessionType: "planning" | "review" | "verify" | "execution" | "debug" | "rewrite" | "comment" | "orchestrator" = "execution"

          // Comment sessions take precedence (file-originated threads)
          if (event.sourceFile) {
            sessionType = "comment"
          } else if (event.title) {
            const titleLower = event.title.toLowerCase()
            // Check for orchestrator first (synthesis of debug sessions)
            if (titleLower.startsWith("orchestrator:")) {
              sessionType = "orchestrator"
            // Check for multi-agent debug: "debug (N):" or single agent: "debug:"
            } else if (titleLower.startsWith("plan:") || titleLower.startsWith("debug:") || /^debug \(\d+\):/.test(titleLower)) {
              sessionType = "planning"
            } else if (titleLower.startsWith("review:")) {
              sessionType = "review"
            } else if (titleLower.startsWith("verify:")) {
              sessionType = "verify"
            } else if (titleLower.startsWith("rewrite:")) {
              sessionType = "rewrite"
            } else if (titleLower.startsWith("run:")) {
              sessionType = "execution"
            }
          }

          return {
            sessionId: event.sessionId,
            agentType: event.agentType,
            title: event.title || "Untitled Session",
            status,
            timestamp: event.timestamp,
            sessionType,
            model: event.model,
            sourceFile: event.sourceFile,
            sourceLine: event.sourceLine,
            debugRunId: event.debugRunId,
          }
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Group by session type
      const grouped = {
        planning: taskSessions.filter((s) => s.sessionType === "planning"),
        review: taskSessions.filter((s) => s.sessionType === "review"),
        verify: taskSessions.filter((s) => s.sessionType === "verify"),
        execution: taskSessions.filter((s) => s.sessionType === "execution"),
        rewrite: taskSessions.filter((s) => s.sessionType === "rewrite"),
        comment: taskSessions.filter((s) => s.sessionType === "comment"),
        orchestrator: taskSessions.filter((s) => s.sessionType === "orchestrator"),
      }

      return {
        all: taskSessions,
        grouped,
      }
    }),

  /**
   * Get all files changed across all sessions for a task.
   * Aggregates changed files from all task sessions (planning, review, verify, execution).
   * Includes session worktree path for proper git operations.
   *
   * OPTIMIZED: Uses parallel session queries instead of sequential.
   */
  getChangedFilesForTask: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const task = getTask(ctx.workingDir, input.path)

      // Find all active (non-deleted) session IDs for this task (fallback to splitFrom when needed)
      const taskSessionIds = getActiveSessionIdsForTask(registryEvents, input.path, task.splitFrom)

      if (taskSessionIds.length === 0) {
        return []
      }

      // Get repo root for worktree lookups
      const repoRoot = getGitRoot(ctx.workingDir)
      const worktreeEnabled = isWorktreeIsolationEnabled()

      // OPTIMIZED: Fetch edited files directly using the pre-read registry events.
      // This avoids N+1 registry reads that occurred when calling agentRouter.getChangedFiles
      const sessionResults = await Promise.all(
        taskSessionIds.map(async (sessionId) => {
          try {
            // Use optimized helper that reuses the already-read registry events
            const { files: changedFiles } = await getEditedFilesForSession(
              sessionId,
              registryEvents,
              streamAPI
            )

            // Get session's worktree path if it exists
            let sessionWorkingDir: string | undefined
            if (repoRoot && worktreeEnabled) {
              const worktreeInfo = getWorktreeForSession(sessionId, repoRoot)
              if (worktreeInfo) {
                sessionWorkingDir = worktreeInfo.path
              }
            }

            return { sessionId, changedFiles, sessionWorkingDir }
          } catch {
            return null // Skip sessions that can't be read
          }
        })
      )

      // Aggregate changed files from all sessions
      const allFiles = new Map<string, {
        path: string
        relativePath?: string
        repoRelativePath?: string
        operation: "create" | "edit" | "delete"
        timestamp: string
        toolUsed: string
        sessionId: string
        sessionWorkingDir?: string
      }>()

      for (const result of sessionResults) {
        if (!result) continue
        const { sessionId, changedFiles, sessionWorkingDir } = result

        for (const file of changedFiles) {
          // Use the latest operation for each file path
          const existing = allFiles.get(file.path)
          if (!existing || new Date(file.timestamp) > new Date(existing.timestamp)) {
            allFiles.set(file.path, {
              path: file.path,
              relativePath: file.relativePath,
              repoRelativePath: file.repoRelativePath,
              operation: file.operation,
              timestamp: file.timestamp,
              toolUsed: file.toolUsed,
              sessionId,
              sessionWorkingDir,
            })
          }
        }
      }

      // Convert map to array and sort by timestamp (newest first)
      return Array.from(allFiles.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }),

  /**
   * Check if a task has uncommitted changes.
   * Aggregates changed files from all task sessions and checks git status
   * from each session's worktree (or main repo if no worktree).
   *
   * OPTIMIZED: Uses parallel session queries instead of sequential.
   */
  hasUncommittedChanges: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const task = getTask(ctx.workingDir, input.path)

      // Find all active (non-deleted) session IDs for this task (fallback to splitFrom when needed)
      const taskSessionIds = getActiveSessionIdsForTask(registryEvents, input.path, task.splitFrom)

      if (taskSessionIds.length === 0) {
        return { hasUncommitted: false, uncommittedCount: 0, uncommittedFiles: [] }
      }

      // Get repo root for worktree lookups
      const repoRoot = getGitRoot(ctx.workingDir)
      const worktreeEnabled = isWorktreeIsolationEnabled()

      // OPTIMIZED: Fetch edited files directly using the pre-read registry events.
      // This avoids N+1 registry reads that occurred when calling agentRouter.getChangedFiles
      const sessionResults = await Promise.all(
        taskSessionIds.map(async (sessionId) => {
          try {
            // Use optimized helper that reuses the already-read registry events
            const { files: changedFiles } = await getEditedFilesForSession(
              sessionId,
              registryEvents,
              streamAPI
            )

            // Determine working directory for this session
            let sessionWorkingDir = ctx.workingDir
            if (repoRoot && worktreeEnabled) {
              const worktreeInfo = getWorktreeForSession(sessionId, repoRoot)
              if (worktreeInfo) {
                sessionWorkingDir = worktreeInfo.path
              }
            }

            // Track files for this session
            const filePaths = new Set<string>()
            for (const file of changedFiles) {
              const pathToCheck = file.repoRelativePath || file.relativePath || file.path
              filePaths.add(pathToCheck)
            }

            return { sessionId, filePaths, sessionWorkingDir }
          } catch {
            return null // Skip sessions that can't be read
          }
        })
      )

      // Collect valid results
      const sessionFiles = new Map<string, { files: Set<string>; workingDir: string }>()
      for (const result of sessionResults) {
        if (result && result.filePaths.size > 0) {
          sessionFiles.set(result.sessionId, {
            files: result.filePaths,
            workingDir: result.sessionWorkingDir,
          })
        }
      }

      if (sessionFiles.size === 0) {
        return { hasUncommitted: false, uncommittedCount: 0, uncommittedFiles: [] }
      }

      // Query git status from each unique working directory and aggregate uncommitted files
      const uncommittedFiles = new Set<string>()
      const gitStatusCache = new Map<string, Set<string>>()

      for (const [, { files, workingDir }] of sessionFiles) {
        // Cache git status per workingDir to avoid redundant queries
        let uncommittedInGit = gitStatusCache.get(workingDir)
        if (!uncommittedInGit) {
          const gitStatus = getGitStatus(workingDir)
          uncommittedInGit = new Set<string>()
          for (const f of gitStatus.staged) uncommittedInGit.add(f.file)
          for (const f of gitStatus.modified) uncommittedInGit.add(f.file)
          for (const f of gitStatus.untracked) uncommittedInGit.add(f)
          gitStatusCache.set(workingDir, uncommittedInGit)
        }

        // Check which of this session's files are uncommitted
        for (const filePath of files) {
          if (uncommittedInGit.has(filePath)) {
            uncommittedFiles.add(filePath)
          }
        }
      }

      return {
        hasUncommitted: uncommittedFiles.size > 0,
        uncommittedCount: uncommittedFiles.size,
        uncommittedFiles: Array.from(uncommittedFiles),
      }
    }),

  /**
   * OPTIMIZED: Combined endpoint for review page that returns both changed files
   * AND uncommitted status in a single query with parallel session fetching.
   *
   * This eliminates duplicate session queries that occurred when calling
   * getChangedFilesForTask and hasUncommittedChanges separately.
   */
  getReviewData: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const task = getTask(ctx.workingDir, input.path)

      // Find all active (non-deleted) session IDs for this task
      const taskSessionIds = getActiveSessionIdsForTask(registryEvents, input.path, task.splitFrom)

      if (taskSessionIds.length === 0) {
        return {
          changedFiles: [],
          hasUncommitted: false,
          uncommittedCount: 0,
          uncommittedFiles: [],
        }
      }

      // Get repo root for worktree lookups
      const repoRoot = getGitRoot(ctx.workingDir)
      const worktreeEnabled = isWorktreeIsolationEnabled()

      // OPTIMIZED: Fetch edited files directly using the pre-read registry events.
      // This avoids N+1 registry reads that occurred when calling agentRouter.getChangedFiles
      // which re-reads the entire registry for each session.
      const sessionResults = await Promise.all(
        taskSessionIds.map(async (sessionId) => {
          try {
            // Use optimized helper that reuses the already-read registry events
            const { files: changedFiles } = await getEditedFilesForSession(
              sessionId,
              registryEvents,
              streamAPI
            )

            // Determine session working directory (worktree or main repo)
            let sessionWorkingDir = ctx.workingDir
            if (repoRoot && worktreeEnabled) {
              const worktreeInfo = getWorktreeForSession(sessionId, repoRoot)
              if (worktreeInfo) {
                sessionWorkingDir = worktreeInfo.path
              }
            }

            return { sessionId, changedFiles, sessionWorkingDir }
          } catch {
            return null
          }
        })
      )

      // Build changed files map and collect per-session file sets
      // Key by gitPath (repoRelativePath) to dedupe files across worktrees
      const allFiles = new Map<string, {
        path: string
        relativePath?: string
        repoRelativePath?: string
        operation: "create" | "edit" | "delete"
        timestamp: string
        toolUsed: string
        sessionId: string
        sessionWorkingDir?: string
      }>()
      const sessionFileSets = new Map<string, { gitPaths: Set<string>; workingDir: string }>()

      for (const result of sessionResults) {
        if (!result) continue
        const { sessionId, changedFiles, sessionWorkingDir } = result

        const gitPaths = new Set<string>()
        for (const file of changedFiles) {
          // Compute git-relative path for deduplication
          const gitPath = file.repoRelativePath || file.relativePath || file.path
          // Aggregate for changed files output - dedupe by gitPath to avoid duplicates across worktrees
          const existing = allFiles.get(gitPath)
          if (!existing || new Date(file.timestamp) > new Date(existing.timestamp)) {
            allFiles.set(gitPath, {
              path: file.path,
              relativePath: file.relativePath,
              repoRelativePath: file.repoRelativePath,
              operation: file.operation,
              timestamp: file.timestamp,
              toolUsed: file.toolUsed,
              sessionId,
              sessionWorkingDir,
            })
          }
          // Track git path for uncommitted check
          gitPaths.add(gitPath)
        }

        if (gitPaths.size > 0) {
          sessionFileSets.set(sessionId, { gitPaths, workingDir: sessionWorkingDir })
        }
      }

      // Build changed files array
      const changedFiles = Array.from(allFiles.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      // Calculate uncommitted status using cached git status per workingDir
      const uncommittedFiles = new Set<string>()
      const gitStatusCache = new Map<string, Set<string>>()

      for (const [, { gitPaths, workingDir }] of sessionFileSets) {
        let uncommittedInGit = gitStatusCache.get(workingDir)
        if (!uncommittedInGit) {
          const gitStatus = getGitStatus(workingDir)
          uncommittedInGit = new Set<string>()
          for (const f of gitStatus.staged) uncommittedInGit.add(f.file)
          for (const f of gitStatus.modified) uncommittedInGit.add(f.file)
          for (const f of gitStatus.untracked) uncommittedInGit.add(f)
          gitStatusCache.set(workingDir, uncommittedInGit)
        }

        for (const gitPath of gitPaths) {
          if (uncommittedInGit.has(gitPath)) {
            uncommittedFiles.add(gitPath)
          }
        }
      }

      return {
        changedFiles,
        hasUncommitted: uncommittedFiles.size > 0,
        uncommittedCount: uncommittedFiles.size,
        uncommittedFiles: Array.from(uncommittedFiles),
      }
    }),

  /**
   * Get all tasks with splitFrom comments that can be migrated to subtasks.
   * Returns a preview of what would be migrated.
   */
  getMigrationPreview: procedure.query(({ ctx }) => {
    const splitFromGroups = findSplitFromTasks(ctx.workingDir)
    const preview: Array<{
      parentPath: string
      childTasks: Array<{ path: string; title: string }>
    }> = []

    for (const [parentPath, childTasks] of splitFromGroups) {
      preview.push({
        parentPath,
        childTasks: childTasks.map((t) => ({ path: t.path, title: t.title })),
      })
    }

    return {
      totalToMigrate: Array.from(splitFromGroups.values()).reduce((sum, tasks) => sum + tasks.length, 0),
      groups: preview,
    }
  }),

  /**
   * Migrate all splitFrom tasks to subtasks.
   * This is a one-time migration operation.
   */
  migrateToSubtasks: procedure.mutation(({ ctx }) => {
    return migrateAllSplitFromTasks(ctx.workingDir)
  }),

  /**
   * Debug a bug task with multiple agents concurrently.
   * Spawns N independent debug sessions that all work on the same bug.
   * Each agent runs in its own isolated worktree.
   */
  debugWithAgents: procedure
    .input(z.object({
      title: z.string().min(1),
      agents: z.array(z.object({
        agentType: agentTypeSchema,
        model: z.string().optional(),
      })).min(1).max(5),
      autoRun: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate CLI availability for all agents before creating task
      for (const agent of input.agents) {
        validateCLIAvailability(agent.agentType)
      }

      // Create the task file first with placeholder content, including autoRun metadata
      const { updateAutoRunInContent } = await import("@/lib/agent/task-service")
      let initialContent = `# ${input.title}\n\n_Investigating bug with ${input.agents.length} agent(s)..._\n`
      initialContent = updateAutoRunInContent(initialContent, input.autoRun)

      const { path: taskPath } = createTask(ctx.workingDir, {
        title: input.title,
        content: initialContent,
      })
      ensureTaskWorktreeForTaskPath(ctx.workingDir, taskPath)

      // Build the debug prompt (same for all agents)
      const prompt = buildTaskDebugPrompt({
        title: input.title,
        taskPath,
        workingDir: ctx.workingDir,
      })

      const monitor = getProcessMonitor()
      const streamServerUrl = getStreamServerUrl()
      const sessionIds: string[] = []

      // Generate a debug run ID to group all sessions in this run
      const debugRunId = randomBytes(8).toString("hex")

      // Spawn each agent with a numbered title
      for (let i = 0; i < input.agents.length; i++) {
        const agent = input.agents[i]
        const sessionId = randomBytes(6).toString("hex")
        const daemonNonce = randomBytes(16).toString("hex")

        await monitor.spawnDaemon({
          sessionId,
          agentType: agent.agentType,
          model: agent.model,
          prompt,
          workingDir: ctx.workingDir,
          streamServerUrl,
          daemonNonce,
          taskPath,
          title: `Debug (${i + 1}): ${input.title}`,
          debugRunId,
        })

        sessionIds.push(sessionId)
      }

      return {
        path: taskPath,
        sessionIds,
        debugRunId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Get the status of a debug run (group of debug sessions).
   * Returns whether all sessions are terminal and their individual statuses.
   */
  getDebugRunStatus: procedure
    .input(z.object({
      debugRunId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Find all sessions in this debug run
      const debugSessions: Array<{
        sessionId: string
        status: SessionStatus
        agentType: string
        title?: string
      }> = []

      // Track deleted sessions
      const deletedSessionIds = new Set<string>()
      for (const event of registryEvents) {
        if (event.type === "session_deleted") {
          deletedSessionIds.add(event.sessionId)
        }
      }

      for (const event of registryEvents) {
        if (
          event.type === "session_created" &&
          event.debugRunId === input.debugRunId &&
          !deletedSessionIds.has(event.sessionId)
        ) {
          // Find the latest status for this session
          const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
          const latestStatusEvent = [...sessionEvents]
            .reverse()
            .find((e) =>
              e.type === "session_updated" ||
              e.type === "session_completed" ||
              e.type === "session_failed" ||
              e.type === "session_cancelled"
            )

          let status: SessionStatus = "pending"
          if (latestStatusEvent) {
            if (latestStatusEvent.type === "session_updated") {
              status = latestStatusEvent.status
            } else if (latestStatusEvent.type === "session_completed") {
              status = "completed"
            } else if (latestStatusEvent.type === "session_failed") {
              status = "failed"
            } else if (latestStatusEvent.type === "session_cancelled") {
              status = "cancelled"
            }
          }

          debugSessions.push({
            sessionId: event.sessionId,
            status,
            agentType: event.agentType,
            title: event.title,
          })
        }
      }

      // Check if all sessions are terminal
      const terminalStatuses: SessionStatus[] = ["completed", "failed", "cancelled"]
      const allTerminal = debugSessions.length > 0 &&
        debugSessions.every((s) => terminalStatuses.includes(s.status))

      return {
        debugRunId: input.debugRunId,
        sessions: debugSessions,
        allTerminal,
        totalCount: debugSessions.length,
        completedCount: debugSessions.filter((s) => s.status === "completed").length,
        failedCount: debugSessions.filter((s) => s.status === "failed").length,
        cancelledCount: debugSessions.filter((s) => s.status === "cancelled").length,
      }
    }),

  /**
   * Spawn an orchestrator session to synthesize findings from a debug run.
   * Idempotent: returns existing orchestrator session if one already exists.
   */
  orchestrateDebugRun: procedure
    .input(z.object({
      debugRunId: z.string().min(1),
      taskPath: z.string().min(1),
      /** Force spawn even if orchestrator already exists */
      force: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Check for existing orchestrator session for this debug run (idempotency)
      if (!input.force) {
        const existingOrchestrator = registryEvents.find(
          (e) =>
            e.type === "session_created" &&
            e.title?.startsWith("Orchestrator:") &&
            e.debugRunId === input.debugRunId
        )

        if (existingOrchestrator && existingOrchestrator.type === "session_created") {
          // Return existing orchestrator session
          return {
            sessionId: existingOrchestrator.sessionId,
            isNew: false,
          }
        }
      }

      // Track deleted sessions
      const deletedSessionIds = new Set<string>()
      for (const event of registryEvents) {
        if (event.type === "session_deleted") {
          deletedSessionIds.add(event.sessionId)
        }
      }

      // Find all debug sessions in this run
      const debugSessionInfos: Array<{
        sessionId: string
        agentType: string
        title?: string
        status: SessionStatus
        taskPath?: string
      }> = []

      for (const event of registryEvents) {
        if (
          event.type === "session_created" &&
          event.debugRunId === input.debugRunId &&
          !event.title?.startsWith("Orchestrator:") &&
          !deletedSessionIds.has(event.sessionId)
        ) {
          // Find the latest status for this session
          const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
          const latestStatusEvent = [...sessionEvents]
            .reverse()
            .find((e) =>
              e.type === "session_updated" ||
              e.type === "session_completed" ||
              e.type === "session_failed" ||
              e.type === "session_cancelled"
            )

          let status: SessionStatus = "pending"
          if (latestStatusEvent) {
            if (latestStatusEvent.type === "session_updated") {
              status = latestStatusEvent.status
            } else if (latestStatusEvent.type === "session_completed") {
              status = "completed"
            } else if (latestStatusEvent.type === "session_failed") {
              status = "failed"
            } else if (latestStatusEvent.type === "session_cancelled") {
              status = "cancelled"
            }
          }

          debugSessionInfos.push({
            sessionId: event.sessionId,
            agentType: event.agentType,
            title: event.title,
            status,
            taskPath: event.taskPath,
          })
        }
      }

      if (debugSessionInfos.length === 0) {
        throw new Error(`No debug sessions found for debug run ${input.debugRunId}`)
      }

      // Check if all sessions are terminal
      const terminalStatuses: SessionStatus[] = ["completed", "failed", "cancelled"]
      const allTerminal = debugSessionInfos.every((s) => terminalStatuses.includes(s.status))

      if (!allTerminal) {
        throw new Error("Cannot orchestrate: not all debug sessions are terminal")
      }

      // Gather output from all sessions
      const sessionOutputs: Array<{
        sessionId: string
        agentType: string
        title?: string
        status: SessionStatus
        output: string
      }> = []

      for (const sessionInfo of debugSessionInfos) {
        const sessionEvents = await streamAPI.readSession(sessionInfo.sessionId)

        // Extract text output chunks
        const outputChunks = sessionEvents
          .filter((e) => e.type === "output" && (e.chunk.type === "text" || e.chunk.type === "tool_use" || e.chunk.type === "tool_result"))
          .map((e) => {
            if (e.type !== "output") return ""
            return e.chunk.content
          })

        sessionOutputs.push({
          sessionId: sessionInfo.sessionId,
          agentType: sessionInfo.agentType,
          title: sessionInfo.title,
          status: sessionInfo.status,
          output: outputChunks.join("\n"),
        })
      }

      // Get task info for the prompt
      const task = getTask(ctx.workingDir, input.taskPath)

      // Build orchestrator prompt
      const prompt = buildDebugOrchestratorPrompt({
        title: task.title,
        taskPath: input.taskPath,
        workingDir: ctx.workingDir,
        sessions: sessionOutputs,
      })

      // Spawn codex orchestrator session
      const sessionId = randomBytes(6).toString("hex")
      const daemonNonce = randomBytes(16).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const monitor = getProcessMonitor()

      await monitor.spawnDaemon({
        sessionId,
        agentType: "codex",
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.taskPath,
        title: `Orchestrator: ${task.title}`,
        debugRunId: input.debugRunId,
      })

      return {
        sessionId,
        isNew: true,
      }
    }),

  // === Multi-Agent Planning ===

  /**
   * Plan a task with 2 independent agents that write separate plan files.
   * Agent 1 focuses on implementation, Agent 2 focuses on edge cases.
   * After both complete, orchestratePlanRun synthesizes the final plan.
   */
  planWithAgents: procedure
    .input(z.object({
      title: z.string().min(1),
      agents: z.array(z.object({
        agentType: agentTypeSchema,
        model: z.string().optional(),
      })).length(2), // Exactly 2 agents
      autoRun: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate CLI availability for all agents before creating task
      for (const agent of input.agents) {
        validateCLIAvailability(agent.agentType)
      }

      const { slugifyTitle } = await import("@/lib/utils/slugify")
      const { existsSync, mkdirSync } = await import("fs")
      const path = await import("path")

      // Create task directory structure: tasks/{slug}/
      const taskSlug = slugifyTitle(input.title)
      const taskDir = `tasks/${taskSlug}`
      const taskDirAbs = path.join(ctx.workingDir, taskDir)
      mkdirSync(taskDirAbs, { recursive: true })

      // Create plan file paths
      const plan1Path = `${taskDir}/plan-agent-1.md`
      const plan2Path = `${taskDir}/plan-agent-2.md`
      const parentTaskPath = `tasks/${taskSlug}.md`

      // Create placeholder plan files
      const plan1Placeholder = `# Plan: ${input.title} (Agent 1 - Implementation)\n\n_Generating plan..._\n`
      const plan2Placeholder = `# Plan: ${input.title} (Agent 2 - Edge Cases)\n\n_Generating plan..._\n`
      saveTask(ctx.workingDir, plan1Path, plan1Placeholder)
      saveTask(ctx.workingDir, plan2Path, plan2Placeholder)

      // Create parent task file with links to child plans
      const { updateAutoRunInContent } = await import("@/lib/agent/task-service")
      let parentContent = `# ${input.title}

_Generating plans with 2 agents..._

## Plan Files
- [Agent 1 (Implementation)](${taskSlug}/plan-agent-1.md)
- [Agent 2 (Edge Cases)](${taskSlug}/plan-agent-2.md)
`
      parentContent = updateAutoRunInContent(parentContent, input.autoRun)
      saveTask(ctx.workingDir, parentTaskPath, parentContent)
      ensureTaskWorktreeForTaskPath(ctx.workingDir, parentTaskPath)
      ensureTaskWorktreeForTaskPath(ctx.workingDir, plan1Path)
      ensureTaskWorktreeForTaskPath(ctx.workingDir, plan2Path)

      // Generate plan run ID to group both sessions
      const planRunId = randomBytes(8).toString("hex")

      const monitor = getProcessMonitor()
      const streamServerUrl = getStreamServerUrl()
      const sessionIds: string[] = []

      // Spawn both agents
      for (let i = 0; i < 2; i++) {
        const agent = input.agents[i]
        const agentIndex = (i + 1) as 1 | 2
        const planPath = agentIndex === 1 ? plan1Path : plan2Path

        const prompt = buildPlanAgentPrompt({
          agentIndex,
          title: input.title,
          planPath,
          workingDir: ctx.workingDir,
        })

        const sessionId = randomBytes(6).toString("hex")
        const daemonNonce = randomBytes(16).toString("hex")

        await monitor.spawnDaemon({
          sessionId,
          agentType: agent.agentType,
          model: agent.model,
          prompt,
          workingDir: ctx.workingDir,
          streamServerUrl,
          daemonNonce,
          taskPath: planPath, // Each agent writes to its own plan file
          title: `Plan (${agentIndex}): ${input.title}`,
          planRunId,
        })

        sessionIds.push(sessionId)
      }

      return {
        path: parentTaskPath,
        taskDir,
        planPaths: [plan1Path, plan2Path],
        sessionIds,
        planRunId,
        status: "pending" as SessionStatus,
      }
    }),

  /**
   * Get the status of a plan run (group of planning sessions).
   * Returns whether all sessions are terminal and their individual statuses.
   */
  getPlanRunStatus: procedure
    .input(z.object({
      planRunId: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()

      // Find all sessions in this plan run
      const planSessions: Array<{
        sessionId: string
        status: SessionStatus
        agentType: string
        title?: string
        taskPath?: string
      }> = []

      // Track deleted sessions
      const deletedSessionIds = new Set<string>()
      for (const event of registryEvents) {
        if (event.type === "session_deleted") {
          deletedSessionIds.add(event.sessionId)
        }
      }

      for (const event of registryEvents) {
        if (
          event.type === "session_created" &&
          event.planRunId === input.planRunId &&
          !deletedSessionIds.has(event.sessionId)
        ) {
          // Find the latest status for this session
          const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
          const latestStatusEvent = [...sessionEvents]
            .reverse()
            .find((e) =>
              e.type === "session_updated" ||
              e.type === "session_completed" ||
              e.type === "session_failed" ||
              e.type === "session_cancelled"
            )

          let status: SessionStatus = "pending"
          if (latestStatusEvent) {
            if (latestStatusEvent.type === "session_updated") {
              status = latestStatusEvent.status
            } else if (latestStatusEvent.type === "session_completed") {
              status = "completed"
            } else if (latestStatusEvent.type === "session_failed") {
              status = "failed"
            } else if (latestStatusEvent.type === "session_cancelled") {
              status = "cancelled"
            }
          }

          planSessions.push({
            sessionId: event.sessionId,
            status,
            agentType: event.agentType,
            title: event.title,
            taskPath: event.taskPath,
          })
        }
      }

      // Check if all sessions are terminal (including failed/cancelled)
      const terminalStatuses: SessionStatus[] = ["completed", "failed", "cancelled"]
      const allTerminal = planSessions.length > 0 &&
        planSessions.every((s) => terminalStatuses.includes(s.status))

      return {
        planRunId: input.planRunId,
        sessions: planSessions,
        allTerminal,
        totalCount: planSessions.length,
        completedCount: planSessions.filter((s) => s.status === "completed").length,
        failedCount: planSessions.filter((s) => s.status === "failed").length,
        cancelledCount: planSessions.filter((s) => s.status === "cancelled").length,
      }
    }),

  /**
   * Spawn an orchestrator session to synthesize findings from a plan run.
   * Reads plan files from disk and synthesizes them into the parent task.
   * Runs even if one agent failed (notes failure in synthesis).
   */
  orchestratePlanRun: procedure
    .input(z.object({
      planRunId: z.string().min(1),
      parentTaskPath: z.string().min(1),
      plan1Path: z.string().min(1),
      plan2Path: z.string().min(1),
      /** Force spawn even if orchestrator already exists */
      force: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const streamAPI = getStreamAPI()
      const registryEvents = await streamAPI.readRegistry()
      const { existsSync, readFileSync } = await import("fs")
      const path = await import("path")

      // Check for existing orchestrator session for this plan run (idempotency)
      if (!input.force) {
        const existingOrchestrator = registryEvents.find(
          (e) =>
            e.type === "session_created" &&
            e.title?.startsWith("Synthesize:") &&
            e.planRunId === input.planRunId
        )

        if (existingOrchestrator && existingOrchestrator.type === "session_created") {
          return {
            sessionId: existingOrchestrator.sessionId,
            isNew: false,
          }
        }
      }

      // Track deleted sessions
      const deletedSessionIds = new Set<string>()
      for (const event of registryEvents) {
        if (event.type === "session_deleted") {
          deletedSessionIds.add(event.sessionId)
        }
      }

      // Find plan sessions to check their status
      const planSessions: Array<{
        sessionId: string
        status: SessionStatus
        taskPath?: string
      }> = []

      for (const event of registryEvents) {
        if (
          event.type === "session_created" &&
          event.planRunId === input.planRunId &&
          !event.title?.startsWith("Synthesize:") &&
          !deletedSessionIds.has(event.sessionId)
        ) {
          const sessionEvents = registryEvents.filter((e) => e.sessionId === event.sessionId)
          const latestStatusEvent = [...sessionEvents]
            .reverse()
            .find((e) =>
              e.type === "session_updated" ||
              e.type === "session_completed" ||
              e.type === "session_failed" ||
              e.type === "session_cancelled"
            )

          let status: SessionStatus = "pending"
          if (latestStatusEvent) {
            if (latestStatusEvent.type === "session_updated") {
              status = latestStatusEvent.status
            } else if (latestStatusEvent.type === "session_completed") {
              status = "completed"
            } else if (latestStatusEvent.type === "session_failed") {
              status = "failed"
            } else if (latestStatusEvent.type === "session_cancelled") {
              status = "cancelled"
            }
          }

          planSessions.push({
            sessionId: event.sessionId,
            status,
            taskPath: event.taskPath,
          })
        }
      }

      // Check if all sessions are terminal
      const terminalStatuses: SessionStatus[] = ["completed", "failed", "cancelled"]
      const allTerminal = planSessions.every((s) => terminalStatuses.includes(s.status))

      if (!allTerminal) {
        throw new Error("Cannot orchestrate: not all plan sessions are terminal")
      }

      // Determine which agents failed (by task path)
      const plan1Session = planSessions.find((s) => s.taskPath === input.plan1Path)
      const plan2Session = planSessions.find((s) => s.taskPath === input.plan2Path)
      const plan1Failed = !plan1Session || plan1Session.status !== "completed"
      const plan2Failed = !plan2Session || plan2Session.status !== "completed"

      // Read plan files from disk
      const plan1AbsPath = path.join(ctx.workingDir, input.plan1Path)
      const plan2AbsPath = path.join(ctx.workingDir, input.plan2Path)

      let plan1Content = ""
      let plan2Content = ""

      try {
        if (existsSync(plan1AbsPath)) {
          plan1Content = readFileSync(plan1AbsPath, "utf-8")
        }
      } catch {
        // Plan file doesn't exist or can't be read
      }

      try {
        if (existsSync(plan2AbsPath)) {
          plan2Content = readFileSync(plan2AbsPath, "utf-8")
        }
      } catch {
        // Plan file doesn't exist or can't be read
      }

      // Get parent task info for the title
      const parentTask = getTask(ctx.workingDir, input.parentTaskPath)

      // Build synthesis prompt
      const prompt = buildPlanSynthesisPrompt({
        title: parentTask.title,
        parentTaskPath: input.parentTaskPath,
        plan1Path: input.plan1Path,
        plan1Content,
        plan2Path: input.plan2Path,
        plan2Content,
        plan1Failed,
        plan2Failed,
        workingDir: ctx.workingDir,
      })

      // Spawn codex orchestrator session
      const sessionId = randomBytes(6).toString("hex")
      const daemonNonce = randomBytes(16).toString("hex")
      const streamServerUrl = getStreamServerUrl()
      const monitor = getProcessMonitor()

      await monitor.spawnDaemon({
        sessionId,
        agentType: "codex",
        prompt,
        workingDir: ctx.workingDir,
        streamServerUrl,
        daemonNonce,
        taskPath: input.parentTaskPath,
        title: `Synthesize: ${parentTask.title}`,
        planRunId: input.planRunId,
      })

      return {
        sessionId,
        isNew: true,
      }
    }),

  // === Merge History & QA Status ===

  /**
   * Record a merge operation for a task.
   * Stores merge commit hash and sets QA status to pending.
   */
  recordMerge: procedure
    .input(z.object({
      path: z.string().min(1),
      sessionId: z.string().min(1),
      commitHash: z.string().min(1),
      mergedAt: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      taskLogger.info('recordMerge', `Recording merge for task`, {
        path: input.path,
        sessionId: input.sessionId.slice(0, 8),
        commitHash: input.commitHash.slice(0, 8),
      })
      return recordMerge(ctx.workingDir, input.path, {
        sessionId: input.sessionId,
        commitHash: input.commitHash,
        mergedAt: input.mergedAt || new Date().toISOString(),
      })
    }),

  /**
   * Set QA status for a task (pending, pass, fail).
   */
  setQAStatus: procedure
    .input(z.object({
      path: z.string().min(1),
      status: z.enum(['pending', 'pass', 'fail']),
    }))
    .mutation(({ ctx, input }) => {
      return setQAStatus(ctx.workingDir, input.path, input.status)
    }),

  /**
   * Record a revert operation for a merge.
   * Updates merge history with revert info and sets QA status to fail.
   */
  recordRevert: procedure
    .input(z.object({
      path: z.string().min(1),
      mergeCommitHash: z.string().min(1),
      revertCommitHash: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => {
      taskLogger.warn('recordRevert', `Recording revert for task`, {
        path: input.path,
        mergeCommitHash: input.mergeCommitHash.slice(0, 8),
        revertCommitHash: input.revertCommitHash.slice(0, 8),
      })
      return recordRevert(
        ctx.workingDir,
        input.path,
        input.mergeCommitHash,
        input.revertCommitHash
      )
    }),

  /**
   * Get the most recent non-reverted merge for a task.
   * Returns the merge that can be reverted, or null if none.
   */
  getLatestActiveMerge: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .query(({ ctx, input }) => {
      return getLatestActiveMerge(ctx.workingDir, input.path)
    }),
})
