/**
 * Tasks tRPC Router
 *
 * Tasks are markdown files stored in the repo (see task-service).
 */

import { z } from "zod"
import { router, procedure } from "./trpc"
import { createTask, deleteTask, getTask, listTasks, saveTask } from "@/lib/agent/task-service"
import { getAgentManager } from "@/lib/agent/manager"

/**
 * System prompt for task expansion agent.
 * The agent receives the user's prompt and generates a detailed task plan.
 */
function buildTaskExpansionPrompt(params: {
  title: string
  taskPath: string
  workingDir: string
}): string {
  return `You are a task planning assistant. Your job is to convert a brief task description into a detailed, actionable task plan.

## Your Task

The user wants to accomplish: "${params.title}"

## Instructions

1. First, explore the codebase to understand the project structure and relevant files
2. Create a detailed markdown task plan with:
   - Clear problem statement
   - Scope and constraints
   - Step-by-step implementation checklist with GFM checkboxes
   - Key files to modify
   - Testing approach
   - Success criteria

3. Write the task plan to: ${params.taskPath}

## Output Format

Write a markdown file with this structure:

\`\`\`markdown
# ${params.title}

## Problem Statement
[Clear description of what needs to be done and why]

## Scope
- What's included
- What's NOT included (out of scope)

## Implementation Plan

### Phase 1: [Name]
- [ ] Step 1 description
- [ ] Step 2 description

### Phase 2: [Name]
- [ ] Step 3 description
- [ ] Step 4 description

## Key Files
- \`path/to/file1.ts\` - [why it needs changes]
- \`path/to/file2.ts\` - [why it needs changes]

## Testing
- [ ] Test case 1
- [ ] Test case 2

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
\`\`\`

## Important

- Use GFM checkboxes (- [ ]) for all actionable items
- Be specific about file paths and code changes
- Keep the plan realistic and achievable
- Focus on the working directory: ${params.workingDir}

Now explore the codebase and write the detailed task plan.`
}

/**
 * System prompt for task execution agent.
 * The agent receives an existing task plan and executes it.
 */
function buildTaskExecutionPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
}): string {
  return `You are a coding assistant. Your job is to execute a task plan that has been prepared for you.

## Task Plan

The following task plan is stored at: ${params.taskPath}

---
${params.taskContent}
---

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
 * System prompt for task review agent.
 * The agent receives a task plan and suggests improvements as a complete rewrite.
 */
function buildTaskReviewPrompt(params: {
  taskPath: string
  taskContent: string
  workingDir: string
  instructions?: string
}): string {
  const userInstructions = params.instructions?.trim()
    ? `\n## Additional Review Instructions\n${params.instructions.trim()}\n`
    : ""

  return `You are a senior engineering lead. Your job is to review a markdown task plan and suggest improvements.

## Context

- Working directory: ${params.workingDir}
- Task file path: ${params.taskPath}

## What to review for

- Clarity and correctness of the plan
- Missing steps, edge cases, or tests
- Good scoping (explicit in/out of scope)
- Concrete file paths and actionable checklist items
- Consistent formatting (headings, bullet lists, checkboxes)

## Constraints

- Do NOT run tools or commands.
- Do NOT modify any files directly.
- Only propose edits to the task markdown content.
- Keep the intent of the task the same; improve wording, structure, and completeness.
${userInstructions}

## Current Task Content

--- TASK_START ---
${params.taskContent}
--- TASK_END ---

## Output Format (important)

Return ONLY the updated markdown file contents between these exact markers:

===TASK_REVIEW_OUTPUT_START===
[full markdown content]
===TASK_REVIEW_OUTPUT_END===
`
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
      return createTask(ctx.workingDir, { title: input.title, content: input.content })
    }),

  /**
   * Create a task with agent-powered expansion.
   * Spawns an agent to convert the prompt into a detailed task plan.
   */
  createWithAgent: procedure
    .input(z.object({
      title: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = getAgentManager()

      // Create the task file first with placeholder content
      const { path: taskPath } = createTask(ctx.workingDir, {
        title: input.title,
        content: `# ${input.title}\n\n_Generating detailed task plan..._\n`,
      })

      // Build the expansion prompt
      const prompt = buildTaskExpansionPrompt({
        title: input.title,
        taskPath,
        workingDir: ctx.workingDir,
      })

      // Spawn the agent to expand the task
      const session = await manager.spawn({
        prompt,
        workingDir: ctx.workingDir,
        agentType: input.agentType,
      })

      return {
        path: taskPath,
        sessionId: session.id,
        status: session.status,
      }
    }),

  /**
   * Delete a task file.
   */
  delete: procedure
    .input(z.object({
      path: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => {
      return deleteTask(ctx.workingDir, input.path)
    }),

  /**
   * Assign an existing task to an agent for execution.
   * Spawns an agent that will work through the task plan.
   */
  assignToAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = getAgentManager()

      // Get the task content
      const task = getTask(ctx.workingDir, input.path)

      // Build the execution prompt
      const prompt = buildTaskExecutionPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
      })

      // Spawn the agent to execute the task
      const session = await manager.spawn({
        prompt,
        workingDir: ctx.workingDir,
        agentType: input.agentType,
        taskPath: input.path, // Link session to task
      })

      return {
        path: input.path,
        sessionId: session.id,
        status: session.status,
      }
    }),

  /**
   * Review an existing task with an agent and propose improvements.
   * The agent returns a rewritten task plan; user can apply/reject in UI.
   */
  reviewWithAgent: procedure
    .input(z.object({
      path: z.string().min(1),
      agentType: z.enum(["claude", "codex", "opencode", "cerebras"]).default("claude"),
      /** Model for opencode in format "provider/model" (e.g., "anthropic/claude-sonnet-4-20250514") */
      model: z.string().optional(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const manager = getAgentManager()

      const task = getTask(ctx.workingDir, input.path)
      const prompt = buildTaskReviewPrompt({
        taskPath: input.path,
        taskContent: task.content,
        workingDir: ctx.workingDir,
        instructions: input.instructions,
      })

      const session = await manager.spawn({
        prompt,
        workingDir: ctx.workingDir,
        agentType: input.agentType,
        model: input.agentType === "opencode" ? input.model : undefined,
        taskPath: input.path,
      })

      return {
        path: input.path,
        sessionId: session.id,
        status: session.status,
      }
    }),

  /**
   * Get active agent sessions for tasks.
   * Returns a map of taskPath -> session for all tasks with active agents.
   */
  getActiveAgentSessions: procedure.query(() => {
    const manager = getAgentManager()
    const allSessions = manager.getAllSessions()

    // Filter to sessions that have a taskPath and are still active
    const activeStatuses = ["pending", "running", "working", "waiting_approval", "waiting_input", "idle"]
    const taskSessions: Record<string, { sessionId: string; status: string }> = {}

    for (const session of allSessions) {
      if (session.taskPath && activeStatuses.includes(session.status)) {
        taskSessions[session.taskPath] = {
          sessionId: session.id,
          status: session.status,
        }
      }
    }

    return taskSessions
  }),
})
